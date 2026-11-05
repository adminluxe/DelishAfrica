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
// DA_GALA_HERO_DEPTH_V2 - deep refracted lens + horizon wake.
// DA_GALA_DEEP_CONTINUITY_V3 - second-depth current joins home and deep operational screens.
// DA_GALA_NETWORK_ORGANISM_V1 - shared macro/signal/micro rhythm with app-specific phase offset.
// DA_GALA_REFRACTIVE_INTELLIGENCE_V1 - secondary optical shear dephases the macro-current without adding new timers.
// DA_GALA_CAUSTIC_CORE_V1 - a restrained specular crest and signal pearl connect deep screens to the same living current.
// DA_GALA_LIVING_FOCUS_V1 - deep screens gain the same action-directed thread and focus node without a new animation loop.
// DA_GALA_DECISION_BLOOM_V1 - deep screens echo the same liquid aperture at the action focus; no new animation loop.
// DA_GALA_HYDRODYNAMIC_VEIL_V1 - deep apertures dissolve into layered soft water veils driven by the existing phase.
// DA_GALA_MULTI_OCTAVE_SURF_V1 - deep screens inherit multi-scale phase interference and feathered caustic highlights; no new timer.
// DA_GALA_SUBSURFACE_CONTINUUM_V1 - deep screens move to a subtractive seamless-fusion pass with softer veils and less pronounced edges; no new timer.
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

    current.setValue(0.57);
    pulse.setValue(0.76);
    rain.setValue(0.19);

    const currentLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(current, {
          toValue: 1,
          duration: 7400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(current, {
          toValue: 0,
          duration: 7400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const rainLoop = Animated.loop(
      Animated.timing(rain, {
        toValue: 1,
        duration: 5700,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 3400,
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
            styles.refractiveShear,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.045, 0.16] }),
              transform: [{ translateX: currentX }, { rotate: "-6deg" }, { scaleX: 1.06 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.causticCrest,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.30] }), transform: [{ translateX: currentX }, { rotate: "-6deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalPearl,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.20, 0.76] }), transform: [{ translateX: currentX }, { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1.24] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.activeThread,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.24] }), transform: [{ translateX: currentX }, { rotate: "-6deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.focusNode,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.70] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.24] }) }] },
          ]}
        />
        <Animated.View style={[styles.octaveDeep, { backgroundColor: "rgba(168,255,218,0.58)", opacity: pulse.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [0.008, 0.026, 0.014, 0.036, 0.010] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [-36, 10, 30, -12, -28] }) }, { translateY: pulse.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [10, -7, 8, -9, 4] }) }, { rotate: "-4deg" }] }]} />
        <Animated.View style={[styles.octaveCross, { backgroundColor: "rgba(168,255,218,0.58)", opacity: pulse.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [0.010, 0.038, 0.016, 0.046, 0.012] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [20, -22, 14, 26, -12] }) }, { translateY: pulse.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [-6, 9, -7, 8, -3] }) }, { rotate: "3deg" }] }]} />
        <Animated.View style={[styles.octaveSpecular, { backgroundColor: "#B8FFE0", opacity: pulse.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [0.035, 0.15, 0.06, 0.18] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [-24, 14, 32, -16] }) }, { translateY: pulse.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [5, -4, 6, -3] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.subsurfaceVeil, { backgroundColor: "rgba(168,255,218,0.58)", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.006, 0.024] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 0.28, 0.60, 1], outputRange: [-20, 12, 24, -10] }) }, { translateY: pulse.interpolate({ inputRange: [0, 0.28, 0.60, 1], outputRange: [5, -4, 6, -2] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.signatureGlaze, { backgroundColor: "#B8FFE0", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.014, 0.058] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 0.32, 0.72, 1], outputRange: [-16, 10, 22, -12] }) }, { translateY: pulse.interpolate({ inputRange: [0, 0.32, 0.72, 1], outputRange: [4, -3, 5, -1] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.softWaveFar, { backgroundColor: "rgba(168,255,218,0.72)", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.0065, 0.030] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [18, -16] }) }, { scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] }) }, { rotate: "-4deg" }] }]} />
        <Animated.View style={[styles.softWaveMid, { backgroundColor: "rgba(168,255,218,0.72)", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.0055, 0.024] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [-14, 20] }) }, { scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }, { rotate: "2deg" }] }]} />
        <Animated.View style={[styles.softWaveNear, { backgroundColor: "rgba(168,255,218,0.72)", opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.004, 0.018] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [12, -10] }) }, { rotate: "-2deg" }] }]} />
        <Animated.View
          style={[
            styles.decisionBloomOuter,
            { opacity: pulse.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.0045, 0.015, 0.046] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.16] }) }, { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ["-10deg", "7deg"] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomInner,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.0065, 0.048] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.10] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionGlint,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.30] }), transform: [{ translateX: pulse.interpolate({ inputRange: [0, 1], outputRange: [-10, 12] }) }, { rotate: "7deg" }] },
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

        <Animated.View
          style={[
            styles.galaContinuityPlane,
            {
              opacity: corridorOpacity,
              transform: [{ translateX: currentX }, { scale: corridorScale }, { rotate: "9deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.galaContinuityGlint,
            { transform: [{ translateX: currentX }, { scaleX: corridorScale }] },
          ]}
        />

        <Animated.View
          style={[
            styles.galaDepthLens,
            {
              opacity: corridorOpacity,
              transform: [
                { translateX: currentX },
                { scale: corridorScale },
                { rotate: "-21deg" },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.galaHorizonWake,
            {
              transform: [
                { translateX: counterX },
                { scaleX: corridorScale },
                { rotate: "7deg" },
              ],
            },
          ]}
        />

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
  refractiveShear: {
    position: "absolute",
    width: 610,
    height: 66,
    left: -132,
    top: 326,
    backgroundColor: "rgba(132,255,202,0.22)",
    borderTopLeftRadius: 56,
    borderTopRightRadius: 118,
    borderBottomRightRadius: 42,
    borderBottomLeftRadius: 96,
  },
  causticCrest: { position: "absolute", width: 286, height: 3, left: -96, top: 358, backgroundColor: "rgba(168,255,218,0.74)", borderTopLeftRadius: 16, borderTopRightRadius: 4, borderBottomRightRadius: 12, borderBottomLeftRadius: 3 },
  signalPearl: { position: "absolute", width: 9, height: 9, left: 42, top: 359, borderRadius: 999, backgroundColor: "rgba(168,255,218,0.74)", shadowColor: "#FFFFFF", shadowOpacity: 0.46, shadowRadius: 8 },
  activeThread: { position: "absolute", width: 238, height: 2, left: -30, top: 390, backgroundColor: "rgba(168,255,218,0.74)", borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 10, borderBottomLeftRadius: 2 },
  focusNode: { position: "absolute", width: 8, height: 8, right: 38, top: 387, borderRadius: 999, backgroundColor: "rgba(168,255,218,0.74)", shadowColor: "#FFFFFF", shadowOpacity: 0.42, shadowRadius: 8 },
  octaveDeep: { position: "absolute", width: 430, height: 122, right: -168, top: 328, borderTopLeftRadius: 174, borderTopRightRadius: 72, borderBottomRightRadius: 158, borderBottomLeftRadius: 50, shadowColor: "#B8FFE0", shadowOpacity: 0.09, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
  octaveCross: { position: "absolute", width: 322, height: 74, right: -78, top: 370, borderTopLeftRadius: 126, borderTopRightRadius: 52, borderBottomRightRadius: 116, borderBottomLeftRadius: 36, shadowColor: "#B8FFE0", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  octaveSpecular: { position: "absolute", width: 148, height: 2, right: 22, top: 408, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 12, borderBottomLeftRadius: 1, shadowColor: "#B8FFE0", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  subsurfaceVeil: { position: "absolute", width: 390, height: 104, right: -146, top: 344, borderTopLeftRadius: 170, borderTopRightRadius: 62, borderBottomRightRadius: 152, borderBottomLeftRadius: 46, shadowColor: "#B8FFE0", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  signatureGlaze: { position: "absolute", width: 136, height: 2, right: 28, top: 412, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 14, borderBottomLeftRadius: 1, shadowColor: "#B8FFE0", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  softWaveFar: { position: "absolute", width: 330, height: 78, right: -110, top: 352, borderTopLeftRadius: 132, borderTopRightRadius: 70, borderBottomRightRadius: 118, borderBottomLeftRadius: 54 },
  softWaveMid: { position: "absolute", width: 276, height: 62, right: -72, top: 375, borderTopLeftRadius: 108, borderTopRightRadius: 58, borderBottomRightRadius: 98, borderBottomLeftRadius: 42 },
  softWaveNear: { position: "absolute", width: 222, height: 48, right: -34, top: 397, borderTopLeftRadius: 82, borderTopRightRadius: 44, borderBottomRightRadius: 74, borderBottomLeftRadius: 30 },
  decisionBloomOuter: { position: "absolute", width: 70, height: 44, right: 20, top: 375, borderTopLeftRadius: 28, borderTopRightRadius: 15, borderBottomRightRadius: 26, borderBottomLeftRadius: 12, borderWidth: 0.1, borderColor: "rgba(168,255,218,0.74)", backgroundColor: "rgba(255,255,255,0.008)" },
  decisionBloomInner: { position: "absolute", width: 44, height: 26, right: 32, top: 384, borderTopLeftRadius: 17, borderTopRightRadius: 10, borderBottomRightRadius: 16, borderBottomLeftRadius: 8, borderWidth: 0.1, borderColor: "rgba(168,255,218,0.74)" },
  decisionGlint: { position: "absolute", width: 36, height: 3, right: 28, top: 397, backgroundColor: "rgba(168,255,218,0.74)", borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  rainField: {
    ...StyleSheet.absoluteFillObject,
  },
  rainThread: {
    position: "absolute",
    width: 1,
    borderRadius: 999,
    backgroundColor: "rgba(196, 255, 235, 0.56)",
  },
  galaContinuityPlane: {
    position: "absolute",
    width: 540,
    height: 94,
    borderRadius: 999,
    left: -238,
    top: 676,
    borderWidth: 1,
    borderColor: "rgba(196,255,225,0.11)",
    backgroundColor: "rgba(97,231,177,0.066)",
  },
  galaContinuityGlint: {
    position: "absolute",
    width: 260,
    height: 1,
    right: -90,
    top: 716,
    borderRadius: 999,
    backgroundColor: "rgba(196,255,225,0.11)",
    opacity: 0.18,
  },
  galaDepthLens: {
    position: "absolute",
    width: 420,
    height: 154,
    borderRadius: 999,
    right: -206,
    top: 420,
    borderWidth: 1,
    borderColor: "rgba(184, 255, 217, 0.11)",
    backgroundColor: "rgba(80, 223, 164, 0.050)",
  },
  galaHorizonWake: {
    position: "absolute",
    width: 520,
    height: 44,
    borderRadius: 999,
    left: -210,
    top: 520,
    backgroundColor: "rgba(193, 255, 229, 0.075)",
    opacity: 0.16,
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
