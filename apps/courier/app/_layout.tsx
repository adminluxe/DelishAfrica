import React from "react";
import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import * as WebBrowser from "expo-web-browser";
import { View as DAWaterRootView } from "react-native";
import { GlobalWaterAtmosphere as DAGlobalWaterAtmosphere } from "../ui/water/GlobalWaterAtmosphere";


WebBrowser.maybeCompleteAuthSession();

const COURIER_BOOT_BACKGROUND = "#00140B";
void SystemUI.setBackgroundColorAsync(COURIER_BOOT_BACKGROUND);

export default function RootLayout() {
  return (<DAWaterRootView style={{ flex: 1 }} collapsable={false}>
        {/* DA_GLOBAL_H2O_S10O_ROOT */}
        {(
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: COURIER_BOOT_BACKGROUND },
      }}
    />
  )}
        <DAGlobalWaterAtmosphere />
      </DAWaterRootView>);
}
