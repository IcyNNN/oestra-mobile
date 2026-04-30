import { Tabs } from "expo-router";
import { Home, MessageCircle, User, Waves } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#3D2B4E",
        tabBarInactiveTintColor: "#6B6770",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E8E4DD",
          borderTopWidth: 1,
          height: 82,
          paddingTop: 8,
          paddingBottom: 16,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: "Inter_500Medium",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "今天",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "对话",
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          title: "旅程",
          tabBarIcon: ({ color, size }) => <Waves color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "我的",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
