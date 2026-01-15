import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../utils/haptics";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
};

export default function DelishButton({ title, onPress, variant = "primary", style, disabled }: Props) {
  const T = useTheme();
  const s = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: disabled ? 0.55 : 1,
  }));

  const bg = variant === "primary" ? T.colors.brand : "transparent";
  const bd = variant === "ghost" ? T.colors.border : "transparent";
  const tx = variant === "primary" ? "#071018" : T.colors.text;

  return (
    <Animated.View style={[aStyle, { borderRadius: T.radius.lg }, style]}>
      <Pressable
        disabled={disabled}
        onPress={async () => {
          await hapticLight();
          onPress?.();
        }}
        onPressIn={() => (s.value = withTiming(0.98, { duration: 90 }))}
        onPressOut={() => (s.value = withTiming(1, { duration: 130 }))}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: T.radius.lg,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: bd,
          alignItems: "center",
          justifyContent: "center",
          ...T.shadow.soft,
        }}
      >
        <Text style={{ color: tx, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 }}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}
