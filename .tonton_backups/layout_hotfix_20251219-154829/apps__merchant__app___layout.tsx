import React from "react";
import { Stack } from "expo-router";

/**
 * IMPORTANT (expo-router):
 * - A layout route (_layout.tsx) must NOT declare <Stack.Screen name="index" .../>
 * - Screens are defined by files: app/index.tsx, app/(tabs)/index.tsx, etc.
 */
export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
