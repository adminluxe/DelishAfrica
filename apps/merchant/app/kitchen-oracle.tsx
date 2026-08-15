// DA_P2B1_KITCHEN_ORACLE_MOTION_WRAPPER
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import KitchenOracleCore from "./kitchen-oracle-core";

export default function KitchenOracleMotionScreen() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    pulse.stopAnimation();
    orbit.stopAnimation();
    shimmer.stopAnimation();

    if (reduceMotion) {
      pulse.setValue(0.35);
      orbit.setValue(0);
      shimmer.setValue(0.15);
      return undefined;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const orbitLoop = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    orbitLoop.start();
    shimmerLoop.start();

    return () => {
      pulseLoop.stop();
      orbitLoop.stop();
      shimmerLoop.stop();
    };
  }, [orbit, pulse, reduceMotion, shimmer]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.42],
  });
  const rotate = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, 0.2],
  });

  return (
    <View style={styles.root}>
      <KitchenOracleCore />

      <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
        <Animated.View
          style={[
            styles.ambientHalo,
            { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
          ]}
        />
        <Animated.View
          style={[styles.orbitRing, { transform: [{ rotate }] }]}
        >
          <View style={styles.orbitSpark} />
        </Animated.View>
        <Animated.View
          style={[styles.shimmer, { opacity: shimmerOpacity }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  ambientHalo: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    top: 90,
    right: -125,
    backgroundColor: "#D86F45",
  },
  orbitRing: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    top: 180,
    left: -120,
    borderWidth: 1,
    borderColor: "rgba(245, 168, 103, 0.28)",
  },
  orbitSpark: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    top: 14,
    left: 118,
    backgroundColor: "#FFC36C",
  },
  shimmer: {
    position: "absolute",
    width: 90,
    height: "140%",
    top: -80,
    left: "48%",
    backgroundColor: "#FFF3D8",
    transform: [{ rotate: "18deg" }],
  },
});
