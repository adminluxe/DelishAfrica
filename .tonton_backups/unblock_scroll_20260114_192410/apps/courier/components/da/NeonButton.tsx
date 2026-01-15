import React from "react";
import { Pressable, Text, ActivityIndicator, ViewStyle } from "react-native";
import { DA } from "./theme";

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "accent" | "ghost";
  style?: ViewStyle;
};

export function NeonButton({ label, onPress, loading, disabled, tone = "accent", style }: Props) {
  const isDisabled = !!disabled || !!loading;

  const bg =
    tone === "ghost"
      ? "rgba(255,255,255,0.10)"
      : DA.accent;

  const border =
    tone === "ghost"
      ? DA.stroke
      : "rgba(255,255,255,0.10)";

  const textColor =
    tone === "ghost"
      ? DA.text
      : "#07101B";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ([
        {
          height: tone === "ghost" ? 46 : 54,
          borderRadius: tone === "ghost" ? 16 : 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          opacity: isDisabled ? 0.55 : (pressed ? 0.85 : 1),
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        style,
      ])}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={{ color: textColor, fontSize: 16, fontWeight: "900", letterSpacing: 0.3 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
