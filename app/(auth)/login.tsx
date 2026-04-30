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

import { supabase } from "../../src/lib/supabase";
import { syncUserProfileEmail } from "../../src/lib/profileSync";

async function hasCompletedOnboarding(userId: string) {
  // Difference from Next.js app router: check directly from client in RN.
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

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("请输入邮箱和密码。");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        throw new Error(signInError.message);
      }

      const userId = data.user?.id;
      if (!userId) {
        router.replace("/(tabs)/home");
        return;
      }
      await syncUserProfileEmail(userId, data.user?.email);

      const completed = await hasCompletedOnboarding(userId);
      router.replace(completed ? "/(tabs)/home" : "/onboarding");
    } catch (e) {
      const message = e instanceof Error ? e.message : "登录失败，请稍后重试。";
      setError(message);
    } finally {
      setLoading(false);
    }
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
            placeholder="邮箱"
            placeholderTextColor="#6B6770"
            className="rounded-2xl border border-oestra-mist bg-white px-5 py-4 font-sans text-base text-oestra-text"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="密码"
            placeholderTextColor="#6B6770"
            className="rounded-2xl border border-oestra-mist bg-white px-5 py-4 font-sans text-base text-oestra-text"
          />
          {error ? <Text className="font-sans text-sm text-oestra-blush">{error}</Text> : null}
        </View>

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
