import { useCallback, useEffect, useState } from "react";

import { sendChatMessage } from "../lib/anthropic";
import { supabase } from "../lib/supabase";

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
  createNewSession: () => Promise<void>;
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

  /** Start a fresh thread locally; first message will create the session on the server. */
  const createNewSession = useCallback(async () => {
    setCurrentSessionId(null);
    setMessages([]);
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
      .select("id, role, content, created_at, metadata, is_proactive")
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

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);

      const tempUserId = `${Date.now()}-user`;
      const optimisticUser: ChatMessage = {
        id: tempUserId,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user?.id) {
          setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
          throw new Error("请先登录后再发送消息。");
        }

        const response = await sendChatMessage(trimmed, currentSessionId);

        setCurrentSessionId(response.session_id);
        await loadSession(response.session_id);
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
        const message = e instanceof Error ? e.message : "发送失败，请稍后重试。";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [currentSessionId, isLoading, loadSession],
  );

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
