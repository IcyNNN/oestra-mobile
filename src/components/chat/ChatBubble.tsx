import { Moon } from "lucide-react-native";
import { Image, Text, View } from "react-native";

import type { ChatAttachmentMeta } from "../../types/chatAttachment";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  attachments?: ChatAttachmentMeta[];
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ChatBubble({ role, content, timestamp, attachments }: ChatBubbleProps) {
  const isUser = role === "user";
  return (
    <View className={`mb-3 flex-row ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser ? (
        <View className="mr-2 mt-1 h-8 w-8 items-center justify-center rounded-full bg-oestra-purple">
          <Moon size={14} color="#FFFFFF" />
        </View>
      ) : null}
      <View
        className={`max-w-[80%] px-4 py-3 ${
          isUser
            ? "rounded-2xl rounded-br-md bg-oestra-mist"
            : "rounded-2xl rounded-bl-md bg-white"
        }`}
      >
        {attachments?.length ? (
          <View className="mb-2 gap-2">
            {attachments.map((a) =>
              a.kind === "image" && a.signed_url ? (
                <Image
                  key={a.storage_path}
                  source={{ uri: a.signed_url }}
                  className="h-40 w-full max-w-[240px] rounded-xl"
                  resizeMode="cover"
                  accessibilityLabel={a.file_name}
                />
              ) : (
                <View key={a.storage_path} className="rounded-xl bg-white/60 px-3 py-2">
                  <Text className="font-sans text-xs text-oestra-purple">
                    {a.kind === "image" ? "图片" : "附件"} · {a.file_name}
                  </Text>
                </View>
              ),
            )}
          </View>
        ) : null}
        <Text className="font-sans text-base leading-6 text-oestra-text">{content}</Text>
        {timestamp ? (
          <Text className="mt-1 text-right font-sans text-xs text-oestra-text-light">
            {formatTime(timestamp)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
