import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

export function SkeletonLine({ app, h=12, w="100%", r=12, style }: { app: DAApp; h?: number; w?: ViewStyle["width"]; r?: number; style?: ViewStyle; }){
  const t = getDATheme(app);
  const a = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.9, duration: t.motion.slow, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.35, duration: t.motion.slow, useNativeDriver: true }),
      ])
    ).start();
  }, [a, t.motion.slow]);

  return (
    <Animated.View
      style={[
        {
          height: h,
          width: w,
          borderRadius: r,
          backgroundColor: t.colors.surface1,
          opacity: a,
        },
        style,
      ]}
    />
  );
}
