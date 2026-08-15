import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type CourierAquaticSignatureProps = {
  children: React.ReactNode;
  reduceMotion?: boolean;
};

/**
 * DelishAfrica Aquatic Signature — Courier pilot.
 *
 * Product language:
 * - directional current for route momentum;
 * - fine rain and wake lines for terrain presence;
 * - emerald navigation corridor that preserves the Courier identity;
 * - calm static fallback when Reduce Motion is enabled.
 *
 * Performance contract:
 * - no native dependency;
 * - transform/opacity animation only;
 * - decorative layers never intercept touch input;
 * - useNativeDriver and non-interaction loops;
 * - all mission, map, ETA, presence, and dispatch content stays above the atmosphere.
 */
export function CourierAquaticSignature({
  children,
  reduceMotion = false,
}: CourierAquaticSignatureProps) {
  const current = useRef(new Animated.Value(0)).current;
  const rain = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    current.stopAnimation();
    rain.stopAnimation();
    pulse.stopAnimation();

    if (reduceMotion) {
      current.setValue(0.42);
      rain.setValue(0.18);
      pulse.setValue(0.34);
      return undefined;
    }

    const currentLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(current, {
          toValue: 1,
          duration: 7600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(current, {
          toValue: 0,
          duration: 7600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const rainLoop = Animated.loop(
      Animated.timing(rain, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 5200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    currentLoop.start();
    rainLoop.start();
    pulseLoop.start();

    return () => {
      currentLoop.stop();
      rainLoop.stop();
      pulseLoop.stop();
    };
  }, [current, pulse, rain, reduceMotion]);

  const currentX = current.interpolate({
    inputRange: [0, 1],
    outputRange: [-34, 40],
  });
  const currentY = current.interpolate({
    inputRange: [0, 1],
    outputRange: [12, -16],
  });
  const counterX = current.interpolate({
    inputRange: [0, 1],
    outputRange: [24, -30],
  });
  const rainY = rain.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 220],
  });
  const corridorScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.06],
  });
  const corridorOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.34],
  });

  return (
    <View style={styles.root}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <View style={styles.depth} />
        <View style={styles.deepCurrent} />

        <Animated.View
          style={[
            styles.routeCorridor,
            {
              opacity: corridorOpacity,
              transform: [
                { translateX: currentX },
                { translateY: currentY },
                { scale: corridorScale },
                { rotate: "-18deg" },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.wakeRing,
            {
              transform: [
                { translateX: counterX },
                { scale: corridorScale },
                { rotate: "12deg" },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.flowBand,
            {
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.12, 0.28],
              }),
              transform: [{ translateX: currentX }, { rotate: "-10deg" }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.rainField,
            {
              opacity: reduceMotion ? 0.08 : 0.18,
              transform: [{ translateY: rainY }, { rotate: "11deg" }],
            },
          ]}
        >
          {Array.from({ length: 9 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.rainThread,
                {
                  left: 18 + index * 44,
                  top: index % 2 === 0 ? 12 : 76,
                  height: 96 + (index % 4) * 30,
                  opacity: 0.18 + (index % 5) * 0.06,
                },
              ]}
            />
          ))}
        </Animated.View>

        <View style={styles.navigationLine} />
        <View style={styles.surfaceLine} />
        <View style={styles.depthVignette} />
      </View>

      <View style={styles.content} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#001109",
  },
  depth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#001109",
  },
  deepCurrent: {
    position: "absolute",
    width: 570,
    height: 570,
    borderRadius: 999,
    left: -310,
    top: 250,
    backgroundColor: "rgba(3, 49, 40, 0.78)",
  },
  routeCorridor: {
    position: "absolute",
    width: 500,
    height: 210,
    borderRadius: 999,
    top: -76,
    right: -170,
    backgroundColor: "rgba(76, 236, 165, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(154, 255, 205, 0.19)",
    shadowColor: "#75EFA4",
    shadowOpacity: 0.20,
    shadowRadius: 26,
  },
  wakeRing: {
    position: "absolute",
    width: 470,
    height: 470,
    borderRadius: 999,
    left: -235,
    top: 64,
    borderWidth: 1,
    borderColor: "rgba(107, 236, 210, 0.15)",
    backgroundColor: "rgba(22, 109, 91, 0.08)",
  },
  flowBand: {
    position: "absolute",
    width: 580,
    height: 70,
    borderRadius: 999,
    right: -240,
    top: 300,
    backgroundColor: "rgba(180, 255, 224, 0.18)",
  },
  rainField: {
    ...StyleSheet.absoluteFillObject,
  },
  rainThread: {
    position: "absolute",
    width: 1,
    borderRadius: 999,
    backgroundColor: "rgba(196, 255, 235, 0.56)",
  },
  navigationLine: {
    position: "absolute",
    right: 20,
    top: 96,
    bottom: 56,
    width: 1,
    backgroundColor: "rgba(117, 239, 164, 0.12)",
  },
  surfaceLine: {
    position: "absolute",
    left: 22,
    right: 22,
    top: 18,
    height: 1,
    backgroundColor: "rgba(195, 255, 229, 0.16)",
  },
  depthVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 8, 6, 0.24)",
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
});
