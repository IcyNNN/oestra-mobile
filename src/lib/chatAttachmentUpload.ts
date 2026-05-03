import { supabase } from "./supabase";

import type { ChatAttachmentRef, PendingAttachment } from "../types/chatAttachment";

function sanitizeSegment(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 120) || "file";
}

function randomObjectId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Upload picked files to private bucket `chat-attachments/{userId}/{uuid}_{name}`.
 */
export async function uploadPendingAttachments(
  userId: string,
  pending: PendingAttachment[],
): Promise<ChatAttachmentRef[]> {
  const out: ChatAttachmentRef[] = [];
  for (const p of pending) {
    const safe = sanitizeSegment(p.file_name);
    const storage_path = `${userId}/${randomObjectId()}_${safe}`;

    const res = await fetch(p.uri);
    const blob = await res.blob();

    const { error } = await supabase.storage.from("chat-attachments").upload(storage_path, blob, {
      contentType: p.mime_type || "application/octet-stream",
      upsert: false,
    });

    if (error) {
      throw new Error(error.message || "附件上传失败");
    }

    out.push({
      storage_path,
      file_name: p.file_name,
      mime_type: p.mime_type || blob.type || "application/octet-stream",
      kind: p.kind,
    });
  }
  return out;
}

export async function createAttachmentSignedUrl(
  storagePath: string,
  expiresSec = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrl(storagePath, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
