import * as Localization from "expo-localization";

/**
 * Maps device locale to a BCP-47 tag that native speech recognizers typically accept.
 * Difference from raw languageTag: normalizes zh-Hans-CN → zh-CN, etc.
 */
export function getDefaultSpeechRecognitionLang(): string {
  const locales = Localization.getLocales();
  const tag = locales[0]?.languageTag;
  if (!tag) {
    return "zh-CN";
  }

  const lower = tag.toLowerCase();

  if (lower === "zh-cn" || lower.startsWith("zh-hans")) {
    return "zh-CN";
  }
  if (lower.startsWith("zh-hant") || lower.includes("-tw") || lower === "zh-tw") {
    return "zh-TW";
  }
  if (lower.includes("hk") && lower.startsWith("zh")) {
    return "zh-HK";
  }
  if (lower.startsWith("zh")) {
    return "zh-CN";
  }

  if (lower.startsWith("en-gb")) {
    return "en-GB";
  }
  if (lower.startsWith("en")) {
    return "en-US";
  }

  return tag;
}
