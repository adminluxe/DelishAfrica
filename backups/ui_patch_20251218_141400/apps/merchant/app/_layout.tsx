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
          screenOptions={{headerTitle: "DelishAfrica",

    headerBackTitleVisible: false,
            headerTransparent: true,
            headerTintColor: DA.text,
            headerTitleStyle: { fontWeight: "800" },
            contentStyle: { backgroundColor: DA.bg },
          }}
        />
      </Screen>
    </SafeAreaProvider>
  );
}
