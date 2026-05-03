import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { VoiceTextInput } from "../../src/components/ui/VoiceTextInput";
import { useCycleData } from "../../src/hooks/useCycleData";
import {
  extractCycleHintsFromText,
  periodStartFromCycleDayN,
  type CycleHintResult,
} from "../../src/lib/cycleHints";
import { persistCycleHintsForUser } from "../../src/lib/cyclePersistence";
import { fetchLatestAppPeriodStart } from "../../src/lib/healthCycleConflict";
import { supabase } from "../../src/lib/supabase";

type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

function resolvePhase(day: number): CyclePhase {
  if (day <= 5) return "menstrual";
  if (day <= 13) return "follicular";
  if (day <= 16) return "ovulation";
  return "luteal";
}

const phaseText: Record<CyclePhase, { label: string; line: string }> = {
  menstrual: {
    label: "月经期",
    line: "今天适合慢下来，身体正在安静地重启。",
  },
  follicular: {
    label: "卵泡期",
    line: "你的能量在回升，像清晨雾里慢慢亮起的光。",
  },
  ovulation: {
    label: "排卵期",
    line: "你正处在打开与表达的时段，感受连接的力量。",
  },
  luteal: {
    label: "黄体期",
    line: "内在感受会更清晰，给自己多一点边界与温柔。",
  },
};

const QUICK_OPTIONS = {
  mood: ["平静", "有点烦躁", "开心", "低落"],
  energy: ["很低", "一般", "不错", "很充沛"],
  symptom: ["腹痛", "胸胀", "头痛", "无明显不适"],
};

type QuickType = keyof typeof QUICK_OPTIONS;
type QuickTypeOrFree = QuickType | "free";

interface DailyRecord {
  id: string;
  type: QuickType;
  value: string;
  createdAt: string;
  source: "supabase" | "local";
}

function inferTypeFromText(input: string): QuickType {
  const content = input.toLowerCase();
  if (
    content.includes("痛") ||
    content.includes("胀") ||
    content.includes("疼") ||
    content.includes("symptom")
  ) {
    return "symptom";
  }
  if (
    content.includes("累") ||
    content.includes("困") ||
    content.includes("有劲") ||
    content.includes("energy")
  ) {
    return "energy";
  }
  return "mood";
}

