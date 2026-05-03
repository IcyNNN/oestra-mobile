/** Reference sent to Edge Function after uploading to Storage */
export interface ChatAttachmentRef {
  storage_path: string;
  file_name: string;
  mime_type: string;
  kind: "image" | "file";
}

/** Pending pick before upload */
export interface PendingAttachment {
  uri: string;
  file_name: string;
  mime_type: string;
  kind: "image" | "file";
}

/** Stored on chat_messages.metadata.attachments; signed_url added client-side for display */
export interface ChatAttachmentMeta extends ChatAttachmentRef {
  signed_url?: string;
}
