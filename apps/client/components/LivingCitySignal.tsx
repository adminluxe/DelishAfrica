// DELISHAFRICA_LIVING_CITIES_V1
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";

type LivingCitySignalProps = {
  city: string;
  score: number;
  state?: string;
  size?: number;
  animate?: boolean;
  compact?: boolean;
};

type SignalTone = {
  core: string;
  text: string;
  label: string;
  ring: string;
  glow: string;
};

function signalTone(state: string | undefined): SignalTone {
  if (state === "LIVE") {
    return {
      core: "#50D18D",
      text: "#062013",
      label: "rgba(6,32,19,0.56)",
      ring: "rgba(80,209,141,0.32)",
      glow: "rgba(80,209,141,0.13)",
    };
  }
  if (state === "READY") {
    return {
      core: "#E7BD72",
      text: "#17251C",
      label: "rgba(23,37,28,0.56)",
      ring: "rgba(231,189,114,0.34)",
      glow: "rgba(231,189,114,0.13)",
    };
  }
  if (state === "RISING") {
    return {
      core: "#9EDFFF",
      text: "#0B2533",
      label: "rgba(11,37,51,0.56)",
      ring: "rgba(158,223,255,0.34)",
      glow: "rgba(158,223,255,0.13)",
    };
  }
  return {
    core: "#E8D6B4",
    text: "#17251C",
    label: "rgba(23,37,28,0.50)",
    ring: "rgba(232,214,180,0.24)",
    glow: "rgba(232,214,180,0.10)",
  };
}

export default function LivingCitySignal({
  city,
  score,
  state,
  size = 92,
  animate = true,
  compact = false,
}: LivingCitySignalProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const breath = useRef(new Animated.Value(0)).current;
  const tone = useMemo(() => signalTone(state), [state]);
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const coreSize = compact ? size * 0.72 : size * 0.68;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(Boolean(value));
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      setReduceMotion(Boolean(value));
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    breath.stopAnimation();
    breath.setValue(0);
    if (!animate || reduceMotion) return undefined;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2300,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2300,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, breath, reduceMotion]);

  const outerScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const innerScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.03],
  });
  const ringOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.74],
  });

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${city}, indice de préparation ${boundedScore} sur 100`}
      style={[styles.stage, { width: size, height: size }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: tone.glow,
            borderColor: tone.ring,
            opacity: animate && !reduceMotion ? ringOpacity : 0.44,
            transform: [{ scale: animate && !reduceMotion ? outerScale : 1 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.core,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            backgroundColor: tone.core,
            transform: [{ scale: animate && !reduceMotion ? innerScale : 1 }],
          },
        ]}
      >
        <Text style={[styles.value, compact && styles.valueCompact, { color: tone.text }]}>{boundedScore}</Text>
        {!compact ? <Text style={[styles.label, { color: tone.label }]}>/100</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    borderWidth: 1,
  },
  core: {
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "900",
  },
  valueCompact: {
    fontSize: 20,
    lineHeight: 23,
  },
  label: {
    fontSize: 8,
    fontWeight: "900",
    marginTop: -1,
  },
});
