import React from "react";
import { TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPress, children, ...rest } = props;

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      );
    } catch (e) {
      console.warn("[HapticTab] Erreur haptics", e);
    }

    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      {...rest}
      activeOpacity={0.9}
      onPress={handlePress}
    >
      {children}
    </TouchableOpacity>
  );
}

export default HapticTab;
