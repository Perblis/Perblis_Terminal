import { Tabs } from "expo-router";
import { tokens } from "@terminal/tokens";

import { HiresIcon, MapIcon, MessagesIcon, ProfileIcon } from "../../components/ui/tab-icons";
import { useConversations } from "../../lib/queries";

export default function TabsLayout() {
  const { data: conversations } = useConversations();
  const unread = conversations?.unread_total ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Fixed ink shell (8A): the tab bar is a brand plate in both themes —
        // surface-inverse would flip it to paper in dark. Inactive tint is
        // ink-400 (≥4.5:1 on ink-900); active stays amber.
        tabBarActiveTintColor: tokens.color.colorAmber500,
        tabBarInactiveTintColor: tokens.color.colorInk400,
        tabBarStyle: {
          backgroundColor: tokens.color.colorInk900,
          borderTopColor: tokens.color.colorInk700,
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
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <MessagesIcon color={color} />,
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }}
      />
    </Tabs>
  );
}
