import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { nativewindVars } from "@terminal/tokens";

import { HiresIcon, MapIcon, MessagesIcon, ProfileIcon } from "../../components/ui/tab-icons";

export default function TabsLayout() {
  const scheme = useColorScheme();
  const theme = nativewindVars[scheme === "dark" ? "dark" : "light"];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme["--surface-brand"],
        tabBarInactiveTintColor: theme["--text-tertiary"],
        tabBarStyle: {
          backgroundColor: theme["--surface-inverse"],
          borderTopColor: theme["--border-strong"],
        },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Map", tabBarIcon: ({ color }) => <MapIcon color={color} /> }}
      />
      <Tabs.Screen
        name="hires"
        options={{ title: "Hires", tabBarIcon: ({ color }) => <HiresIcon color={color} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: "Messages", tabBarIcon: ({ color }) => <MessagesIcon color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }}
      />
    </Tabs>
  );
}
