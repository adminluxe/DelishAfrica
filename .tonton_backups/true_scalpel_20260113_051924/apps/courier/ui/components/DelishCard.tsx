import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "../hooks/useTheme";

export default function DelishCard({ style, ...rest }: ViewProps) {
  const T = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: T.colors.card,
          borderRadius: T.radius.xl,
          borderWidth: 1,
          borderColor: T.colors.border,
          padding: T.space.lg,
          ...T.shadow.deep,
        },
        style,
      ]}
    />
  );
}
