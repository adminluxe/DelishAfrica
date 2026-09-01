import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import * as WebBrowser from "expo-web-browser";
import { hydrateCartFromStorage } from "../utils/daCart";
import { View as DAWaterRootView } from "react-native";
import { GlobalWaterAtmosphere as DAGlobalWaterAtmosphere } from "../ui/water/GlobalWaterAtmosphere";


WebBrowser.maybeCompleteAuthSession();

const CLIENT_BOOT_BACKGROUND = "#051411";
void SystemUI.setBackgroundColorAsync(CLIENT_BOOT_BACKGROUND);

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

  return (<DAWaterRootView style={{ flex: 1 }} collapsable={false}>
        {/* DA_GLOBAL_H2O_S10O_ROOT */}
        {(
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: CLIENT_BOOT_BACKGROUND }}>
      {cartReady ? (
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: CLIENT_BOOT_BACKGROUND },
          }}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: CLIENT_BOOT_BACKGROUND }} />
      )}
    </GestureHandlerRootView>
  )}
        <DAGlobalWaterAtmosphere />
      </DAWaterRootView>);
}
