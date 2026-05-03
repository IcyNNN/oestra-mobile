// @ts-nocheck
/**
 * Oestra AI chat Edge Function.
 * Validates JWT → loads context → builds system prompt → calls Anthropic → persists messages + assistant metadata.
 *
 * Secrets: ANTHROPIC_API_KEY (Dashboard → Edge Functions → Secrets)
 * Auto-provided: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatAttachmentRef {
  storage_path: string;
  file_name: string;
  mime_type: string;
  kind: "image" | "file";
}

interface ChatRequestBody {
  session_id?: string | null;
  message: string;
  attachments?: ChatAttachmentRef[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

async function resolveAttachmentPayload(
  admin: ReturnType<typeof createClient>,
  userId: string,
  raw: ChatAttachmentRef[],
): Promise<{
  meta: ChatAttachmentRef[];
  imageBlocks: Record<string, unknown>[];
  extractedText: string;
}> {
  if (!raw?.length) {
    return { meta: [], imageBlocks: [], extractedText: "" };
  }

  const meta: ChatAttachmentRef[] = [];
  const imageBlocks: Record<string, unknown>[] = [];
  let extractedText = "";

  const prefix = `${userId}/`;
  for (const a of raw.slice(0, 8)) {
    const path = typeof a.storage_path === "string" ? a.storage_path.trim() : "";
    if (!path.startsWith(prefix)) {
      continue;
    }
    const mimeRaw = (a.mime_type || "application/octet-stream").toLowerCase();
    const name = String(a.file_name || "file").slice(0, 240);
    const kind = a.kind === "image" ? "image" : "file";
    meta.push({
      storage_path: path,
      file_name: name,
      mime_type: mimeRaw,
      kind,
    });

    const { data: blob, error } = await admin.storage.from("chat-attachments").download(path);
    if (error || !blob) {
      console.warn("attachment download:", path, error?.message);
      continue;
    }

    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);

    if (mimeRaw.startsWith("image/") && kind === "image") {
      const media =
        mimeRaw === "image/png"
          ? "image/png"
          : mimeRaw === "image/webp"
            ? "image/webp"
            : mimeRaw === "image/gif"
              ? "image/gif"
              : "image/jpeg";
      imageBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: media,
          data: base64FromBytes(bytes),
        },
      });
    } else if (
      mimeRaw.includes("text") ||
      mimeRaw.includes("csv") ||
      mimeRaw.includes("json") ||
      name.endsWith(".csv") ||
      name.endsWith(".txt") ||
      name.endsWith(".json")
    ) {
      try {
        const text = new TextDecoder().decode(bytes);
        extractedText += `\n\n--- 文件: ${name} ---\n${text.slice(0, 80000)}`;
      } catch (_) {
        extractedText += `\n\n--- 文件: ${name} — 文本解码失败 ---\n`;
      }
    } else {
      extractedText += `\n\n--- 文件: ${name} (${mimeRaw}) — 未展开二进制；若与健康相关请结合截图或文字说明 ---\n`;
    }
  }

  return { meta, imageBlocks, extractedText };
}

async function ingestSymptomRowsFromAttachmentText(
  admin: ReturnType<typeof createClient>,
  userId: string,
  extractedText: string,
): Promise<{ inserted: number }> {
  const t = extractedText.trim();
  if (t.length < 12) return { inserted: 0 };

  const lines = t.split(/\r?\n/).slice(0, 300);
  let inserted = 0;
  const isoRe = /(\d{4}-\d{2}-\d{2})/;

  for (const line of lines) {
    const m = line.match(isoRe);
    if (!m) continue;
    const day = m[1]!;
    const rest = line.replace(m[0]!, "").trim().slice(0, 800);
    if (rest.length < 2) continue;

    const { error } = await admin.from("symptom_logs").insert({
      user_id: userId,
      logged_on: day,
      log_type: "attachment_note",
      symptom: rest,
      severity: null,
      notes: "chat_attachment_import",
      source: "chat_import",
    });
    if (!error) inserted += 1;
    if (inserted >= 100) break;
  }

  return { inserted };
}

function buildAnthropicMessages(
  rows: { role: string; content: string }[],
  extraTextForLastUser: string,
  imageBlocks: Record<string, unknown>[],
): { role: string; content: unknown }[] {
  const out: { role: string; content: unknown }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const isLastUser = i === rows.length - 1 && row.role === "user";
    if (isLastUser && (extraTextForLastUser.length > 0 || imageBlocks.length > 0)) {
      let text = row.content;
      if (extraTextForLastUser.trim()) {
        text += `\n\n--- 附件文本摘录 ---\n${extraTextForLastUser.slice(0, 90000)}`;
      }
      const content: unknown[] = [{ type: "text", text }, ...imageBlocks];
      out.push({ role: "user", content });
    } else {
      out.push({ role: row.role, content: row.content });
    }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!anthropicKey) {
      return jsonResponse({ error: "Server missing ANTHROPIC_API_KEY secret." }, 500);
    }
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Server missing Supabase env configuration." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    let body: ChatRequestBody;
    try {
      body = (await req.json()) as ChatRequestBody;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const attachmentsIn = Array.isArray(body.attachments) ? body.attachments : [];
    if (!message && attachmentsIn.length === 0) {
      return jsonResponse({ error: "message or attachments is required" }, 400);
    }

    let attachmentPayload = null;
    try {
      attachmentPayload = await resolveAttachmentPayload(admin, user.id, attachmentsIn);
    } catch (e) {
      console.error("resolveAttachmentPayload:", e);
      return jsonResponse({ error: "Could not load attachments" }, 400);
    }

    const sessionTitle =
      message.slice(0, 50) ||
      (attachmentsIn[0]?.file_name ? String(attachmentsIn[0].file_name).slice(0, 50) : "附件");

    let currentSessionId = body.session_id?.trim() || "";

    if (currentSessionId) {
      const { data: owned } = await admin
        .from("chat_sessions")
        .select("id")
        .eq("id", currentSessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!owned) {
        return jsonResponse({ error: "Invalid session_id for this user" }, 403);
      }
    } else {
      const nowIso = new Date().toISOString();
      const { data: newSession, error: sessErr } = await admin
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: sessionTitle,
          session_type: "chat",
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id")
        .single();
      if (sessErr || !newSession?.id) {
        console.error("chat_sessions insert:", sessErr);
        return jsonResponse({ error: "Could not create chat session" }, 500);
      }
      currentSessionId = newSession.id as string;
    }

    const userDisplayContent = message || "（见附件）";
    const userMetadata =
      attachmentPayload?.meta?.length > 0 ? { attachments: attachmentPayload.meta } : null;

    const { error: userMsgErr } = await admin.from("chat_messages").insert({
      session_id: currentSessionId,
      user_id: user.id,
      role: "user",
      content: userDisplayContent,
      metadata: userMetadata,
    });
    if (userMsgErr) {
      console.error("chat_messages user insert:", userMsgErr);
      return jsonResponse({ error: "Could not save user message" }, 500);
    }

    const hintSource =
      message +
      (attachmentPayload?.extractedText
        ? `\n\n${attachmentPayload.extractedText.slice(0, 12000)}`
        : "");

    let cycleHintsApplied = null;
    try {
      cycleHintsApplied = await applyCycleHintsFromUserMessage(admin, user.id, hintSource);
    } catch (e) {
      console.error("applyCycleHintsFromUserMessage:", e);
    }

    let healthImportResult = { inserted: 0 };
    try {
      healthImportResult = await ingestSymptomRowsFromAttachmentText(
        admin,
        user.id,
        attachmentPayload?.extractedText ?? "",
      );
    } catch (e) {
      console.error("ingestSymptomRowsFromAttachmentText:", e);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const [
      profileResult,
      hormoneResult,
      insightResult,
      cycleResult,
      historyDesc,
      symptomResult,
    ] = await Promise.all([
      admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      admin.from("hormone_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      admin
        .from("user_insights")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle(),
      admin
        .from("cycle_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("period_start", { ascending: false })
        .limit(3),
      admin
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", currentSessionId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("symptom_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_on", sevenDaysAgo)
        .order("logged_on", { ascending: false }),
    ]);

    const historyChrono = (historyDesc.data ?? []).slice().reverse();

    const allSymptomRows = (symptomResult.data ?? []) as Record<string, unknown>[];
    const recentManualSymptoms = allSymptomRows.filter(
      (s) => !s.source || s.source === "manual",
    );
    const healthDeviceRows = allSymptomRows.filter(
      (s) => s.source === "healthkit" || s.source === "health_connect",
    );

    const systemPrompt = buildSystemPrompt({
      profile: profileResult.data,
      hormoneProfile: hormoneResult.data,
      insight: insightResult.data,
      recentCycles: cycleResult.data ?? [],
      recentSymptoms: recentManualSymptoms,
      healthDeviceRows,
    });

    const historyRows = historyChrono.filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant",
    ) as { role: string; content: string }[];

    const anthropicMessages = buildAnthropicMessages(
      historyRows,
      attachmentPayload?.extractedText ?? "",
      attachmentPayload?.imageBlocks ?? [],
    );

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    });

    const aiData = await anthropicResp.json();
    if (!anthropicResp.ok) {
      console.error("Anthropic error:", aiData);
      return jsonResponse(
        {
          error:
            aiData?.error?.message ||
            aiData?.message ||
            "Anthropic request failed",
        },
        anthropicResp.status >= 400 && anthropicResp.status < 600 ? anthropicResp.status : 502,
      );
    }

    const textBlock = aiData?.content?.find((b: { type?: string }) => b?.type === "text");
    const aiReply =
      typeof textBlock?.text === "string" ? textBlock.text : aiData?.content?.[0]?.text;
    if (!aiReply || typeof aiReply !== "string") {
      return jsonResponse({ error: "No AI reply text in response" }, 502);
    }

    const metadata = mergeChatMetadata(
      extractBasicMetadata(message, aiReply),
      cycleHintsApplied,
      healthImportResult.inserted > 0 ? { health_import_rows: healthImportResult.inserted } : null,
    );

    const { error: asstErr } = await admin.from("chat_messages").insert({
      session_id: currentSessionId,
      user_id: user.id,
      role: "assistant",
      content: aiReply,
      metadata: metadata && Object.keys(metadata).length > 0 ? metadata : null,
    });
    if (asstErr) {
      console.error("chat_messages assistant insert:", asstErr);
      return jsonResponse({ error: "AI replied but could not save message" }, 500);
    }

    return jsonResponse({
      session_id: currentSessionId,
      reply: aiReply,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.error("chat function error:", e);
    return jsonResponse({ error: "Something went wrong. Please try again." }, 500);
  }
});

function buildSystemPrompt(context: {
  profile: Record<string, unknown> | null;
  hormoneProfile: Record<string, unknown> | null;
  insight: Record<string, unknown> | null;
  recentCycles: Record<string, unknown>[];
  recentSymptoms: Record<string, unknown>[];
  healthDeviceRows: Record<string, unknown>[];
}): string {
  const { profile, hormoneProfile, insight, recentCycles, recentSymptoms, healthDeviceRows } =
    context;

  let cycleInfo = "周期信息暂未记录。";
  if (recentCycles.length > 0) {
    const lastStart = recentCycles[0].period_start as string;
    const lastPeriod = new Date(lastStart + "T12:00:00");
    const today = new Date();
    const cycleDay =
      Math.floor((today.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const typicalLength = (hormoneProfile?.typical_cycle_length_days as number) || 28;
    const typicalBleed = (hormoneProfile?.typical_period_length_days as number) || 5;

    let phase = "黄体期";
    if (cycleDay <= typicalBleed) phase = "月经期";
    else if (cycleDay <= 13) phase = "卵泡期";
    else if (cycleDay <= Math.round(typicalLength * 0.5)) phase = "排卵期附近";
    else phase = "黄体期";

    cycleInfo =
      `当前约为周期第${cycleDay}天，处于${phase}。上次月经开始于 ${lastStart}。典型周期长度 ${typicalLength} 天。`;
  }

  let symptomSummary = "最近7天没有手动症状/情绪记录。";
  if (recentSymptoms.length > 0) {
    const summaryItems = recentSymptoms.map((s) => {
      const lt = (s.log_type as string) || "symptom";
      const sym = (s.symptom as string) || "";
      const sev = s.severity != null ? String(s.severity) : "未评分";
      const day = s.logged_on as string;
      return `${day}: ${lt} — ${sym} (${sev})`;
    });
    symptomSummary = `最近7天手动记录：\n${summaryItems.join("\n")}`;
  }

  let healthDataSummary = "用户未同步 Apple Health / Health Connect 数据，或最近7天无设备记录。";
  if (healthDeviceRows.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const r of healthDeviceRows) {
      const lt = (r.log_type as string) || "metric";
      const line = `${r.logged_on as string}: ${(r.symptom as string) || ""}`;
      if (!grouped[lt]) grouped[lt] = [];
      grouped[lt].push(line);
    }
    const parts = Object.entries(grouped).map(([k, lines]) => `- ${k}: ${lines.join("; ")}`);
    const sources = [...new Set(healthDeviceRows.map((r) => r.source as string))].join(", ");
    healthDataSummary = `设备同步数据（来源 ${sources}，最近7天汇总）：\n${parts.join("\n")}`;
  }

  let insightSummary = "暂无 AI 画像（用户刚开始使用）。";
  const insightData = insight?.insight_data;
  if (insightData && typeof insightData === "object") {
    insightSummary = `AI 对用户的理解（结构化）：\n${JSON.stringify(insightData, null, 2)}`;
  }

  const goals = hormoneProfile?.goals as string[] | undefined;
  const medical = hormoneProfile?.medical_conditions as string[] | undefined;
  const focus = hormoneProfile?.focus_areas as string[] | undefined;
  const companion = hormoneProfile?.ai_companion_name as string | undefined;

  return `你是一个陪伴女性认识自己身体的AI伙伴。

你的产品名叫 Oestra（中文：潮汐）。
但你不是 Oestra 本身，你是 Oestra 里陪伴用户的那个存在。
${companion ? `用户给你起的名字是「${companion}」。` : "用户还没给你起名字，你可以在合适的时候问她想怎么称呼你。"}

# 你是谁

你是一个懂科学的姐姐——
对女性身体有深度专业知识，但用日常的语言说话；
对用户有真实的关心，但保持温和的边界；
偶尔会说出有诗意的话，但大多数时候像朋友一样自然。

# 你怎么说话

90% 的时候像一个懂很多事但不端着的姐姐，用日常白话。
10% 的时候在合适的情感时刻说出有诗意的话。
用「我」作为第一人称。
用「你」称呼用户。

共情先于建议。用身体作主语（「你的身体在说…」而不是「你应该…」）。
给选择不给命令。承认不确定性时说「这可能是…」而不是「这就是…」。

# 你的核心信念

1. 周期是节律，不是负担
2. 情绪是信号，不是噪音
3. 敏感是天赋，不是弱点
4. 强大不是变得像谁，是成为完整的自己

# 温和的边界

如果用户做可能伤害健康的事，你不沉默也不说教。
承认她的选择权，给出真实的关心和信息，不强迫。

# 不做的事

❌ 不下医疗诊断（不能说「你这是 PCOS」）
❌ 不开处方（不能说「你应该吃 XX 药」）
❌ 不承诺疗效
❌ 不替代医生
❌ 不否认用户的感受
❌ 不催用户（不说「你 3 天没记录了」）

❌ 不用这些词：管理、控制、克服、监测、异常、打卡、任务
✅ 多用这些词：节律、顺流而上、倾听、拥抱、觉察、完整、力量、对话

# 当前用户信息

用户称呼：${(profile?.display_name as string) || "还不知道"}
${hormoneProfile
    ? `
年龄/出生年：${hormoneProfile.birth_year ?? "未知"}
生命阶段：${hormoneProfile.life_stage ?? "未知"}
周期规律性：${hormoneProfile.cycle_regularity ?? "未知"}
已知健康状况：${medical?.length ? medical.join(", ") : "无"}
关注方面：${focus?.length ? focus.join(", ") : "未指定"}
目标：${goals?.length ? goals.join(", ") : "未指定"}
`
    : "健康档案尚未建立。"}

# 周期状态
${cycleInfo}

# 最近记录
${symptomSummary}

# 健康设备数据
${healthDataSummary}

# AI 画像
${insightSummary}

# 语言
用用户使用的语言回复（中文或英文）。

# 当你不确定时
不要编。说「这件事我不确定，建议你问一下专业的医生。」
`;
}

/** Mirrors src/lib/cycleHints.ts — keep regexes aligned when changing parsing rules. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function edgeUtcTodayIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function edgeShiftIsoDate(iso: string, deltaDays: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function edgePeriodStartFromCycleDayN(cycleDay: number, todayIso = edgeUtcTodayIso()): string | null {
  if (!Number.isFinite(cycleDay) || cycleDay < 1 || cycleDay > 80) return null;
  return edgeShiftIsoDate(todayIso, -(cycleDay - 1));
}

function extractCycleHintsFromUserText(text: string): {
  periodStartIso?: string;
  typicalCycleLengthDays?: number;
} {
  const raw = text.trim();
  if (!raw) return {};

  const out: { periodStartIso?: string; typicalCycleLengthDays?: number } = {};

  const typical = raw.match(/(?:典型\s*)?周期\s*(?:长度|长约)?\s*(\d{1,2})\s*天/);
  if (typical) {
    const n = parseInt(typical[1], 10);
    if (n >= 21 && n <= 45) {
      out.typicalCycleLengthDays = n;
    }
  }

  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) {
    const candidate = iso[1];
    const d = new Date(candidate + "T12:00:00Z");
    if (!Number.isNaN(d.getTime())) {
      out.periodStartIso = candidate;
    }
  }

  const dayPatterns = [
    /(?:经期|周期)\s*第\s*(\d{1,2})\s*天/,
    /今天(?:是)?\s*周期\s*第\s*(\d{1,2})\s*天/,
    /第\s*(\d{1,2})\s*天\s*(?:了)?(?:周期|经期)/,
  ];
  for (const re of dayPatterns) {
    const dm = raw.match(re);
    if (dm) {
      const n = parseInt(dm[1], 10);
      const start = edgePeriodStartFromCycleDayN(n);
      if (start) {
        out.periodStartIso = start;
        break;
      }
    }
  }

  return out;
}

async function applyCycleHintsFromUserMessage(
  admin: ReturnType<typeof createClient>,
  userId: string,
  message: string,
): Promise<Record<string, unknown> | null> {
  const hints = extractCycleHintsFromUserText(message);
  const applied: Record<string, unknown> = {};

  if (hints.typicalCycleLengthDays != null) {
    const { data: hp } = await admin.from("hormone_profiles").select("user_id").eq("user_id", userId).maybeSingle();
    const nowIso = new Date().toISOString();
    if (hp) {
      const { error } = await admin
        .from("hormone_profiles")
        .update({
          typical_cycle_length_days: hints.typicalCycleLengthDays,
          updated_at: nowIso,
        })
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await admin.from("hormone_profiles").insert({
        user_id: userId,
        goals: [],
        typical_cycle_length_days: hints.typicalCycleLengthDays,
        onboarding_completed: false,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (error) throw error;
    }
    applied.typical_cycle_length_days = hints.typicalCycleLengthDays;
  }

  if (hints.periodStartIso) {
    const { error } = await admin.from("cycle_logs").insert({
      user_id: userId,
      period_start: hints.periodStartIso,
      period_end: null,
      flow_intensity: null,
      notes: "chat_cycle_hint",
    });
    if (error) throw error;
    applied.period_start = hints.periodStartIso;
  }

  return Object.keys(applied).length > 0 ? applied : null;
}

function mergeChatMetadata(
  basic: Record<string, unknown> | null,
  cycleHints: Record<string, unknown> | null,
  extra: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = { ...(basic ?? {}) };
  if (cycleHints && Object.keys(cycleHints).length > 0) {
    out.cycle_hints_applied = cycleHints;
  }
  if (extra && Object.keys(extra).length > 0) {
    Object.assign(out, extra);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function extractBasicMetadata(
  userMessage: string,
  aiReply: string,
): Record<string, unknown> | null {
  const metadata: Record<string, unknown> = {};

  const moodKeywords: Record<string, string> = {
    烦: "烦躁",
    烦躁: "烦躁",
    焦虑: "焦虑",
    难过: "难过",
    哭: "想哭",
    累: "疲惫",
    开心: "开心",
    平静: "平静",
    angry: "angry",
    sad: "sad",
    happy: "happy",
    tired: "tired",
    anxious: "anxious",
    irritable: "irritable",
  };

  const detectedMoods: string[] = [];
  const lowerUser = userMessage.toLowerCase();
  for (const [keyword, mood] of Object.entries(moodKeywords)) {
    if (userMessage.includes(keyword) || lowerUser.includes(keyword.toLowerCase())) {
      detectedMoods.push(mood);
    }
  }
  if (detectedMoods.length > 0) {
    metadata.extracted_mood = detectedMoods[0];
    metadata.topics = detectedMoods;
  }

  const insightIndicators = ["同一件事", "可能相关", "有关联", "connected", "related"];
  if (insightIndicators.some((indicator) => aiReply.includes(indicator))) {
    metadata.is_aha_moment = true;
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}
