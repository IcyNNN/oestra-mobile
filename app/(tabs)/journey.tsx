import { ScrollView, Text, View } from "react-native";

const phases = [
  { label: "经期", color: "bg-oestra-blush" },
  { label: "卵泡期", color: "bg-[#C8B9D6]" },
  { label: "排卵期", color: "bg-[#A78DBF]" },
  { label: "黄体期", color: "bg-oestra-purple" },
];

export default function JourneyScreen() {
  const unlockedChapters = 0;
  const remainDays = 5;

  return (
    <ScrollView className="flex-1 bg-oestra-cream" contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Text className="pt-10 font-serif-medium text-4xl text-oestra-purple">旅程</Text>

      <View className="mt-8 rounded-3xl bg-white p-5">
        <Text className="font-sans-medium text-sm text-oestra-text-light">周期时间线</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
          <View className="flex-row gap-3">
            {phases.map((phase, index) => (
              <View key={phase.label} className="items-center">
                <View className={`h-12 w-20 rounded-2xl ${phase.color}`} />
                <Text className="mt-2 font-sans text-xs text-oestra-text-light">{phase.label}</Text>
                {index === 1 ? (
                  <View className="mt-1 rounded-full bg-oestra-blush px-2 py-1">
                    <Text className="font-sans text-[10px] text-white">当前位置</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className="mt-6 rounded-3xl bg-white p-5">
        <Text className="font-serif-medium text-2xl text-oestra-purple">自我之书</Text>
        {unlockedChapters === 0 ? (
          <Text className="mt-4 font-sans text-base leading-7 text-oestra-text">
            你的故事正在被书写...（还需{remainDays}天解锁第一章）
          </Text>
        ) : (
          <View className="mt-4 gap-2">
            <Text className="font-sans text-base text-oestra-text">第1章：身体的潮汐</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
