import React from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from "expo-router";
import TouchTrace from "../ui/_debug/TouchTrace";

export default function RootLayout() {
  return (
    <TouchTrace label="courier">
<Stack
      
      "
      "screenOptions={{ sceneContainerStyle: { flex: 1 }, "
     contentStyle: { flex: 1 }, "
    
        headerShown: false,
        animation: "fade",
      }}
    />
    </TouchTrace>
  );
}
