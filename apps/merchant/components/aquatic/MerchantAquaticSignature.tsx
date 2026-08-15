import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

type MerchantAquaticSignatureProps = {
  children: React.ReactNode;
  reduceMotion?: boolean;
};

/**
 * DelishAfrica Aquatic Signature — Merchant pilot.
 *
 * Product language:
 * - deep, quiet water for operational focus;
 * - amber thermal current for kitchen energy;
 * - pressure rings and glass lines for cockpit structure;
 * - steam-like threads instead of the Client rain veil.
 *
 * Performance contract:
 * - no native dependency;
 * - transform/opacity animation only;
 * - decorative layers never intercept touch input;
 * - Reduce Motion produces a calm static composition;
 * - all Merchant business content stays above the atmosphere.
 */
export function MerchantAquaticSignature({
  children,
  reduceMotion = false,
}: MerchantAquaticSignatureProps) {
  const drift = useRef(new Animated.Value(0)).current;
  const pressure = useRef(new Animated.Value(0)).current;
  const steam = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    drift.stopAnimation();
    pressure.stopAnimation();
    steam.stopAnimation();

    if (reduceMotion) {
      drift.setValue(0.44);
      pressure.setValue(0.36);
      steam.setValue(0.16);
      return undefined;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 11200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 11200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const pressureLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pressure, {
          toValue: 1,
          duration: 7200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pressure, {
          toValue: 0,
          duration: 7200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const steamLoop = Animated.loop(
      Animated.timing(steam, {
        toValue: 1,
        duration: 6400,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    driftLoop.start();
    pressureLoop.start();
    steamLoop.start();

    return () => {
      driftLoop.stop();
      pressureLoop.stop();
      steamLoop.stop();
    };
  }, [drift, pressure, reduceMotion, steam]);

  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 28],
  });
  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -10],
  });
  const counterX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -20],
  });
  const pressureScale = pressure.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.07],
  });
  const pressureOpacity = pressure.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.38],
  });
  const steamY = steam.interpolate({
    inputRange: [0, 1],
    outputRange: [210, -210],
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
            styles.thermalHalo,
            {
              opacity: pressureOpacity,
              transform: [
                { translateX: driftX },
                { translateY: driftY },
                { scale: pressureScale },
                { rotate: "-9deg" },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.pressureRing,
            {
              transform: [
                { translateX: counterX },
                { scale: pressureScale },
                { rotate: "14deg" },
              ],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.cockpitSweep,
            {
              opacity: pressure.interpolate({
                inputRange: [0, 1],
                outputRange: [0.14, 0.30],
              }),
              transform: [{ translateX: driftX }, { rotate: "-6deg" }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.steamVeil,
            {
              opacity: reduceMotion ? 0.10 : 0.18,
              transform: [{ translateY: steamY }, { rotate: "-4deg" }],
            },
          ]}
        >
          {Array.from({ length: 7 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.steamThread,
                {
                  left: 24 + index * 50,
                  top: index % 2 === 0 ? 18 : 78,
                  height: 88 + (index % 3) * 36,
                  opacity: 0.20 + (index % 4) * 0.07,
                },
              ]}
            />
          ))}
        </Animated.View>

        <View style={styles.glassLineTop} />
        <View style={styles.glassLineSide} />
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
    backgroundColor: "#07110F",
  },
  depth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#07110F",
  },
  deepCurrent: {
    position: "absolute",
    width: 560,
    height: 560,
    borderRadius: 999,
    left: -300,
    top: 250,
    backgroundColor: "rgba(8, 54, 57, 0.72)",
  },
  thermalHalo: {
    position: "absolute",
    width: 440,
    height: 230,
    borderRadius: 999,
    top: -92,
    right: -150,
    backgroundColor: "rgba(224, 139, 77, 0.20)",
    borderWidth: 1,
    borderColor: "rgba(255, 207, 157, 0.18)",
    shadowColor: "#F4B56B",
    shadowOpacity: 0.22,
    shadowRadius: 26,
  },
  pressureRing: {
    position: "absolute",
    width: 470,
    height: 470,
    borderRadius: 999,
    left: -235,
    top: 44,
    borderWidth: 1,
    borderColor: "rgba(115, 226, 218, 0.16)",
    backgroundColor: "rgba(26, 99, 102, 0.08)",
  },
  cockpitSweep: {
    position: "absolute",
    width: 560,
    height: 72,
    borderRadius: 999,
    right: -230,
    top: 300,
    backgroundColor: "rgba(193, 255, 240, 0.17)",
  },
  steamVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  steamThread: {
    position: "absolute",
    width: 1,
    borderRadius: 999,
    backgroundColor: "rgba(224, 252, 246, 0.54)",
  },
  glassLineTop: {
    position: "absolute",
    left: 22,
    right: 22,
    top: 18,
    height: 1,
    backgroundColor: "rgba(214, 255, 245, 0.16)",
  },
  glassLineSide: {
    position: "absolute",
    right: 18,
    top: 48,
    bottom: 48,
    width: 1,
    backgroundColor: "rgba(244, 181, 107, 0.10)",
  },
  depthVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 9, 10, 0.26)",
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
});
