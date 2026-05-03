import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";

import { useHealthSync } from "../../src/hooks/useHealthSync";
import { sendChatMessage } from "../../src/lib/anthropic";
import { isHealthNativeDisabled } from "../../src/lib/buildFlags";
import { uploadPendingAttachments } from "../../src/lib/chatAttachmentUpload";
import {
  applyHealthPeriodStartOverride,
  detectHealthAppCycleConflict,
} from "../../src/lib/healthCycleConflict";
import { supabase } from "../../src/lib/supabase";

interface ProfileData {
  email: string;
  name: string;
  hormoneSummary: string;
  emailVerified: boolean;
}

export default function ProfileScreen() {
  const skipHealthNative = isHealthNativeDisabled();

  const {
    hasPermission,
    requestPermission,
    refreshPermission,
    syncNow,
    isSyncing,
    lastSynced,
    lastResult,
  } = useHealthSync();
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthImportBusy, setHealthImportBusy] = useState(false);

  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [profile, setProfile] = useState<ProfileData>({
    email: "",
    name: "你",
    hormoneSummary: "尚未完善健康档案",
    emailVerified: false,
  });

  useEffect(() => {
    const loadProfile = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return;

      const [{ data: hormone }, { data: profileRow }] = await Promise.all([
        supabase
          .from("hormone_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("profiles").select("email, name").eq("user_id", user.id).maybeSingle(),
      ]);

      setProfile({
        email: (profileRow as { email?: string } | null)?.email || user.email || "",
        name:
          (profileRow as { name?: string } | null)?.name ||
          (user.user_metadata?.name as string) ||
          "你",
        hormoneSummary: hormone ? "已建立基础激素档案，可继续完善。" : "尚未完善健康档案",
        emailVerified: Boolean(user.email_confirmed_at),
      });
    };

    loadProfile();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView className="flex-1 bg-oestra-cream" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text className="pt-10 font-serif-medium text-4xl text-oestra-purple">我的</Text>

      <View className="mt-8 rounded-3xl bg-white p-5">
        <Text className="font-sans-medium text-lg text-oestra-text">{profile.name}</Text>
        <Text className="mt-1 font-sans text-sm text-oestra-text-light">{profile.email || "未获取邮箱"}</Text>
        <Text
          className={`mt-1 font-sans text-xs ${profile.emailVerified ? "text-emerald-600" : "text-oestra-blush"}`}
        >
          {profile.emailVerified ? "邮箱已认证" : "邮箱待认证"}
        </Text>
      </View>

      <View className="mt-4 rounded-3xl bg-white p-5">
        <Text className="font-sans-medium text-sm text-oestra-text-light">健康档案摘要</Text>
        <Text className="mt-2 font-sans text-base leading-7 text-oestra-text">{profile.hormoneSummary}</Text>
        <Pressable className="mt-4 self-start rounded-2xl border border-oestra-mist px-4 py-2">
          <Text className="font-sans-medium text-sm text-oestra-purple">编辑档案</Text>
        </Pressable>
      </View>

      <View className="mt-4 rounded-3xl bg-white p-5">
        <Text className="font-sans-medium text-sm text-oestra-text-light">健康数据同步</Text>
        {skipHealthNative ? (
          <Text className="mt-2 font-sans text-xs leading-5 text-amber-800">
            当前安装包为「无原生健康能力」调试构建（构建时设置了 SKIP_HEALTHKIT）。可正常开发登录、对话、首页等；苹果开发者资格生效后，去掉
            SKIP_HEALTHKIT 并重新 prebuild + 安装即可恢复 HealthKit / Health Connect。
          </Text>
        ) : (
          <Text className="mt-2 font-sans text-xs leading-5 text-oestra-text-light">
            {Platform.OS === "ios"
              ? "从「健康」App 读取睡眠、心率、步数等（需开发构建安装，Expo Go 不可用）。"
              : "通过 Health Connect 读取（Android 14+，需安装 Health Connect）。同样需开发构建。"}
          </Text>
        )}
        <Text className="mt-2 font-sans text-xs text-oestra-text-light">
          {Platform.OS === "ios"
            ? hasPermission === null
              ? "本机健康：检测中…"
              : hasPermission
                ? "本机 HealthKit：可用（读取哪些数据需在系统弹窗或「设置 → 健康」里勾选）"
                : "本机 HealthKit：不可用（需真机）"
            : `授权状态：${hasPermission === null ? "未知" : hasPermission ? "已连接 Health Connect" : "未授权"}`}
        </Text>
        {lastSynced ? (
          <Text className="mt-1 font-sans text-xs text-oestra-text-light">
            上次同步：{lastSynced.toLocaleString()}
            {lastResult != null
              ? `（写入 ${lastResult.synced} 条，失败 ${lastResult.errors}）`
              : ""}
          </Text>
        ) : null}
        {healthError ? (
          <Text className="mt-2 font-sans text-xs text-oestra-blush">{healthError}</Text>
        ) : null}
        <Pressable
          disabled={skipHealthNative}
          onPress={async () => {
            if (skipHealthNative) return;
            setHealthError(null);
            try {
              const result = await requestPermission();
              await refreshPermission();
              const iosHint =
                "健康权限不在「设置 → Oestra」里。请到：设置 → 隐私与安全性 → 健康 → 数据访问与设备 → 选择 Oestra，打开需要读取的类型。";
              if (result.ok) {
                Alert.alert(
                  "健康授权",
                  Platform.OS === "ios"
                    ? `已向系统请求读取健康数据。若有弹窗请勾选允许的项目。\n${iosHint}`
                    : "请在随后界面或 Health Connect 中允许 Oestra 读取数据。",
                );
              } else {
                Alert.alert(
                  "无法发起授权",
                  Platform.OS === "ios"
                    ? `${result.reason}\n\n${iosHint}`
                    : `${result.reason}\n\n请确认已安装 Health Connect（Android 14+）并完成初始化。`,
                );
              }
            } catch (e) {
              setHealthError(e instanceof Error ? e.message : "授权失败");
            }
          }}
          className="mt-3 items-center rounded-2xl border border-oestra-purple py-3 disabled:opacity-50"
        >
          <Text className="font-sans-medium text-sm text-oestra-purple">连接健康数据授权</Text>
        </Pressable>
        <Pressable
          disabled={isSyncing || skipHealthNative}
          onPress={async () => {
            if (skipHealthNative) return;
            setHealthError(null);
            try {
              const { data: auth } = await supabase.auth.getUser();
              const uid = auth.user?.id;
              if (!uid) {
                throw new Error("请先登录后再同步健康数据。");
              }

              const conflict = await detectHealthAppCycleConflict(uid);
              if (conflict) {
                const choice = await new Promise<"cancel" | "keep_app" | "use_health">((resolve) => {
                  Alert.alert(
                    "周期起点与健康数据不一致",
                    `应用内上次月经开始：${conflict.appPeriodStart}\n手机健康记录推算：${conflict.healthPeriodStart}\n请先确认是否用手机同步覆盖应用内的周期起点，然后再写入最近数据。`,
                    [
                      { text: "取消", style: "cancel", onPress: () => resolve("cancel") },
                      { text: "保留应用内", onPress: () => resolve("keep_app") },
                      { text: "使用健康数据", onPress: () => resolve("use_health") },
                    ],
                  );
                });
                if (choice === "cancel") return;
                if (choice === "use_health") {
                  await applyHealthPeriodStartOverride(uid, conflict.healthPeriodStart);
                }
              }

              await syncNow();
            } catch (e) {
              setHealthError(e instanceof Error ? e.message : "同步失败");
            }
          }}
          className="mt-2 items-center rounded-2xl bg-oestra-mist py-3 disabled:opacity-60"
        >
          <Text className="font-sans-medium text-sm text-oestra-text">
            {isSyncing ? "同步中…" : "同步最近7天到云端"}
          </Text>
        </Pressable>
        <Pressable
          disabled={healthImportBusy}
          onPress={async () => {
            setHealthError(null);
            try {
              const { data: auth } = await supabase.auth.getUser();
              const uid = auth.user?.id;
              if (!uid) {
                Alert.alert("请先登录", "登录后可上传文件并让 AI 解析写入记录。");
                return;
              }
              const pick = await DocumentPicker.getDocumentAsync({
                multiple: false,
                copyToCacheDirectory: true,
              });
              if (pick.canceled || !pick.assets?.[0]) return;
              const file = pick.assets[0];
              setHealthImportBusy(true);
              const refs = await uploadPendingAttachments(uid, [
                {
                  uri: file.uri,
                  file_name: file.name,
                  mime_type: file.mimeType ?? "application/octet-stream",
                  kind: "file",
                },
              ]);
              await sendChatMessage(
                "这是我上传的本地健康相关文件（如导出、化验单、截图 PDF 等）。请阅读附件并摘要；若包含可结构化数据（日期与指标），请纳入我的症状记录数据库并提醒我核对。",
                null,
                refs,
              );
              Alert.alert("已提交", "请到「对话」查看解析说明；表格类文字已尝试写入 symptom_logs（来源 chat_import）。");
              router.push("/(tabs)/chat");
            } catch (e) {
              setHealthError(e instanceof Error ? e.message : "上传失败");
            } finally {
              setHealthImportBusy(false);
            }
          }}
          className="mt-3 items-center rounded-2xl border border-oestra-mist py-3 disabled:opacity-50"
        >
          <Text className="font-sans-medium text-sm text-oestra-text">
            {healthImportBusy ? "处理中…" : "上传本地健康数据文件"}
          </Text>
        </Pressable>
      </View>

      <View className="mt-4 rounded-3xl bg-white p-5">
        <View className="flex-row items-center justify-between py-2">
          <Text className="font-sans text-base text-oestra-text">通知开关</Text>
          <Switch value={notifyEnabled} onValueChange={setNotifyEnabled} />
        </View>
        <View className="border-t border-oestra-mist py-3">
          <Text className="font-sans text-base text-oestra-text">数据导出</Text>
        </View>
        <View className="border-t border-oestra-mist py-3">
          <Text className="font-sans text-base text-oestra-text">隐私政策</Text>
        </View>
      </View>

      <Pressable onPress={logout} className="mt-6 items-center rounded-2xl bg-oestra-purple py-4">
        <Text className="font-sans-bold text-base text-white">退出登录</Text>
      </Pressable>
    </ScrollView>
  );
}
