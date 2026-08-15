import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

export function MotionLivingLight() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const sweep = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(Boolean(enabled))
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    sweep.stopAnimation();
    glow.stopAnimation();

    if (reduceMotion) {
      sweep.setValue(0.5);
      glow.setValue(0);
      return;
    }

    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 9400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 9400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 6100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 6100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    sweepLoop.start();
    glowLoop.start();

    return () => {
      sweepLoop.stop();
      glowLoop.stop();
    };
  }, [glow, reduceMotion, sweep]);

  const sweepTranslateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-130, 170],
  });

  const sweepTranslateY = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [24, -18],
  });

  const sweepOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.10, 0.22],
  });

  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.05],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View
        style={[
          styles.sweep,
          {
            opacity: sweepOpacity,
            transform: [
              { translateX: sweepTranslateX },
              { translateY: sweepTranslateY },
              { rotate: "-18deg" },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  sweep: {
    position: "absolute",
    top: 80,
    left: -120,
    width: 220,
    height: 520,
    borderRadius: 999,
    backgroundColor: "rgba(110, 220, 255, 0.10)",
  },
  glow: {
    position: "absolute",
    right: -94,
    bottom: 116,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(114, 243, 178, 0.10)",
  },
});
