import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { DEV_TEST_EMAIL, DEV_TEST_PASSWORD } from "../../src/constants/devAuth";
import { supabase } from "../../src/lib/supabase";
import { syncUserProfileEmail } from "../../src/lib/profileSync";

async function hasCompletedOnboarding(userId: string) {
  const { data, error } = await supabase
    .from("hormone_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return false;
  }
  return Boolean(data?.id);
}

function resolveDevCredentials(rawEmail: string, rawPassword: string) {
  let e = rawEmail.trim();
  let p = rawPassword;
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    if (e.toLowerCase() === "test") {
      e = DEV_TEST_EMAIL;
    }
    if (p === "6666") {
      p = DEV_TEST_PASSWORD;
    }
  }
  return { email: e, password: p };
}

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const completeLogin = async (userId: string | undefined, userEmail: string | null | undefined) => {
    if (!userId) {
      router.replace("/(tabs)/home");
      return;
    }
    await syncUserProfileEmail(userId, userEmail);

    const completed = await hasCompletedOnboarding(userId);
    router.replace(completed ? "/(tabs)/home" : "/onboarding");
  };

  const signInWithCredentials = async (rawEmail: string, rawPassword: string) => {
    const { email: resolvedEmail, password: resolvedPassword } = resolveDevCredentials(
      rawEmail,
      rawPassword,
    );

    if (!resolvedEmail || !resolvedPassword) {
      setError("请输入邮箱和密码。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: resolvedPassword,
      });
      if (signInError) {
        throw new Error(signInError.message);
      }

      await completeLogin(data.user?.id, data.user?.email ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "登录失败，请稍后重试。";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    await signInWithCredentials(email, password);
  };

  const fillDevTestAndLogin = async () => {
    setEmail("test");
    setPassword("6666");
    await signInWithCredentials("test", "6666");
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-oestra-cream"
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <View className="flex-1 px-7 pt-24">
        <View className="items-center">
          <Text className="font-serif-bold text-6xl text-oestra-purple">Oestra</Text>
          <Text className="mt-3 font-sans text-base text-oestra-text-light">a quiet revolution</Text>
        </View>

        <View className="mt-20 gap-4">
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="邮箱（开发预览可填 test）"
            placeholderTextColor="#6B6770"
            className="rounded-2xl border border-oestra-mist bg-white px-5 py-4 font-sans text-base text-oestra-text"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="密码（测试号可填 6666）"
            placeholderTextColor="#6B6770"
            className="rounded-2xl border border-oestra-mist bg-white px-5 py-4 font-sans text-base text-oestra-text"
          />
          {error ? <Text className="font-sans text-sm text-oestra-blush">{error}</Text> : null}
        </View>

        {typeof __DEV__ !== "undefined" && __DEV__ ? (
          <View className="mt-6 rounded-2xl border border-dashed border-oestra-mist bg-white/80 px-4 py-3">
            <Text className="font-sans text-xs text-oestra-text-light">
              开发预览：账号填「test」、密码「6666」会自动映射为测试邮箱与 6 位密码（Supabase 最少 6 位）。
              请先在 Supabase 控制台创建用户 {DEV_TEST_EMAIL} / {DEV_TEST_PASSWORD}。
            </Text>
            <Pressable
              disabled={loading}
              onPress={fillDevTestAndLogin}
              className="mt-3 items-center rounded-xl bg-oestra-mist py-3 disabled:opacity-60"
            >
              <Text className="font-sans-medium text-sm text-oestra-text">一键填入测试账号并登录</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mt-auto pb-10">
          <Pressable
            disabled={loading}
            onPress={handleLogin}
            className="items-center rounded-2xl bg-oestra-purple py-4 disabled:opacity-60"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-sans-bold text-base text-white">登录</Text>
            )}
          </Pressable>
          <Text className="mt-5 text-center font-sans text-sm text-oestra-text-light">
            还没有账号？{" "}
            <Link href="/(auth)/register" className="font-sans-medium text-oestra-purple">
              注册
            </Link>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
