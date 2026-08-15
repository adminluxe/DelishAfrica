import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type MotionProgressProps = {
  progress: number;
  label: string;
  reduceMotion: boolean;
};

export function MotionProgress({
  progress,
  label,
  reduceMotion,
}: MotionProgressProps) {
  const progressValue = useRef(new Animated.Value(progress)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const previousProgress = useRef(progress);

  useEffect(() => {
    const changed = previousProgress.current !== progress;
    previousProgress.current = progress;

    progressValue.stopAnimation();
    glow.stopAnimation();

    if (reduceMotion) {
      progressValue.setValue(progress);
      glow.setValue(0);
      return;
    }

    Animated.timing(progressValue, {
      toValue: progress,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (changed) {
      glow.setValue(0);
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [glow, progress, progressValue, reduceMotion]);

  const width = progressValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.9],
  });

  const glowScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Progression de la commande"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(progress * 100),
        text: label,
      }}
      style={styles.track}
    >
      <Animated.View style={[styles.fill, { width }]} />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scaleY: glowScale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "relative",
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.13)",
    marginTop: 14,
  },
  fill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "#72F3B2",
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: "rgba(114,243,178,0.42)",
  },
});
