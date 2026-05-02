import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, Switch, Text, View } from "react-native";

import { useHealthSync } from "../../src/hooks/useHealthSync";
import { supabase } from "../../src/lib/supabase";

interface ProfileData {
  email: string;
  name: string;
  hormoneSummary: string;
  emailVerified: boolean;
}

export default function ProfileScreen() {
  const {
    hasPermission,
    requestPermission,
    syncNow,
    isSyncing,
    lastSynced,
    lastResult,
  } = useHealthSync();
  const [healthError, setHealthError] = useState<string | null>(null);

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
        <Text className="mt-2 font-sans text-xs leading-5 text-oestra-text-light">
          {Platform.OS === "ios"
            ? "从「健康」App 读取睡眠、心率、步数等（需开发构建安装，Expo Go 不可用）。"
            : "通过 Health Connect 读取（Android 14+，需安装 Health Connect）。同样需开发构建。"}
        </Text>
        <Text className="mt-2 font-sans text-xs text-oestra-text-light">
          授权状态：
          {hasPermission === null ? "未知" : hasPermission ? "已授权" : "未授权"}
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
          onPress={async () => {
            setHealthError(null);
            try {
              await requestPermission();
            } catch (e) {
              setHealthError(e instanceof Error ? e.message : "授权失败");
            }
          }}
          className="mt-3 items-center rounded-2xl border border-oestra-purple py-3"
        >
          <Text className="font-sans-medium text-sm text-oestra-purple">连接健康数据授权</Text>
        </Pressable>
        <Pressable
          disabled={isSyncing}
          onPress={async () => {
            setHealthError(null);
            try {
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
