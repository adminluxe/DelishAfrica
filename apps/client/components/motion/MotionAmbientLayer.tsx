import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

type MotionAmbientLayerProps = {
  children: React.ReactNode;
  status?: string | null;
};

type AmbientPalette = {
  primary: string;
  secondary: string;
};

function paletteFor(status?: string | null): AmbientPalette {
  const normalized = String(status || "").trim().toLowerCase();

  if (normalized === "pending") {
    return {
      primary: "rgba(244,185,92,0.16)",
      secondary: "rgba(114,243,178,0.08)",
    };
  }

  if (normalized === "accepted") {
    return {
      primary: "rgba(114,243,178,0.14)",
      secondary: "rgba(121,177,255,0.08)",
    };
  }

  if (
    normalized === "ready" ||
    normalized === "courier_proposed" ||
    normalized === "courier_accepted"
  ) {
    return {
      primary: "rgba(84,226,166,0.18)",
      secondary: "rgba(244,185,92,0.09)",
    };
  }

  if (normalized === "picked_up") {
    return {
      primary: "rgba(84,226,166,0.20)",
      secondary: "rgba(121,177,255,0.10)",
    };
  }

  if (normalized === "delivered") {
    return {
      primary: "rgba(114,243,178,0.13)",
      secondary: "rgba(255,255,255,0.06)",
    };
  }

  return {
    primary: "rgba(84,226,166,0.15)",
    secondary: "rgba(121,177,255,0.07)",
  };
}

export function MotionAmbientLayer({
  children,
  status,
}: MotionAmbientLayerProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const breath = useRef(new Animated.Value(0)).current;
  const palette = useMemo(() => paletteFor(status), [status]);

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
    breath.stopAnimation();

    if (reduceMotion) {
      breath.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [breath, reduceMotion]);

  const primaryScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1.015],
  });

  const primaryOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.42],
  });

  const secondaryScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1.01, 0.99],
  });

  const secondaryOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.10, 0.22],
  });

  return (
    <View style={styles.root}>
      {/* DA_P2C1B1_AMBIENT_MOTION_POLISH_RUNTIME_V2_V1 */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.primaryLight,
          {
            backgroundColor: palette.primary,
            opacity: primaryOpacity,
            transform: [{ scale: primaryScale }],
          },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.secondaryLight,
          {
            backgroundColor: palette.secondary,
            opacity: secondaryOpacity,
            transform: [{ scale: secondaryScale }],
          },
        ]}
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderRadius: 24,
  },
  primaryLight: {
    position: "absolute",
    width: 164,
    height: 164,
    borderRadius: 999,
    right: -44,
    top: -52,
  },
  secondaryLight: {
    position: "absolute",
    width: 124,
    height: 124,
    borderRadius: 999,
    left: -54,
    bottom: -62,
  },
  content: {
    position: "relative",
    zIndex: 2,
  },
});
