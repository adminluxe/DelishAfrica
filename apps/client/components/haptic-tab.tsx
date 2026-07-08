import React from "react";
import { Pressable, type PressableProps, type GestureResponderEvent } from "react-native";
import * as Haptics from "expo-haptics";

export type HapticTabProps = PressableProps & {
  haptics?: boolean;
};

/**
 * HapticTab (stable / React 19 friendly)
 * - uses Pressable to avoid TouchableOpacity ref/type issues
 * - triggers light haptics on press (optional)
 */
export function HapticTab(props: HapticTabProps) {
  const { onPress, haptics = true, ...rest } = props;

  const handlePress = async (e: GestureResponderEvent) => {
    if (haptics) {
      try {
        await Haptics.selectionAsync();
      } catch {
        // ignore (web / simulator / permissions)
      }
    }
    onPress?.(e);
  };

  return <Pressable {...rest} onPress={handlePress} />;
}

export default HapticTab;
