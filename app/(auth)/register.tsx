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

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password) {
      setError("请输入邮箱和密码。");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要6位。");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const normalizedEmail = email.trim();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });
      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (data.user?.id) {
        await syncUserProfileEmail(data.user.id, normalizedEmail);
      }

      if (!data.session) {
        setPendingVerifyEmail(normalizedEmail);
        setNotice(
          "注册已提交。若项目开启了「邮箱验证」，需要点击邮件里的链接后才能登录。\n\n" +
            "收不到？先看垃圾箱/广告文件夹；Supabase 默认发信易进垃圾箱。\n\n" +
            "本地预览建议在 Supabase → Authentication → Providers → Email 里暂时关闭「Confirm email」，注册后即可直接进入（无需等邮件）。\n\n" +
            "生产环境请在 Authentication → Emails 配置自定义 SMTP。",
        );
        return;
      }

      setPendingVerifyEmail(null);
      router.replace("/onboarding");
    } catch (e) {
      const message = e instanceof Error ? e.message : "注册失败，请稍后重试。";
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
            placeholder="密码（至少6位）"
            placeholderTextColor="#6B6770"
            className="rounded-2xl border border-oestra-mist bg-white px-5 py-4 font-sans text-base text-oestra-text"
          />
          {error ? <Text className="font-sans text-sm text-oestra-blush">{error}</Text> : null}
          {notice ? (
            <Text className="font-sans text-sm leading-6 text-oestra-text-light">{notice}</Text>
          ) : null}
          {pendingVerifyEmail ? (
            <Pressable
              disabled={resendLoading}
              onPress={async () => {
                setResendLoading(true);
                setError(null);
                try {
                  const { error: resendErr } = await supabase.auth.resend({
                    type: "signup",
                    email: pendingVerifyEmail,
                  });
                  if (resendErr) {
                    throw new Error(resendErr.message);
                  }
                  setNotice(
                    (prev) =>
                      (prev ? `${prev}\n\n` : "") + "已尝试再次发送验证邮件，请稍等并查看收件箱与垃圾箱。",
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : "重发失败。");
                } finally {
                  setResendLoading(false);
                }
              }}
              className="items-center rounded-2xl border border-oestra-purple bg-white py-3 disabled:opacity-60"
            >
              <Text className="font-sans-medium text-base text-oestra-purple">
                {resendLoading ? "发送中…" : "重新发送验证邮件"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View className="mt-auto pb-10">
          <Pressable
            disabled={loading}
            onPress={handleRegister}
            className="items-center rounded-2xl bg-oestra-purple py-4 disabled:opacity-60"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-sans-bold text-base text-white">注册</Text>
            )}
          </Pressable>
          <Text className="mt-5 text-center font-sans text-sm text-oestra-text-light">
            已有账号？{" "}
            <Link href="/(auth)/login" className="font-sans-medium text-oestra-purple">
              登录
            </Link>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
