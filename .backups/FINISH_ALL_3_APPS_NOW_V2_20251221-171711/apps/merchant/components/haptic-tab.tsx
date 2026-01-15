import React from "react";
import { Pressable } from "react-native";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";

export function HapticTab(props: BottomTabBarButtonProps) {
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    if (props.onPress) {
      // @ts-ignore: onPress event simplifié pour la démo
      props.onPress({} as any);
    }
  };

  return (
    <Pressable onPress={handlePress} style={props.style}>
      {props.children}
    </Pressable>
  );
}
