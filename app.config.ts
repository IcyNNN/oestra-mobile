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

export default (): ExpoConfig => ({
  ...baseConfig.expo,
  plugins: [
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
      "@kayzmann/expo-healthkit",
      {
        healthShareUsageDescription:
          "Oestra reads your health data (menstrual cycles, sleep, heart rate, activity) to provide personalized cycle and hormone insights. Your data stays private and is never sold.",
        healthUpdateUsageDescription:
          "Oestra can save your cycle and symptom records to Apple Health so your data can stay in one place when you choose.",
      },
    ],
    "expo-health-connect",
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
    [
      "react-native-health",
      {
        healthSharePermission:
          "Oestra reads your health data (menstrual cycles, sleep, heart rate, activity) to provide personalized cycle and hormone insights. Your data stays private and is never sold.",
        healthUpdatePermission:
          "Oestra can save your cycle and symptom records to Apple Health so your data can stay in one place when you choose.",
      },
    ],
  ],
  extra: {
    ...(baseConfig.expo.extra ?? {}),
    EXPO_PUBLIC_SUPABASE_URL: getEnvValue("EXPO_PUBLIC_SUPABASE_URL"),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: getEnvValue("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  },
});
