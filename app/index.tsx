import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "../src/lib/auth";

export default function IndexScreen() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-oestra-cream px-8">
        <Text className="font-serif-bold text-5xl text-oestra-purple">Oestra</Text>
        <Text className="mt-2 font-sans text-base text-oestra-text-light">a quiet revolution</Text>
        <ActivityIndicator size="small" color="#3D2B4E" className="mt-8" />
      </View>
    );
  }

  if (status === "authenticated") {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
