import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { hydrateCartFromStorage } from "../utils/daCart";

WebBrowser.maybeCompleteAuthSession();

const CART_BOOT_BACKGROUND = "#05070C";

export default function RootLayout() {
  const [cartReady, setCartReady] = useState(false);

  useEffect(() => {
    let active = true;
    void hydrateCartFromStorage().finally(() => {
      if (active) setCartReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: CART_BOOT_BACKGROUND }}>
      {cartReady ? (
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: CART_BOOT_BACKGROUND }} />
      )}
    </GestureHandlerRootView>
  );
}
