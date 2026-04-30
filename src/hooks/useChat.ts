import { useCallback, useEffect, useState } from "react";

import { sendMessage } from "../lib/anthropic";
import { supabase } from "../lib/supabase";
import { SYSTEM_PROMPT } from "../constants/prompts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<string>;
  currentSessionId: string | null;
}

function toChatMessage(row: {
  id: string;
  role: string;
  content: string;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.created_at,
  };
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const createNewSession = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) throw new Error("请先登录后再开始对话。");

    const { data, error: createError } = await supabase
      .from("chat_sessions")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (createError || !data?.id) {
      throw new Error(createError?.message || "无法创建会话。");
    }

    setCurrentSessionId(data.id);
    setMessages([]);
    return data.id;
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      throw new Error("请先登录。");
    }

    const { data: list } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (!list) {
      setMessages([]);
      setCurrentSessionId(sessionId);
      return;
    }
    setMessages(list.map((item) => toChatMessage(item as never)));
    setCurrentSessionId(sessionId);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) return;

      const { data: latestSession } = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestSession?.id) return;
      await loadSession(latestSession.id);
    };

    bootstrap();
  }, [loadSession]);

  const send = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);

    const localUserMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, localUserMessage]);

    try {
      const sessionId = currentSessionId ?? (await createNewSession());

      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "user",
        content: trimmed,
      });

      // Difference from Next.js + Vercel AI SDK useChat: RN hook manually builds context and persists.
      const aiText = await sendMessage(
        [...messages, localUserMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        SYSTEM_PROMPT,
      );

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: aiText,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: aiText,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "发送失败，请稍后重试。";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [createNewSession, currentSessionId, isLoading, messages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage: send,
    loadSession,
    createNewSession,
    currentSessionId,
  };
}
