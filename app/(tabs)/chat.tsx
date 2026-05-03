import { useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

import { ChatBubble } from "../../src/components/chat/ChatBubble";
import { ChatInput } from "../../src/components/chat/ChatInput";
import { useChat } from "../../src/hooks/useChat";

export default function ChatScreen() {
  const { messages, isLoading, error, sendMessage } = useChat();

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-oestra-cream"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View className="border-b border-oestra-mist px-6 pb-4 pt-14">
        <Text className="font-serif-medium text-3xl text-oestra-purple">对话</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 18 }}>
        {!hasMessages ? (
          <View className="mt-8 rounded-3xl bg-white p-6">
            <Text className="font-sans text-base leading-7 text-oestra-text">
              嗨，我在这里。今天想聊聊什么？
            </Text>
          </View>
        ) : null}

        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.createdAt}
            attachments={message.attachments}
          />
        ))}

        {isLoading ? (
          <View className="mt-2 flex-row items-center">
            <View className="mr-2 h-8 w-8 rounded-full bg-oestra-purple" />
            <View className="rounded-2xl rounded-bl-md bg-white px-4 py-3">
              <ActivityIndicator size="small" color="#3D2B4E" />
            </View>
          </View>
        ) : null}

        {error ? <Text className="mt-2 font-sans text-sm text-oestra-blush">{error}</Text> : null}
      </ScrollView>

      <ChatInput loading={isLoading} onSend={sendMessage} />
    </KeyboardAvoidingView>
  );
}
