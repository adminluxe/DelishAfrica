import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";

type MotionMapEntranceProps = {
  children: React.ReactNode;
  direction: "top" | "bottom";
  delay?: number;
  duration?: number;
};

export function MotionMapEntrance({
  children,
  direction,
  delay = 0,
  duration = 360,
}: MotionMapEntranceProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted) return;

        if (reduceMotion) {
          progress.setValue(1);
          return;
        }

        animation = Animated.timing(progress, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });

        animation.start();
      })
      .catch(() => {
        if (!mounted) return;
        progress.setValue(1);
      });

    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [delay, duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [direction === "top" ? -18 : 24, 0],
  });

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});
