import { ActivityIndicator, Text, View } from "react-native";

interface LoadingProps {
  text?: string;
}

export function Loading({ text }: LoadingProps) {
  return (
    <View className="items-center justify-center py-6">
      <ActivityIndicator size="small" color="#3D2B4E" />
      {text ? <Text className="mt-2 font-sans text-sm text-oestra-text-light">{text}</Text> : null}
    </View>
  );
}
