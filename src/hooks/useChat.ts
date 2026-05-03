import { useCallback, useEffect, useState } from "react";

import { sendChatMessage } from "../lib/anthropic";
import { createAttachmentSignedUrl, uploadPendingAttachments } from "../lib/chatAttachmentUpload";
import { supabase } from "../lib/supabase";

import type { ChatAttachmentMeta } from "../types/chatAttachment";
import type { PendingAttachment } from "../types/chatAttachment";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: ChatAttachmentMeta[];
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, pendingAttachments?: PendingAttachment[]) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  currentSessionId: string | null;
}

async function enrichAttachmentsWithUrls(msg: ChatMessage): Promise<ChatMessage> {
  if (msg.role !== "user" || !msg.attachments?.length) return msg;
  const enriched = await Promise.all(
    msg.attachments.map(async (a) => {
      if (a.kind !== "image") return a;
      const signed_url = await createAttachmentSignedUrl(a.storage_path);
      return { ...a, signed_url: signed_url ?? undefined };
    }),
  );
  return { ...msg, attachments: enriched };
}

function rowToChatMessage(row: {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: unknown;
}): ChatMessage {
  const meta = row.metadata as { attachments?: ChatAttachmentMeta[] } | null | undefined;
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.created_at,
    attachments: meta?.attachments,
  };
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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

    const mapped = await Promise.all(list.map((item) => enrichAttachmentsWithUrls(rowToChatMessage(item as never))));
    setMessages(mapped);
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
    async (content: string, pendingAttachments?: PendingAttachment[]) => {
      const trimmed = content.trim();
      const hasFiles = Boolean(pendingAttachments?.length);
      if ((!trimmed && !hasFiles) || isLoading) return;

      setIsLoading(true);
      setError(null);

      const displayText = trimmed || "（见附件）";
      const tempUserId = `${Date.now()}-user`;
      const optimisticUser: ChatMessage = {
        id: tempUserId,
        role: "user",
        content: displayText,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticUser]);

      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData.user?.id;
        if (!uid) {
          setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
          throw new Error("请先登录后再发送消息。");
        }

        let refs = undefined;
        if (hasFiles && pendingAttachments) {
          refs = await uploadPendingAttachments(uid, pendingAttachments);
        }

        const textForApi = trimmed || "（见附件）";
        const response = await sendChatMessage(textForApi, currentSessionId, refs);

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
