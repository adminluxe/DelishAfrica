import React from "react";
import { TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

export function HapticTab(props: BottomTabBarButtonProps) {
const { onPress, children, delayLongPress, ...rest } = props as any;

const handlePress = async () => {
try {
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
} catch (e) {
console.warn("[HapticTab] Erreur haptics", e);
}

if (onPress) {
onPress({} as any);
}
};

return (
<TouchableOpacity
{...(rest as any)}
delayLongPress={delayLongPress ?? undefined}
activeOpacity={0.9}
onPress={handlePress}
>
{children}
</TouchableOpacity>
);
}

export default HapticTab;
