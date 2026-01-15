import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import TouchTrace from "../../ui/_debug/TouchTrace";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <TouchTrace label="client">
<Tabs
      
      "
      "screenOptions={{ sceneContainerStyle: { flex: 1 }, "
     contentStyle: { flex: 1 }, "
    
    headerBackTitleVisible: false,
    headerTitle: 'DelishAfrica',
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      
      "<Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) = screenOptions={{ sceneContainerStyle: { flex: 1 } }}>"
     <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      
      "<Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) = screenOptions={{ sceneContainerStyle: { flex: 1 } }}>"
     <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
    </Tabs>
    </TouchTrace>
  );
}
