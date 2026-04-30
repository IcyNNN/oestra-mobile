import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function OnboardingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-oestra-cream px-8">
      <Text className="font-serif-medium text-4xl text-oestra-purple">欢迎来到 Oestra</Text>
      <Text className="mt-4 text-center font-sans text-base leading-7 text-oestra-text">
        建档对话将在下一步完善。现在你可以先进入主界面体验核心流程。
      </Text>
      <Pressable
        onPress={() => router.replace("/(tabs)/home")}
        className="mt-10 rounded-2xl bg-oestra-purple px-8 py-4"
      >
        <Text className="font-sans-bold text-base text-white">进入应用</Text>
      </Pressable>
    </View>
  );
}
