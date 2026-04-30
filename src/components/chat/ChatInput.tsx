import { Send } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { VoiceTextInput } from "../ui/VoiceTextInput";

interface ChatInputProps {
  onSend: (text: string) => Promise<void> | void;
  loading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  loading = false,
  placeholder = "说点什么...",
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSend = async () => {
    const content = value.trim();
    if (!content || loading) return;
    setValue("");
    await onSend(content);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={8}
    >
      <View className="border-t border-oestra-mist bg-oestra-cream px-4 py-3">
        <View className="flex-row items-center rounded-2xl border border-oestra-mist bg-white px-3 py-2">
          <VoiceTextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            multiline
            editable={!loading}
            className="max-h-28 flex-1 border-0 bg-transparent px-0 py-0"
          />
          <Pressable
            onPress={handleSend}
            disabled={!value.trim() || loading}
            className="h-10 w-10 items-center justify-center rounded-full bg-oestra-purple disabled:opacity-50"
          >
            <Send size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
