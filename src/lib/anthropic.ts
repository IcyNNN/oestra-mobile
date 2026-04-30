import Constants from "expo-constants";

export interface ChatPayloadMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendMessage(
  messages: ChatPayloadMessage[],
  systemPrompt: string,
  maxTokens: number = 1024,
): Promise<string> {
  try {
    const runtimeExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
    const apiKey =
      process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? runtimeExtra.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("Anthropic API key is missing.");
    }

    // TODO: 生产环境应改为通过后端代理调用，不在客户端暴露API key
    // Difference from Next.js version: direct RN fetch call instead of server-side streamText.
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMessage =
        data?.error?.message ||
        data?.message ||
        "Anthropic request failed. Please try again.";
      throw new Error(errMessage);
    }

    const text = data?.content?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("No AI response text returned.");
    }

    return text;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to get AI response right now.";
    throw new Error(`Oestra暂时无法回应：${message}`);
  }
}
