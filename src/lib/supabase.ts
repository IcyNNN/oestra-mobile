import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

const runtimeExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
// Expo Web often has empty process.env at runtime; app.config.ts injects into Constants.expoConfig.extra — prefer that first.
const supabaseUrl =
  runtimeExtra.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  runtimeExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const fallbackUrl = "https://example.supabase.co";
const fallbackKey = "public-anon-key-placeholder";
const hasValidConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasValidConfig) {
  // Difference from Next.js SSR boot: RN runtime should avoid hard crash at module import time.
  // This keeps UI testable even when env injection fails on local tooling; auth/network calls will fail gracefully.
  console.warn(
    "[Oestra] Supabase env vars missing. Using fallback client. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(supabaseUrl || fallbackUrl, supabaseAnonKey || fallbackKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Browser preview needs URL fragment/hash handling for OAuth & PKCE session restore.
    detectSessionInUrl: Platform.OS === "web",
  },
});
