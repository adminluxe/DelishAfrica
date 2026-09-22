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

    drift.setValue(0.08);
    tide.setValue(0.29);
    rain.setValue(0.47);

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 7400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 7400,
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
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(tide, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
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
            styles.refractiveShear,
            {
              opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.045, 0.16] }),
              transform: [{ translateX: driftX }, { rotate: "-5deg" }, { scaleX: 1.06 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.causticCrest,
            { opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.30] }), transform: [{ translateX: driftX }, { rotate: "-5deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalPearl,
            { opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.20, 0.76] }), transform: [{ translateX: driftX }, { scale: tide.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1.24] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.activeThread,
            { opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.24] }), transform: [{ translateX: driftX }, { rotate: "-5deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.focusNode,
            { opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.70] }), transform: [{ scale: tide.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.24] }) }] },
          ]}
        />
        <Animated.View style={[styles.octaveDeep, { backgroundColor: "rgba(210,255,246,0.58)", opacity: tide.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [0.008, 0.026, 0.014, 0.036, 0.010] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [-34, 8, 28, -10, -26] }) }, { translateY: tide.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [9, -6, 7, -8, 4] }) }, { rotate: "-4deg" }] }]} />
        <Animated.View style={[styles.octaveCross, { backgroundColor: "rgba(210,255,246,0.58)", opacity: tide.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [0.010, 0.038, 0.016, 0.046, 0.012] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [18, -20, 12, 24, -10] }) }, { translateY: tide.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [-5, 8, -6, 7, -3] }) }, { rotate: "3deg" }] }]} />
        <Animated.View style={[styles.octaveSpecular, { backgroundColor: "#D8FFF7", opacity: tide.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [0.035, 0.15, 0.06, 0.18] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [-22, 12, 30, -14] }) }, { translateY: tide.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [4, -3, 5, -2] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.subsurfaceVeil, { backgroundColor: "rgba(210,255,246,0.58)", opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.006, 0.024] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 0.28, 0.60, 1], outputRange: [-18, 10, 22, -8] }) }, { translateY: tide.interpolate({ inputRange: [0, 0.28, 0.60, 1], outputRange: [4, -3, 5, -2] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.signatureGlaze, { backgroundColor: "#D8FFF7", opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.014, 0.058] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 0.32, 0.72, 1], outputRange: [-14, 8, 20, -10] }) }, { translateY: tide.interpolate({ inputRange: [0, 0.32, 0.72, 1], outputRange: [3, -2, 4, -1] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.softWaveFar, { backgroundColor: "rgba(210,255,246,0.72)", opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.006, 0.028] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [18, -16] }) }, { scaleX: tide.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] }) }, { rotate: "-4deg" }] }]} />
        <Animated.View style={[styles.softWaveMid, { backgroundColor: "rgba(210,255,246,0.72)", opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.005, 0.022] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-14, 20] }) }, { scaleY: tide.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }, { rotate: "3deg" }] }]} />
        <Animated.View style={[styles.softWaveNear, { backgroundColor: "rgba(210,255,246,0.72)", opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.004, 0.016] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [12, -10] }) }, { rotate: "-2deg" }] }]} />
        <Animated.View
          style={[
            styles.decisionBloomOuter,
            { opacity: tide.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.004, 0.014, 0.042] }), transform: [{ scale: tide.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.16] }) }, { rotate: tide.interpolate({ inputRange: [0, 1], outputRange: ["-9deg", "8deg"] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomInner,
            { opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.006, 0.044] }), transform: [{ scale: tide.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.10] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionGlint,
            { opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.30] }), transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-10, 12] }) }, { rotate: "8deg" }] },
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

        <Animated.View
          style={[
            styles.galaContinuityPlane,
            {
              opacity: tideOpacity,
              transform: [{ translateX: driftX }, { scale: tideScale }, { rotate: "9deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.galaContinuityGlint,
            { transform: [{ translateX: driftX }, { scaleX: tideScale }] },
          ]}
        />

        <Animated.View
          style={[
            styles.galaDepthLens,
            {
              opacity: tideOpacity,
              transform: [
                { translateX: driftX },
                { scale: tideScale },
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
                { translateX: counterDriftX },
                { scaleX: tideScale },
                { rotate: "7deg" },
              ],
            },
          ]}
        />

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
  refractiveShear: {
    position: "absolute",
    width: 610,
    height: 66,
    left: -118,
    top: 332,
    backgroundColor: "rgba(174,255,238,0.22)",
    borderTopLeftRadius: 56,
    borderTopRightRadius: 118,
    borderBottomRightRadius: 42,
    borderBottomLeftRadius: 96,
  },
  causticCrest: { position: "absolute", width: 286, height: 3, left: -84, top: 364, backgroundColor: "rgba(210,255,246,0.76)", borderTopLeftRadius: 16, borderTopRightRadius: 4, borderBottomRightRadius: 12, borderBottomLeftRadius: 3 },
  signalPearl: { position: "absolute", width: 9, height: 9, left: 42, top: 365, borderRadius: 999, backgroundColor: "rgba(210,255,246,0.76)", shadowColor: "#FFFFFF", shadowOpacity: 0.46, shadowRadius: 8 },
  activeThread: { position: "absolute", width: 238, height: 2, left: -22, top: 392, backgroundColor: "rgba(210,255,246,0.76)", borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 10, borderBottomLeftRadius: 2 },
  focusNode: { position: "absolute", width: 8, height: 8, right: 40, top: 389, borderRadius: 999, backgroundColor: "rgba(210,255,246,0.76)", shadowColor: "#FFFFFF", shadowOpacity: 0.42, shadowRadius: 8 },
  octaveDeep: { position: "absolute", width: 430, height: 122, right: -168, top: 330, borderTopLeftRadius: 170, borderTopRightRadius: 74, borderBottomRightRadius: 154, borderBottomLeftRadius: 52, shadowColor: "#D8FFF7", shadowOpacity: 0.09, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
  octaveCross: { position: "absolute", width: 322, height: 74, right: -78, top: 372, borderTopLeftRadius: 122, borderTopRightRadius: 54, borderBottomRightRadius: 112, borderBottomLeftRadius: 38, shadowColor: "#D8FFF7", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  octaveSpecular: { position: "absolute", width: 148, height: 2, right: 22, top: 410, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 12, borderBottomLeftRadius: 1, shadowColor: "#D8FFF7", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  subsurfaceVeil: { position: "absolute", width: 388, height: 104, right: -148, top: 346, borderTopLeftRadius: 166, borderTopRightRadius: 64, borderBottomRightRadius: 148, borderBottomLeftRadius: 48, shadowColor: "#D8FFF7", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  signatureGlaze: { position: "absolute", width: 132, height: 2, right: 26, top: 414, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 14, borderBottomLeftRadius: 1, shadowColor: "#D8FFF7", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  softWaveFar: { position: "absolute", width: 330, height: 78, right: -110, top: 354, borderTopLeftRadius: 132, borderTopRightRadius: 70, borderBottomRightRadius: 118, borderBottomLeftRadius: 54 },
  softWaveMid: { position: "absolute", width: 276, height: 62, right: -72, top: 376, borderTopLeftRadius: 108, borderTopRightRadius: 58, borderBottomRightRadius: 98, borderBottomLeftRadius: 42 },
  softWaveNear: { position: "absolute", width: 222, height: 48, right: -34, top: 397, borderTopLeftRadius: 82, borderTopRightRadius: 44, borderBottomRightRadius: 74, borderBottomLeftRadius: 30 },
  decisionBloomOuter: { position: "absolute", width: 70, height: 44, right: 22, top: 377, borderTopLeftRadius: 28, borderTopRightRadius: 15, borderBottomRightRadius: 26, borderBottomLeftRadius: 12, borderWidth: 0.1, borderColor: "rgba(210,255,246,0.76)", backgroundColor: "rgba(255,255,255,0.008)" },
  decisionBloomInner: { position: "absolute", width: 44, height: 26, right: 34, top: 386, borderTopLeftRadius: 17, borderTopRightRadius: 10, borderBottomRightRadius: 16, borderBottomLeftRadius: 8, borderWidth: 0.1, borderColor: "rgba(210,255,246,0.76)" },
  decisionGlint: { position: "absolute", width: 36, height: 3, right: 30, top: 399, backgroundColor: "rgba(210,255,246,0.76)", borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  rainVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  rainThread: {
    position: "absolute",
    width: 1,
    borderRadius: 999,
    backgroundColor: "rgba(203, 252, 255, 0.62)",
  },
  galaContinuityPlane: {
    position: "absolute",
    width: 540,
    height: 94,
    borderRadius: 999,
    left: -238,
    top: 676,
    borderWidth: 1,
    borderColor: "rgba(198,255,245,0.12)",
    backgroundColor: "rgba(126,239,219,0.075)",
  },
  galaContinuityGlint: {
    position: "absolute",
    width: 260,
    height: 1,
    right: -90,
    top: 716,
    borderRadius: 999,
    backgroundColor: "rgba(198,255,245,0.12)",
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
    borderColor: "rgba(185, 255, 244, 0.12)",
    backgroundColor: "rgba(77, 205, 197, 0.055)",
  },
  galaHorizonWake: {
    position: "absolute",
    width: 520,
    height: 44,
    borderRadius: 999,
    left: -210,
    top: 520,
    backgroundColor: "rgba(203, 255, 246, 0.085)",
    opacity: 0.16,
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