export default function HomeScreen() {
  const { currentCycleDay, refresh: refreshCycle } = useCycleData();
  const [cycleCorrectVisible, setCycleCorrectVisible] = useState(false);
  const [correctionPeriodIso, setCorrectionPeriodIso] = useState("");
  const [correctionCycleDay, setCorrectionCycleDay] = useState("");
  const [correctionVoice, setCorrectionVoice] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);

  const [selectedType, setSelectedType] = useState<QuickTypeOrFree | null>(null);
  const [recordInput, setRecordInput] = useState("");
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [storageKey, setStorageKey] = useState("oestra-daily-records-anon");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [syncHint, setSyncHint] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshCycle();
    }, [refreshCycle]),
  );

  useEffect(() => {
    const loadUser = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (userId) {
        setCurrentUserId(userId);
        setStorageKey(`oestra-daily-records-${userId}`);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const loadRecords = async () => {
      if (currentUserId) {
        const { data, error } = await supabase
          .from("cycle_logs")
          .select("*")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(60);

        if (!error && data) {
          // Difference from Next.js typed DTOs: this migration maps flexible legacy columns defensively.
          const mapped = data
            .filter((row: Record<string, unknown>) => {
              const n = String(row.notes ?? "");
              return (
                n !== "manual_home_long_press" &&
                n !== "chat_cycle_hint" &&
                n !== "health_sync_override"
              );
            })
            .map((row: Record<string, unknown>) => {
              const createdAt =
                String(row.created_at || row.logged_at || row.log_date || new Date().toISOString());
              const contentCandidates = [
                row.content,
                row.notes,
                row.note,
                row.description,
                row.summary,
              ].filter(Boolean);
              const inferredValue =
                String(
                  contentCandidates[0] ||
                    row.mood ||
                    row.energy ||
                    row.symptom ||
                    row.symptoms ||
                    "",
                ).trim() || "(空白记录)";

              let inferredType = String(row.record_type || row.type || row.kind || "");
              if (!inferredType) {
                if (row.mood) inferredType = "mood";
                else if (row.energy) inferredType = "energy";
                else if (row.symptom || row.symptoms) inferredType = "symptom";
                else inferredType = "mood";
              }

              if (!["mood", "energy", "symptom"].includes(inferredType)) {
                inferredType = inferTypeFromText(inferredValue);
              }

              return {
                id: String(row.id || `${createdAt}-${Math.random().toString(36).slice(2, 8)}`),
                type: inferredType as QuickType,
                value: inferredValue,
                createdAt,
                source: "supabase" as const,
              };
            })
            .filter((item) => item.value && item.value !== "(空白记录)");
          setRecords(mapped);
          setSyncHint(null);
          return;
        }
      }

      const raw = await AsyncStorage.getItem(storageKey);
      if (!raw) {
        setRecords([]);
        return;
      }
      try {
        setRecords(JSON.parse(raw) as DailyRecord[]);
        setSyncHint("当前展示的是本地记录，稍后会尝试同步到云端。");
      } catch {
        setRecords([]);
      }
    };

    loadRecords();
  }, [storageKey]);

  const phase = useMemo(() => resolvePhase(currentCycleDay), [currentCycleDay]);
  const phaseInfo = phaseText[phase];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysRecords = records.filter((record) => record.createdAt.slice(0, 10) === todayKey);

  const saveRecord = async (type: QuickType, value: string) => {
    const newRecord: DailyRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      value,
      createdAt: new Date().toISOString(),
      source: "local",
    };
    let persistedRecord = newRecord;

    if (currentUserId) {
      const payloadAttempts: Array<Record<string, unknown>> = [
        { user_id: currentUserId, record_type: type, content: value, created_at: newRecord.createdAt },
        { user_id: currentUserId, type, notes: value, created_at: newRecord.createdAt },
        { user_id: currentUserId, kind: type, note: value, logged_at: newRecord.createdAt },
        {
          user_id: currentUserId,
          mood: type === "mood" ? value : null,
          energy: type === "energy" ? value : null,
          symptom: type === "symptom" ? value : null,
          notes: value,
          created_at: newRecord.createdAt,
        },
      ];

      for (const payload of payloadAttempts) {
        const { data, error } = await supabase.from("cycle_logs").insert(payload).select("*").maybeSingle();
        if (!error && data) {
          persistedRecord = {
            id: String((data as Record<string, unknown>).id || newRecord.id),
            type,
            value,
            createdAt: String(
              (data as Record<string, unknown>).created_at ||
                (data as Record<string, unknown>).logged_at ||
                newRecord.createdAt,
            ),
            source: "supabase",
          };
          setSyncHint(null);
          break;
        }
      }
    }

    const next = [persistedRecord, ...records].slice(0, 50);
    setRecords(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
    if (persistedRecord.source === "local") {
      setSyncHint("已保存到本地，当前云端写入未成功。");
    }
    setRecordInput("");
    setSelectedType(null);
    refreshCycle();
  };

  const submitCycleCorrection = async () => {
    if (!currentUserId) {
      Alert.alert("请先登录", "登录后可以同步修正周期信息。");
      return;
    }

    const hintsVoice = extractCycleHintsFromText(correctionVoice);
    let periodStart = correctionPeriodIso.trim() || undefined;
    const dayStr = correctionCycleDay.trim();
    if (!periodStart && dayStr) {
      const n = parseInt(dayStr, 10);
      if (!Number.isNaN(n) && n >= 1) {
        periodStart = periodStartFromCycleDayN(n) ?? undefined;
      }
    }
    if (!periodStart && hintsVoice.periodStartIso) {
      periodStart = hintsVoice.periodStartIso;
    }

    const hints: CycleHintResult = {
      periodStartIso: periodStart,
      typicalCycleLengthDays: hintsVoice.typicalCycleLengthDays,
    };

    if (!hints.periodStartIso && hints.typicalCycleLengthDays == null) {
      Alert.alert(
        "还需要一点信息",
        "请填写上次月经开始的日期（YYYY-MM-DD）、今天是周期第几天，或用语音说出例如「上次月经 5 月 1 日」「今天是周期第 8 天」「典型周期 28 天」。",
      );
      return;
    }

    if (hints.periodStartIso) {
      const existing = await fetchLatestAppPeriodStart(currentUserId);
      if (existing && existing !== hints.periodStartIso) {
        const ok = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "覆盖周期起点？",
            `当前记录的上次月经开始为 ${existing}，将改为 ${hints.periodStartIso}。是否覆盖？`,
            [
              { text: "取消", style: "cancel", onPress: () => resolve(false) },
              { text: "覆盖", onPress: () => resolve(true) },
            ],
          );
        });
        if (!ok) return;
      }
    }

    setCorrectionBusy(true);
    try {
      await persistCycleHintsForUser(currentUserId, hints, "manual_home_long_press");
      await refreshCycle();
      setCycleCorrectVisible(false);
      setCorrectionPeriodIso("");
      setCorrectionCycleDay("");
      setCorrectionVoice("");
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后再试。");
    } finally {
      setCorrectionBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-oestra-cream" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <View className="items-center pt-10">
        <View className="h-60 w-60 items-center justify-center rounded-full bg-[#EFE8F6]">
          <View className="h-40 w-40 rounded-full bg-[#E3D8EF]" />
        </View>
        <Text className="mt-10 font-serif-bold text-4xl text-oestra-purple">今天的你</Text>
        <Text className="mt-4 text-center font-sans text-base leading-7 text-oestra-text">
          {phaseInfo.line}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityHint="长按可以修正周期起点或语音说明"
          delayLongPress={450}
          onLongPress={() => {
            if (!currentUserId) {
              Alert.alert("请先登录", "登录后可以修正并同步周期信息。");
              return;
            }
            setCycleCorrectVisible(true);
          }}
          className="mt-8 items-center active:opacity-80"
        >
          <Text className="font-sans-medium text-base text-oestra-text">
            周期第 {currentCycleDay} 天
          </Text>
          <Text className="mt-1 font-sans text-sm text-oestra-text-light">{phaseInfo.label}</Text>
          <Text className="mt-2 font-sans text-xs text-oestra-text-light">长按修正周期（支持语音）</Text>
        </Pressable>
      </View>

      <View className="mt-16 rounded-3xl bg-white p-5">
        <Text className="font-sans-medium text-sm text-oestra-text-light">快速记录</Text>
        <View className="mt-4 flex-row justify-between gap-3">
          <Pressable
            onPress={() => setSelectedType("mood")}
            className="flex-1 items-center rounded-2xl border border-oestra-mist py-3"
          >
            <Text className="font-sans-medium text-sm text-oestra-purple">心情</Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedType("energy")}
            className="flex-1 items-center rounded-2xl border border-oestra-mist py-3"
          >
            <Text className="font-sans-medium text-sm text-oestra-purple">能量</Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedType("symptom")}
            className="flex-1 items-center rounded-2xl border border-oestra-mist py-3"
          >
            <Text className="font-sans-medium text-sm text-oestra-purple">症状</Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedType("free")}
            className="flex-1 items-center rounded-2xl border border-oestra-mist py-3"
          >
            <Text className="font-sans-medium text-sm text-oestra-purple">自由记录</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-5 rounded-3xl bg-white p-5">
        <Text className="font-sans-medium text-sm text-oestra-text-light">今天已记录</Text>
        {syncHint ? <Text className="mt-2 font-sans text-xs text-oestra-text-light">{syncHint}</Text> : null}
        {todaysRecords.length === 0 ? (
          <Text className="mt-3 font-sans text-sm text-oestra-text-light">今天还没有记录。</Text>
        ) : (
          <View className="mt-3 gap-2">
            {todaysRecords.map((record) => (
              <View key={record.id} className="rounded-2xl border border-oestra-mist px-4 py-3">
                <Text className="font-sans-medium text-xs uppercase text-oestra-purple">{record.type}</Text>
                <Text className="mt-1 font-sans text-sm text-oestra-text">{record.value}</Text>
                <Text className="mt-1 font-sans text-[10px] text-oestra-text-light">
                  {record.source === "supabase" ? "云端" : "本地"}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal visible={cycleCorrectVisible} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/30 px-8">
          <View className="w-full rounded-3xl bg-white p-6">
            <Text className="font-serif-medium text-2xl text-oestra-purple">修正周期信息</Text>
            <Text className="mt-2 font-sans text-sm leading-6 text-oestra-text-light">
              填写上次月经开始日，或告诉我们今天是周期第几天；也可口述「典型周期 28 天」等。
            </Text>
            <Text className="mt-4 font-sans-medium text-xs text-oestra-text-light">上次月经开始（YYYY-MM-DD）</Text>
            <TextInput
              value={correctionPeriodIso}
              onChangeText={setCorrectionPeriodIso}
              placeholder="例如 2026-04-24"
              placeholderTextColor="#A89BB5"
              className="mt-2 rounded-2xl border border-oestra-mist px-4 py-3 font-sans text-base text-oestra-text"
            />
            <Text className="mt-4 font-sans-medium text-xs text-oestra-text-light">今天是周期第几天（可选）</Text>
            <TextInput
              value={correctionCycleDay}
              onChangeText={setCorrectionCycleDay}
              keyboardType="number-pad"
              placeholder="例如 8"
              placeholderTextColor="#A89BB5"
              className="mt-2 rounded-2xl border border-oestra-mist px-4 py-3 font-sans text-base text-oestra-text"
            />
            <VoiceTextInput
              value={correctionVoice}
              onChangeText={setCorrectionVoice}
              multiline
              placeholder="语音或打字：上次月经 4 月 24 日；今天是周期第 8 天；典型周期 28 天…"
              className="mt-4"
            />
            <Pressable
              disabled={correctionBusy}
              onPress={submitCycleCorrection}
              className="mt-4 items-center rounded-2xl bg-oestra-purple py-3 opacity-100 disabled:opacity-50"
            >
              <Text className="font-sans-bold text-sm text-white">
                {correctionBusy ? "保存中…" : "保存并更新首页"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCycleCorrectVisible(false);
                setCorrectionPeriodIso("");
                setCorrectionCycleDay("");
                setCorrectionVoice("");
              }}
              className="mt-4 items-end"
            >
              <Text className="font-sans-medium text-sm text-oestra-text-light">关闭</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedType)} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/30 px-8">
          <View className="w-full rounded-3xl bg-white p-6">
            <Text className="font-serif-medium text-2xl text-oestra-purple">
              {selectedType === "free" ? "自然语言记录" : "选择或输入记录"}
            </Text>
            {selectedType !== "free" ? (
              <View className="mt-4 gap-2">
                {(selectedType ? QUICK_OPTIONS[selectedType as QuickType] : []).map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => saveRecord(selectedType as QuickType, item)}
                    className="rounded-2xl border border-oestra-mist px-4 py-3"
                  >
                    <Text className="font-sans text-base text-oestra-text">{item}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <VoiceTextInput
              value={recordInput}
              onChangeText={setRecordInput}
              multiline
              placeholder="例如：今天有点累，心情也比较低落，下午腹部隐隐痛..."
              className="mt-4"
            />
            <Pressable
              onPress={() => {
                const text = recordInput.trim();
                if (!text) return;
                const type = selectedType === "free" ? inferTypeFromText(text) : (selectedType as QuickType);
                saveRecord(type, text);
              }}
              className="mt-3 items-center rounded-2xl bg-oestra-purple py-3"
            >
              <Text className="font-sans-bold text-sm text-white">让 Oestra 理解并记录</Text>
            </Pressable>
            <Pressable onPress={() => setSelectedType(null)} className="mt-4 items-end">
              <Text className="font-sans-medium text-sm text-oestra-text-light">关闭</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
