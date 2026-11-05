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

    drift.setValue(0.31);
    pressure.setValue(0.53);
    steam.setValue(0.71);

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

    const pressureLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pressure, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pressure, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const steamLoop = Animated.loop(
      Animated.timing(steam, {
        toValue: 1,
        duration: 5700,
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
            styles.refractiveShear,
            {
              opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.045, 0.16] }),
              transform: [{ translateX: driftX }, { rotate: "4deg" }, { scaleX: 1.06 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.causticCrest,
            { opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.30] }), transform: [{ translateX: driftX }, { rotate: "4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalPearl,
            { opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.20, 0.76] }), transform: [{ translateX: driftX }, { scale: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1.24] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.activeThread,
            { opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.24] }), transform: [{ translateX: driftX }, { rotate: "4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.focusNode,
            { opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.70] }), transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.24] }) }] },
          ]}
        />
        <Animated.View style={[styles.octaveDeep, { backgroundColor: "rgba(255,213,158,0.56)", opacity: pressure.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [0.008, 0.026, 0.014, 0.036, 0.010] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [34, -8, -28, 10, 26] }) }, { translateY: pressure.interpolate({ inputRange: [0, 0.22, 0.55, 0.80, 1], outputRange: [-8, 6, -7, 9, -4] }) }, { rotate: "4deg" }] }]} />
        <Animated.View style={[styles.octaveCross, { backgroundColor: "rgba(255,213,158,0.56)", opacity: pressure.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [0.010, 0.038, 0.016, 0.046, 0.012] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [-18, 20, -12, -24, 10] }) }, { translateY: pressure.interpolate({ inputRange: [0, 0.28, 0.50, 0.74, 1], outputRange: [5, -8, 6, -7, 3] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.octaveSpecular, { backgroundColor: "#FFD39E", opacity: pressure.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [0.035, 0.15, 0.06, 0.18] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [22, -12, -30, 14] }) }, { translateY: pressure.interpolate({ inputRange: [0, 0.30, 0.68, 1], outputRange: [-4, 3, -5, 2] }) }, { rotate: "3deg" }] }]} />
        <Animated.View style={[styles.subsurfaceVeil, { backgroundColor: "rgba(255,213,158,0.56)", opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.006, 0.024] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 0.28, 0.60, 1], outputRange: [18, -10, -22, 8] }) }, { translateY: pressure.interpolate({ inputRange: [0, 0.28, 0.60, 1], outputRange: [-4, 3, -5, 2] }) }, { rotate: "3deg" }] }]} />
        <Animated.View style={[styles.signatureGlaze, { backgroundColor: "#FFD39E", opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.014, 0.058] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 0.32, 0.72, 1], outputRange: [14, -8, -20, 10] }) }, { translateY: pressure.interpolate({ inputRange: [0, 0.32, 0.72, 1], outputRange: [-3, 2, -4, 1] }) }, { rotate: "3deg" }] }]} />
        <Animated.View style={[styles.softWaveFar, { backgroundColor: "rgba(255,213,158,0.70)", opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.006, 0.028] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 1], outputRange: [18, -16] }) }, { scaleX: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.10] }) }, { rotate: "4deg" }] }]} />
        <Animated.View style={[styles.softWaveMid, { backgroundColor: "rgba(255,213,158,0.70)", opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.005, 0.022] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 1], outputRange: [-14, 20] }) }, { scaleY: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }, { rotate: "-3deg" }] }]} />
        <Animated.View style={[styles.softWaveNear, { backgroundColor: "rgba(255,213,158,0.70)", opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.004, 0.016] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 1], outputRange: [12, -10] }) }, { rotate: "2deg" }] }]} />
        <Animated.View
          style={[
            styles.decisionBloomOuter,
            { opacity: pressure.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.004, 0.014, 0.042] }), transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.16] }) }, { rotate: pressure.interpolate({ inputRange: [0, 1], outputRange: ["8deg", "-9deg"] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomInner,
            { opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.006, 0.044] }), transform: [{ scale: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.10] }) }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionGlint,
            { opacity: pressure.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.30] }), transform: [{ translateX: pressure.interpolate({ inputRange: [0, 1], outputRange: [-10, 12] }) }, { rotate: "-9deg" }] },
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

        <Animated.View
          style={[
            styles.galaContinuityPlane,
            {
              opacity: pressureOpacity,
              transform: [{ translateX: driftX }, { scale: pressureScale }, { rotate: "9deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.galaContinuityGlint,
            { transform: [{ translateX: driftX }, { scaleX: pressureScale }] },
          ]}
        />

        <Animated.View
          style={[
            styles.galaDepthLens,
            {
              opacity: pressureOpacity,
              transform: [
                { translateX: driftX },
                { scale: pressureScale },
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
                { scaleX: pressureScale },
                { rotate: "7deg" },
              ],
            },
          ]}
        />

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
  refractiveShear: {
    position: "absolute",
    width: 610,
    height: 66,
    left: -88,
    top: 338,
    backgroundColor: "rgba(255,204,146,0.20)",
    borderTopLeftRadius: 56,
    borderTopRightRadius: 118,
    borderBottomRightRadius: 42,
    borderBottomLeftRadius: 96,
  },
  causticCrest: { position: "absolute", width: 286, height: 3, left: -62, top: 370, backgroundColor: "rgba(255,213,158,0.72)", borderTopLeftRadius: 16, borderTopRightRadius: 4, borderBottomRightRadius: 12, borderBottomLeftRadius: 3 },
  signalPearl: { position: "absolute", width: 9, height: 9, left: 42, top: 371, borderRadius: 999, backgroundColor: "rgba(255,213,158,0.72)", shadowColor: "#FFFFFF", shadowOpacity: 0.46, shadowRadius: 8 },
  activeThread: { position: "absolute", width: 238, height: 2, left: -8, top: 398, backgroundColor: "rgba(255,213,158,0.72)", borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 10, borderBottomLeftRadius: 2 },
  focusNode: { position: "absolute", width: 8, height: 8, right: 42, top: 395, borderRadius: 999, backgroundColor: "rgba(255,213,158,0.72)", shadowColor: "#FFFFFF", shadowOpacity: 0.42, shadowRadius: 8 },
  octaveDeep: { position: "absolute", width: 430, height: 122, right: -168, top: 336, borderTopLeftRadius: 74, borderTopRightRadius: 170, borderBottomRightRadius: 52, borderBottomLeftRadius: 154, shadowColor: "#FFD39E", shadowOpacity: 0.09, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } },
  octaveCross: { position: "absolute", width: 322, height: 74, right: -78, top: 378, borderTopLeftRadius: 54, borderTopRightRadius: 122, borderBottomRightRadius: 38, borderBottomLeftRadius: 112, shadowColor: "#FFD39E", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  octaveSpecular: { position: "absolute", width: 148, height: 2, right: 22, top: 416, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 12, borderBottomLeftRadius: 1, shadowColor: "#FFD39E", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  subsurfaceVeil: { position: "absolute", width: 392, height: 106, right: -150, top: 352, borderTopLeftRadius: 66, borderTopRightRadius: 168, borderBottomRightRadius: 50, borderBottomLeftRadius: 150, shadowColor: "#FFD39E", shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  signatureGlaze: { position: "absolute", width: 132, height: 2, right: 22, top: 420, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 14, borderBottomLeftRadius: 1, shadowColor: "#FFD39E", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  softWaveFar: { position: "absolute", width: 330, height: 78, right: -110, top: 360, borderTopLeftRadius: 132, borderTopRightRadius: 70, borderBottomRightRadius: 118, borderBottomLeftRadius: 54 },
  softWaveMid: { position: "absolute", width: 276, height: 62, right: -72, top: 383, borderTopLeftRadius: 108, borderTopRightRadius: 58, borderBottomRightRadius: 98, borderBottomLeftRadius: 42 },
  softWaveNear: { position: "absolute", width: 222, height: 48, right: -34, top: 405, borderTopLeftRadius: 82, borderTopRightRadius: 44, borderBottomRightRadius: 74, borderBottomLeftRadius: 30 },
  decisionBloomOuter: { position: "absolute", width: 70, height: 44, right: 24, top: 383, borderTopLeftRadius: 28, borderTopRightRadius: 15, borderBottomRightRadius: 26, borderBottomLeftRadius: 12, borderWidth: 0.1, borderColor: "rgba(255,213,158,0.72)", backgroundColor: "rgba(255,255,255,0.008)" },
  decisionBloomInner: { position: "absolute", width: 44, height: 26, right: 36, top: 392, borderTopLeftRadius: 17, borderTopRightRadius: 10, borderBottomRightRadius: 16, borderBottomLeftRadius: 8, borderWidth: 0.1, borderColor: "rgba(255,213,158,0.72)" },
  decisionGlint: { position: "absolute", width: 36, height: 3, right: 32, top: 405, backgroundColor: "rgba(255,213,158,0.72)", borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  steamVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  steamThread: {
    position: "absolute",
    width: 1,
    borderRadius: 999,
    backgroundColor: "rgba(224, 252, 246, 0.54)",
  },
  galaContinuityPlane: {
    position: "absolute",
    width: 540,
    height: 94,
    borderRadius: 999,
    left: -238,
    top: 676,
    borderWidth: 1,
    borderColor: "rgba(255,222,185,0.11)",
    backgroundColor: "rgba(235,173,101,0.066)",
  },
  galaContinuityGlint: {
    position: "absolute",
    width: 260,
    height: 1,
    right: -90,
    top: 716,
    borderRadius: 999,
    backgroundColor: "rgba(255,222,185,0.11)",
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
    borderColor: "rgba(255, 214, 173, 0.12)",
    backgroundColor: "rgba(221, 140, 78, 0.055)",
  },
  galaHorizonWake: {
    position: "absolute",
    width: 520,
    height: 44,
    borderRadius: 999,
    left: -210,
    top: 520,
    backgroundColor: "rgba(205, 255, 244, 0.070)",
    opacity: 0.16,
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
