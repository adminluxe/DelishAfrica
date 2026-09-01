import { Stack } from "expo-router";
import * as SystemUI from "expo-system-ui";
import { View as DAWaterRootView } from "react-native";
import { GlobalWaterAtmosphere as DAGlobalWaterAtmosphere } from "../ui/water/GlobalWaterAtmosphere";


const MERCHANT_BOOT_BACKGROUND = "#120804";
void SystemUI.setBackgroundColorAsync(MERCHANT_BOOT_BACKGROUND);

export default function RootLayout() {
  return (<DAWaterRootView style={{ flex: 1 }} collapsable={false}>
        {/* DA_GLOBAL_H2O_S10O_ROOT */}
        {(
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: MERCHANT_BOOT_BACKGROUND },
      }}
    />
  )}
        <DAGlobalWaterAtmosphere />
      </DAWaterRootView>);
}
