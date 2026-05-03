import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Paperclip, Send, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { VoiceTextInput } from "../ui/VoiceTextInput";

import type { PendingAttachment } from "../../types/chatAttachment";

interface ChatInputProps {
  onSend: (text: string, pending: PendingAttachment[]) => Promise<void> | void;
  loading?: boolean;
  placeholder?: string;
}

const MAX_ATTACHMENTS = 5;

export function ChatInput({
  onSend,
  loading = false,
  placeholder = "说点什么或添加附件…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);

  const handleSend = async () => {
    const content = value.trim();
    if ((!content && pending.length === 0) || loading) return;
    setValue("");
    const toSend = pending;
    setPending([]);
    await onSend(content, toSend);
  };

  const pickImage = async () => {
    if (pending.length >= MAX_ATTACHMENTS) {
      Alert.alert("数量上限", `最多同时 ${MAX_ATTACHMENTS} 个附件。`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("需要相册权限", "请在系统设置中允许 Oestra 访问照片。");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setPending((p) => [
      ...p,
      {
        uri: a.uri,
        file_name: a.fileName ?? "image.jpg",
        mime_type: a.mimeType ?? "image/jpeg",
        kind: "image",
      },
    ]);
  };

  const pickFile = async () => {
    if (pending.length >= MAX_ATTACHMENTS) {
      Alert.alert("数量上限", `最多同时 ${MAX_ATTACHMENTS} 个附件。`);
      return;
    }
    const r = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setPending((p) => [
      ...p,
      {
        uri: a.uri,
        file_name: a.name,
        mime_type: a.mimeType ?? "application/octet-stream",
        kind: "file",
      },
    ]);
  };

  return (
    <View className="border-t border-oestra-mist bg-oestra-cream px-4 py-3">
      {pending.length > 0 ? (
        <ScrollView horizontal className="mb-2" showsHorizontalScrollIndicator={false}>
          {pending.map((item, idx) => (
            <View
              key={`${item.uri}-${idx}`}
              className="mr-2 flex-row items-center rounded-full border border-oestra-mist bg-white px-3 py-1"
            >
              <Text className="max-w-[140px] font-sans text-xs text-oestra-text" numberOfLines={1}>
                {item.kind === "image" ? "图片" : "文件"} · {item.file_name}
              </Text>
              <Pressable
                hitSlop={8}
                onPress={() => setPending((p) => p.filter((_, i) => i !== idx))}
                className="ml-1"
              >
                <X size={14} color="#6B5A7A" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View className="flex-row items-center rounded-2xl border border-oestra-mist bg-white px-3 py-2">
        <Pressable
          onPress={() => {
            Alert.alert("添加附件", "", [
              { text: "相册图片", onPress: () => void pickImage() },
              { text: "文件（CSV / PDF / 文本等）", onPress: () => void pickFile() },
              { text: "取消", style: "cancel" },
            ]);
          }}
          disabled={loading}
          className="mr-1 p-2"
          accessibilityLabel="添加附件"
        >
          <Paperclip size={20} color="#3D2B4E" />
        </Pressable>
        <VoiceTextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          multiline
          editable={!loading}
          className="max-h-28 flex-1 border-0 bg-transparent px-0 py-0"
        />
        <Pressable
          onPress={() => void handleSend()}
          disabled={(!value.trim() && pending.length === 0) || loading}
          className="h-10 w-10 items-center justify-center rounded-full bg-oestra-purple disabled:opacity-50"
        >
          <Send size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}
