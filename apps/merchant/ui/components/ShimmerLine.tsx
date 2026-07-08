import React, { useEffect } from "react";
import { View, ViewStyle, DimensionValue } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";

type Props = { w?: DimensionValue; h?: number; r?: number; style?: ViewStyle };

export default function ShimmerLine({ w = "100%", h = 12, r = 10, style }: Props) {
  const T = useTheme();
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, []);

  const a = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.35 * x.value,
  }));

  return (
    <Animated.View
      style={[
        a,
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: T.colors.shimmerBase,
          borderWidth: 1,
          borderColor: T.colors.border,
        },
        style,
      ]}
    />
  );
}
