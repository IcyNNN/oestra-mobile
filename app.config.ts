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
  extra: {
    ...(baseConfig.expo.extra ?? {}),
    EXPO_PUBLIC_SUPABASE_URL: getEnvValue("EXPO_PUBLIC_SUPABASE_URL"),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: getEnvValue("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    EXPO_PUBLIC_ANTHROPIC_API_KEY: getEnvValue("EXPO_PUBLIC_ANTHROPIC_API_KEY"),
  },
});
