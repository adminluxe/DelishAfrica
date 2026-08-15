import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

export function MotionAtmosphere() {
  const [reduceMotion, setReduceMotion] = useState(false);

  const primary = useRef(new Animated.Value(0)).current;
  const secondary = useRef(new Animated.Value(0)).current;
  const tertiary = useRef(new Animated.Value(0)).current;

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
    primary.stopAnimation();
    secondary.stopAnimation();
    tertiary.stopAnimation();

    if (reduceMotion) {
      primary.setValue(0.5);
      secondary.setValue(0.5);
      tertiary.setValue(0.5);
      return;
    }

    const primaryLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(primary, {
          toValue: 1,
          duration: 11800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(primary, {
          toValue: 0,
          duration: 11800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const secondaryLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(secondary, {
          toValue: 1,
          duration: 8600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(secondary, {
          toValue: 0,
          duration: 8600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const tertiaryLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tertiary, {
          toValue: 1,
          duration: 13700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tertiary, {
          toValue: 0,
          duration: 13700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    primaryLoop.start();
    secondaryLoop.start();
    tertiaryLoop.start();

    return () => {
      primaryLoop.stop();
      secondaryLoop.stop();
      tertiaryLoop.stop();
    };
  }, [primary, reduceMotion, secondary, tertiary]);

  const primaryX = primary.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 14],
  });

  const primaryY = primary.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });

  const primaryOpacity = primary.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.42],
  });

  const secondaryX = secondary.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -12],
  });

  const secondaryY = secondary.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -8],
  });

  const secondaryOpacity = secondary.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.30],
  });

  const tertiaryX = tertiary.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 9],
  });

  const tertiaryY = tertiary.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 8],
  });

  const tertiaryOpacity = tertiary.interpolate({
    inputRange: [0, 1],
    outputRange: [0.10, 0.24],
  });

  return (
    <View pointerEvents="none" style={styles.root}>
      <Animated.View
        style={[
          styles.primary,
          {
            opacity: primaryOpacity,
            transform: [
              { translateX: primaryX },
              { translateY: primaryY },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.secondary,
          {
            opacity: secondaryOpacity,
            transform: [
              { translateX: secondaryX },
              { translateY: secondaryY },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.tertiary,
          {
            opacity: tertiaryOpacity,
            transform: [
              { translateX: tertiaryX },
              { translateY: tertiaryY },
            ],
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
  primary: {
    position: "absolute",
    top: 178,
    right: 52,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(244, 185, 92, 0.78)",
    shadowColor: "#F4B95C",
    shadowOpacity: 0.20,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  secondary: {
    position: "absolute",
    top: 448,
    left: 46,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(114, 243, 178, 0.64)",
    shadowColor: "#72F3B2",
    shadowOpacity: 0.16,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  tertiary: {
    position: "absolute",
    top: 694,
    right: 82,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(121, 177, 255, 0.62)",
    shadowColor: "#79B1FF",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
