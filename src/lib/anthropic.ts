import { supabase } from "./supabase";

import type { ChatAttachmentRef } from "../types/chatAttachment";

/** Edge Function `chat` JSON response */
export interface ChatEdgeResponse {
  session_id: string;
  reply: string;
  metadata: Record<string, unknown> | null;
}

/** Parse JSON body from Supabase FunctionsHttpError (non-2xx). */
async function readInvokeErrorDetail(error: unknown): Promise<string> {
  const fallback =
    error instanceof Error ? error.message : "Edge Function returned a non-2xx status code";

  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body = (await error.context.clone().json()) as Record<string, unknown>;
      if (typeof body.error === "string") {
        return body.error;
      }
      if (typeof body.message === "string") {
        return body.message;
      }
    } catch {
      /* response body not JSON */
    }
  }

  return fallback;
}

async function invokeChatOnce(
  trimmed: string,
  sessionId: string | null | undefined,
  attachments?: ChatAttachmentRef[],
): Promise<{ data: ChatEdgeResponse | null; error: unknown }> {
  return supabase.functions.invoke<ChatEdgeResponse>("chat", {
    body: {
      session_id: sessionId ?? undefined,
      message: trimmed,
      attachments: attachments?.length ? attachments : undefined,
    },
  });
}

/**
 * Send one user turn through the Supabase Edge Function (auth + persistence + Anthropic on server).
 */
export async function sendChatMessage(
  message: string,
  sessionId?: string | null,
  attachments?: ChatAttachmentRef[],
): Promise<ChatEdgeResponse> {
  const trimmed = message.trim();
  if (!trimmed && (!attachments || attachments.length === 0)) {
    throw new Error("请输入文字或添加附件。");
  }

  let { data, error } = await invokeChatOnce(trimmed, sessionId, attachments);

  // Stale or foreign session_id → 403; retry once without session so server creates a new chat_sessions row.
  if (error) {
    const detail = await readInvokeErrorDetail(error);
    const shouldRetryFresh =
      Boolean(sessionId) &&
      (detail.includes("Invalid session_id") || detail.includes("session_id for this user"));

    if (shouldRetryFresh) {
      ({ data, error } = await invokeChatOnce(trimmed, null, attachments));
    }

  if (error) {
    let finalDetail = await readInvokeErrorDetail(error);
    const lower = finalDetail.toLowerCase();
    if (
      lower.includes("not found") &&
      (lower.includes("function") || lower.includes("edge"))
    ) {
      finalDetail +=
        " 请在项目根目录执行：supabase login && supabase link --project-ref <你的项目ID> && supabase functions deploy chat，并在 Dashboard → Edge Functions 中确认已有 chat。";
    }
    throw new Error(finalDetail);
  }
  }

  if (!data?.reply || typeof data.reply !== "string") {
    throw new Error("没有收到 AI 回复。");
  }

  if (!data.session_id) {
    throw new Error("服务器未返回 session_id。");
  }

  return {
    session_id: data.session_id,
    reply: data.reply,
    metadata: data.metadata ?? null,
  };
}
