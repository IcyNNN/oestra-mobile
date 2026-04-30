import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import "react-native-url-polyfill/auto";

const runtimeExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? runtimeExtra.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? runtimeExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY;
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
    // Difference from Next.js web: React Native does not need URL session detection.
    detectSessionInUrl: false,
  },
});
