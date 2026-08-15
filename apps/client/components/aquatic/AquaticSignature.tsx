import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type AquaticSignatureProps = {
  children: React.ReactNode;
  reduceMotion?: boolean;
};

/**
 * DelishAfrica Aquatic Signature — Client pilot.
 *
 * Performance contract:
 * - no native dependency;
 * - transform/opacity animation only;
 * - all atmosphere layers ignore touch input;
 * - Reduce Motion produces a calm static composition;
 * - product content always renders above the atmosphere.
 */
export function AquaticSignature({
  children,
  reduceMotion = false,
}: AquaticSignatureProps) {
  const drift = useRef(new Animated.Value(0)).current;
  const tide = useRef(new Animated.Value(0)).current;
  const rain = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    drift.stopAnimation();
    tide.stopAnimation();
    rain.stopAnimation();

    if (reduceMotion) {
      drift.setValue(0.42);
      tide.setValue(0.34);
      rain.setValue(0.18);
      return undefined;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 9800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 9800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const tideLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tide, {
          toValue: 1,
          duration: 6400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(tide, {
          toValue: 0,
          duration: 6400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const rainLoop = Animated.loop(
      Animated.timing(rain, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    driftLoop.start();
    tideLoop.start();
    rainLoop.start();

    return () => {
      driftLoop.stop();
      tideLoop.stop();
      rainLoop.stop();
    };
  }, [drift, rain, reduceMotion, tide]);

  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-34, 34],
  });
  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -8],
  });
  const counterDriftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -18],
  });
  const counterDriftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-7, 7],
  });
  const tideScale = tide.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.08],
  });
  const tideOpacity = tide.interpolate({
    inputRange: [0, 1],
    outputRange: [0.24, 0.48],
  });
  const rainY = rain.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 180],
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
            styles.surfaceHalo,
            {
              opacity: tideOpacity,
              transform: [
                { translateX: driftX },
                { translateY: driftY },
                { scale: tideScale },
                { rotate: "-12deg" },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.currentRing,
            {
              transform: [
                { translateX: counterDriftX },
                { translateY: counterDriftY },
                { scale: tideScale },
                { rotate: "18deg" },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.causticBand,
            {
              opacity: tide.interpolate({
                inputRange: [0, 1],
                outputRange: [0.16, 0.34],
              }),
              transform: [{ translateX: driftX }, { rotate: "-8deg" }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.rainVeil,
            {
              opacity: reduceMotion ? 0.12 : 0.22,
              transform: [{ translateY: rainY }, { rotate: "8deg" }],
            },
          ]}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.rainThread,
                {
                  left: 28 + index * 42,
                  top: index % 2 === 0 ? 0 : 64,
                  height: 110 + (index % 3) * 34,
                  opacity: 0.24 + (index % 4) * 0.08,
                },
              ]}
            />
          ))}
        </Animated.View>

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
    backgroundColor: "#061713",
  },
  depth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#061713",
  },
  deepCurrent: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 999,
    left: -280,
    top: 260,
    backgroundColor: "rgba(6, 45, 54, 0.72)",
  },
  surfaceHalo: {
    position: "absolute",
    width: 470,
    height: 210,
    borderRadius: 999,
    top: -82,
    right: -132,
    backgroundColor: "rgba(108, 231, 223, 0.20)",
    borderWidth: 1,
    borderColor: "rgba(189, 255, 245, 0.20)",
    shadowColor: "#8CF7EA",
    shadowOpacity: 0.25,
    shadowRadius: 28,
  },
  currentRing: {
    position: "absolute",
    width: 430,
    height: 430,
    borderRadius: 999,
    left: -210,
    top: 32,
    borderWidth: 1,
    borderColor: "rgba(111, 221, 231, 0.16)",
    backgroundColor: "rgba(25, 104, 113, 0.09)",
  },
  causticBand: {
    position: "absolute",
    width: 520,
    height: 76,
    borderRadius: 999,
    right: -190,
    top: 238,
    backgroundColor: "rgba(205, 255, 239, 0.20)",
  },
  rainVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  rainThread: {
    position: "absolute",
    width: 1,
    borderRadius: 999,
    backgroundColor: "rgba(203, 252, 255, 0.62)",
  },
  surfaceLine: {
    position: "absolute",
    left: 22,
    right: 22,
    top: 18,
    height: 1,
    backgroundColor: "rgba(204, 255, 244, 0.18)",
  },
  depthVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 10, 12, 0.24)",
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
});
