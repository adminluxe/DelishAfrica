import React from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from "expo-router";
export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    />);
}
