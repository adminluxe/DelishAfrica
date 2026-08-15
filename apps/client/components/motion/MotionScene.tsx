import React, { useEffect, useRef, useState } from "react";
import { MotionLivingLight } from "./MotionLivingLight";
import { MotionAtmosphere } from "./MotionAtmosphere";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";

export function MotionScene() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const drift = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

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
    drift.stopAnimation();
    breathe.stopAnimation();

    if (reduceMotion) {
      drift.setValue(0);
      breathe.setValue(0);
      return;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 7200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    driftLoop.start();
    breatheLoop.start();

    return () => {
      driftLoop.stop();
      breatheLoop.stop();
    };
  }, [breathe, drift, reduceMotion]);

  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10],
  });

  const reverseX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  const breatheScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.99, 1.025],
  });

  const breatheOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <View pointerEvents="none" style={styles.scene}>
      <Animated.View
        style={[
          styles.aquaVeil,
          {
            opacity: breatheOpacity,
            transform: [
              { translateX: driftX },
              { translateY: driftY },
              { scale: breatheScale },
              { scaleX: 1.24 },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.aquaDrop,
          {
            transform: [
              { translateX: reverseX },
              { translateY: driftY },
              { scale: breatheScale },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.aquaRipple,
          {
            opacity: breatheOpacity,
            transform: [
              { translateX: reverseX },
              { translateY: driftY },
              { rotate: "-14deg" },
              { scaleX: 1.22 },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.aquaFoam,
          {
            transform: [
              { translateX: driftX },
              { translateY: driftY },
              { scale: breatheScale },
            ],
          },
        ]}
      />

      {/* DA_P2C3_LIVING_LIGHT_ENGINE_RUNTIME_V2_V1 */}
      <MotionLivingLight />

      {/* DA_P2C4_LIVING_ATMOSPHERE_ENGINE_RUNTIME_V2_V1 */}
      <MotionAtmosphere />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  aquaVeil: {
    position: "absolute",
    top: -84,
    right: -132,
    width: 168,
    height: 168,
    borderRadius: 999,
    backgroundColor: "rgba(88, 211, 255, 0.020)",
    borderWidth: 1,
    borderColor: "rgba(200, 242, 255, 0.050)",
  },
  aquaDrop: {
    position: "absolute",
    top: 126,
    left: -34,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.014)",
    borderWidth: 1,
    borderColor: "rgba(210, 242, 255, 0.040)",
  },
  aquaRipple: {
    position: "absolute",
    top: 226,
    right: -28,
    width: 126,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(98, 202, 255, 0.020)",
    borderWidth: 1,
    borderColor: "rgba(220, 245, 255, 0.050)",
  },
  aquaFoam: {
    position: "absolute",
    top: 408,
    left: -118,
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.014)",
    borderWidth: 1,
    borderColor: "rgba(218, 246, 255, 0.038)",
  },
});
