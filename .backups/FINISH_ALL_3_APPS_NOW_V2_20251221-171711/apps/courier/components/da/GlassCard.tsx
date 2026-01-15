import React from "react";
import { View, ViewProps } from "react-native";
import { DA } from "./theme";

export function GlassCard({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: DA.card,
          borderColor: DA.stroke,
          borderWidth: 1,
          borderRadius: DA.radius.xl,
          padding: DA.space.md,
        },
        style,
      ]}
    />
  );
}
