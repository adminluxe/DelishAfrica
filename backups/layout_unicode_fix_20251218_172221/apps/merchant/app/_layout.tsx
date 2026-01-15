import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Screen } from "../components/da/Screen";
import { DA } from "../components/da/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Screen padded={false} topOffset={10} style={{ backgroundColor: DA.bg }}>
        <Stack
          screenOptions={{headerTitle: 'DelishAfrica',

    headerBackTitleVisible: false,
            headerTransparent: true,
            headerTintColor: '#D4AF37',
            headerTitleStyle: { fontWeight: '900', letterSpacing: 0.6, color: '#D4AF37' },
            contentStyle: { backgroundColor: DA.bg },
      headerTitleAlign: 'center',
    }}
        />
    <Stack.Screen name="index" options={{ title: \"DelishAfrica" }} />
      </Screen>
    </SafeAreaProvider>
  );
}
