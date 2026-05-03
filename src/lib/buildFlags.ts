import Constants from "expo-constants";

/**
 * True when the native binary was built with SKIP_HEALTHKIT=1 (no HealthKit / Health Connect plugins).
 * Used to hide or soften health sync UI until a full rebuild enables native health APIs.
 */
export function isHealthNativeDisabled(): boolean {
  const v = Constants.expoConfig?.extra?.EXPO_PUBLIC_SKIP_HEALTH_NATIVE;
  return v === "1" || v === "true";
}
