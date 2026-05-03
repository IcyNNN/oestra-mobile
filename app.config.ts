import type { ExpoConfig } from "expo/config";
import fs from "fs";
import path from "path";

const baseConfig = require("./app.json") as { expo: ExpoConfig };

function getEnvValue(key: string): string {
  const fromProcess = process.env[key];
  if (fromProcess) {
    return fromProcess;
  }

  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return "";
  }

  const content = fs.readFileSync(envPath, "utf8");
  const line = content
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${key}=`) && !item.trim().startsWith("#"));
  if (!line) {
    return "";
  }

  return line.slice(line.indexOf("=") + 1).trim();
}

/** When Apple Developer membership isn't active yet: omit HealthKit entitlements + plugins so Personal Team can sign. */
function truthySkipHealthKit(): boolean {
  const v = getEnvValue("SKIP_HEALTHKIT").toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  const p = process.env.SKIP_HEALTHKIT;
  return p === "1" || p?.toLowerCase() === "true";
}

export default (): ExpoConfig => {
  const skipHealthNative = truthySkipHealthKit();

  const ios =
    skipHealthNative && baseConfig.expo.ios
      ? (() => {
          const { entitlements: _e, infoPlist: pl, ...rest } = baseConfig.expo.ios;
          const infoPlist = pl ? { ...pl } : {};
          delete (infoPlist as Record<string, unknown>).NSHealthShareUsageDescription;
          delete (infoPlist as Record<string, unknown>).NSHealthUpdateUsageDescription;
          return {
            ...rest,
            infoPlist,
          };
        })()
      : baseConfig.expo.ios;

  const basePlugins: NonNullable<ExpoConfig["plugins"]> = [
    ...(baseConfig.expo.plugins ?? []),
    "expo-localization",
    [
      "expo-speech-recognition",
      {
        microphonePermission: "Allow Oestra to use the microphone for voice input.",
        speechRecognitionPermission: "Allow Oestra to transcribe your speech into text.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Allow Oestra to attach photos in chat.",
        cameraPermission: "Allow Oestra to take photos for chat attachments.",
      },
    ],
  ];

  const healthPlugins: NonNullable<ExpoConfig["plugins"]> = [
    [
      "@kayzmann/expo-healthkit",
      {
        healthShareUsageDescription:
          "Oestra reads your health data (menstrual cycles, sleep, heart rate, activity) to provide personalized cycle and hormone insights. Your data stays private and is never sold.",
        healthUpdateUsageDescription:
          "Oestra can save your cycle and symptom records to Apple Health so your data can stay in one place when you choose.",
      },
    ],
    "expo-health-connect",
  ];

  const reactNativeHealthPlugin: NonNullable<ExpoConfig["plugins"]> = [
    [
      "react-native-health",
      {
        healthSharePermission:
          "Oestra reads your health data (menstrual cycles, sleep, heart rate, activity) to provide personalized cycle and hormone insights. Your data stays private and is never sold.",
        healthUpdatePermission:
          "Oestra can save your cycle and symptom records to Apple Health so your data can stay in one place when you choose.",
      },
    ],
  ];

  const tailPlugins: NonNullable<ExpoConfig["plugins"]> = [
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 26,
        },
      },
    ],
  ];

  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    ...basePlugins,
    ...(skipHealthNative ? [] : healthPlugins),
    ...tailPlugins,
    ...(skipHealthNative ? [] : reactNativeHealthPlugin),
  ];

  return {
    ...baseConfig.expo,
    ios,
    plugins,
    extra: {
      ...(baseConfig.expo.extra ?? {}),
      EXPO_PUBLIC_SUPABASE_URL: getEnvValue("EXPO_PUBLIC_SUPABASE_URL"),
      EXPO_PUBLIC_SUPABASE_ANON_KEY: getEnvValue("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
      EXPO_PUBLIC_SKIP_HEALTH_NATIVE: skipHealthNative ? "1" : "0",
    },
  };
};
