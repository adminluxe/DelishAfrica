import React from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from "expo-router";
import TouchTrace from "../ui/_debug/TouchTrace";

export default function RootLayout() {
  return (
    <TouchTrace label="client">
<Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
      }}
    />
    </TouchTrace>
  );
}
