import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { WATER_MARKERS, WATER_MOTION, WATER_TONES, type WaterMode, type WaterTone } from "./tokens";

const RAIL_H2O_FOREGROUND = require("../../assets/h2o/merchant-h2o-rail-premium-v1.png");

type WaterIntelRailProps = {
  tone: WaterTone;
  mode: WaterMode;
  label: string;
  title: string;
  body: string;
  status: string;
  reduceMotion?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  signalClass?: "confirmed" | "estimated" | "stale" | "offline";
  evidence?: string;
  freshnessLabel?: string;
};

/**
 * DelishAfrica® Water × AI — synchronized intelligence rail.
 *
 * Contract:
 * - visual intelligence only: no business mutation, network request or hidden decision;
 * - transform/opacity animations only;
 * - S10D: unmistakable teardrop silhouettes, fully inside the rail;
 * - Reduce Motion collapses to a stable composition;
 * - system state is explicit and never disguised;
 * - CHOIX remains human across Client, Merchant and Courier.
 */
// S10C_VISIBLE_H2O_MATTER_V3
// DA_GALA_AI_WATER_STATE_V1 - state changes current velocity, wake and signal intensity.
// DA_GALA_SEMANTIC_TIDE_V2 - signal certainty shapes the water field without automating decisions.
// DA_GALA_DEEP_STATE_V3 - live/sync/stale/offline/gate states shape pressure, depth and horizon.
export function WaterIntelRail({
  tone,
  mode,
  label,
  title,
  body,
  status,
  reduceMotion = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  signalClass = "estimated",
  evidence = "Information contextualisée par DelishAfrica.",
  freshnessLabel = "À vérifier dans la surface détaillée.",
}: WaterIntelRailProps) {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const palette = WATER_TONES[tone];
  const markers = WATER_MARKERS[mode];

  const normalizedStatus = useMemo(() => String(status || "").trim().toUpperCase(), [status]);
  const statusKind = useMemo<"live" | "sync" | "caution">(() => {
    if (normalizedStatus === "LIVE" || normalizedStatus === "PRÊT") return "live";
    if (normalizedStatus === "SYNC" || normalizedStatus === "SYNCING") return "sync";
    return "caution";
  }, [normalizedStatus]);

  const statusColor =
    statusKind === "live"
      ? palette.signal
      : statusKind === "sync"
        ? palette.body
        : palette.accent;

  const currentDuration = statusKind === "live" ? 5600 : statusKind === "sync" ? 7200 : 9600;
  const pulseDuration = statusKind === "live" ? 2600 : statusKind === "sync" ? 3400 : 4600;

  const proofLabel =
    signalClass === "confirmed"
      ? "SIGNAL CONFIRMÉ"
      : signalClass === "stale"
        ? "À ACTUALISER"
        : signalClass === "offline"
          ? "DERNIER ÉTAT CONNU"
          : "ESTIMATION / CONTEXTE";

  const proofColor =
    signalClass === "confirmed"
      ? palette.signal
      : signalClass === "estimated"
        ? palette.accent
        : palette.body;

  const runRipple = () => {
    if (reduceMotion) return;
    ripple.stopAnimation();
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 860,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start(({ finished }) => {
      if (finished) ripple.setValue(0);
    });
  };

  useEffect(() => {
    drift.stopAnimation();
    pulse.stopAnimation();

    if (reduceMotion) {
      drift.setValue(0.38);
      pulse.setValue(0.42);
      return undefined;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: currentDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: currentDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: pulseDuration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: pulseDuration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    driftLoop.start();
    pulseLoop.start();

    return () => {
      driftLoop.stop();
      pulseLoop.stop();
    };
  }, [currentDuration, drift, pulse, pulseDuration, reduceMotion]);

  const currentX = drift.interpolate({ inputRange: [0, 1], outputRange: [-36, 42] });
  const currentOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange:
      statusKind === "live" ? [0.54, 0.92] : statusKind === "sync" ? [0.38, 0.74] : [0.26, 0.54],
  });
  const beaconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1.14] });
  const signalWakeX = drift.interpolate({ inputRange: [0, 1], outputRange: [-12, 242] });
  const signalWakeOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange:
      statusKind === "live" ? [0.46, 0.96] : statusKind === "sync" ? [0.28, 0.74] : [0.12, 0.46],
  });
  const signalWakeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.24] });
  const semanticTideX = drift.interpolate({ inputRange: [0, 1], outputRange: [-84, 108] });
  const semanticTideScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const semanticTideOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange:
      signalClass === "confirmed"
        ? [0.18, 0.42]
        : signalClass === "estimated"
          ? [0.12, 0.29]
          : signalClass === "stale"
            ? [0.07, 0.18]
            : [0.04, 0.11],
  });
  const semanticEdgeOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: signalClass === "confirmed" ? [0.28, 0.68] : signalClass === "offline" ? [0.08, 0.18] : [0.16, 0.42],
  });
  const semanticDepthOpacity = signalClass === "confirmed" ? 0.18 : signalClass === "estimated" ? 0.13 : signalClass === "stale" ? 0.09 : 0.06;
  const deepState = useMemo<"live" | "sync" | "stale" | "offline" | "gate">(() => {
    const s = normalizedStatus;
    if (s === "LIVE" || s === "PRÊT" || s.includes("CONFIRM")) return "live";
    if (s === "SYNC" || s.includes("ACTUALISER") || s.includes("MISE À JOUR")) return "sync";
    if (s === "STALE" || s.includes("VEILLE")) return "stale";
    if (s.includes("HORS RÉSEAU") || s.includes("OFFLINE")) return "offline";
    return "gate";
  }, [normalizedStatus]);
  const deepStateColor = deepState === "offline" || deepState === "gate" ? palette.accent : deepState === "stale" ? palette.body : palette.signal;
  const deepStateShearX = drift.interpolate({ inputRange: [0, 1], outputRange: [-116, 152] });
  const deepStateOrbitScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.18] });
  const deepStateOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange:
      deepState === "live" ? [0.20, 0.48] : deepState === "sync" ? [0.14, 0.36] : deepState === "stale" ? [0.08, 0.20] : deepState === "offline" ? [0.04, 0.11] : [0.07, 0.18],
  });
  const deepStateLineOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: deepState === "live" ? [0.34, 0.82] : deepState === "sync" ? [0.22, 0.58] : deepState === "offline" ? [0.07, 0.16] : [0.12, 0.34],
  });
  const statusOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: statusKind === "sync" ? [0.42, 0.72] : [0.72, 1],
  });
  const liquidRippleScale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 3.2],
  });
  const liquidRippleSecondaryScale = ripple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.52, 4.1],
  });
  const liquidRippleOpacity = ripple.interpolate({
    inputRange: [0, 0.14, 1],
    outputRange: [0, 0.52, 0],
  });
  const liquidRippleSecondaryOpacity = ripple.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 0.30, 0],
  });
  const liquidRippleCoreOpacity = ripple.interpolate({
    inputRange: [0, 0.08, 0.44, 1],
    outputRange: [0, 0.34, 0.12, 0],
  });

  const rail = (pressed = false) => (
    <View
      style={[
        styles.shell,
        { backgroundColor: palette.background, borderColor: palette.border },
        pressed && styles.pressed,
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.currentBand,
            {
              backgroundColor: palette.current,
              opacity: currentOpacity,
              transform: [{ translateX: currentX }, { rotate: "-9deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.currentLine,
            {
              backgroundColor: palette.currentStrong,
              transform: [{ translateX: currentX }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.signalWakeTrail,
            {
              backgroundColor: statusColor,
              opacity: signalWakeOpacity,
              transform: [{ translateX: signalWakeX }, { scaleX: signalWakeScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.signalWakeHalo,
            {
              borderColor: statusColor,
              opacity: signalWakeOpacity,
              transform: [{ translateX: signalWakeX }, { scale: signalWakeScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.signalWakeCore,
            {
              backgroundColor: statusColor,
              opacity: signalWakeOpacity,
              transform: [{ translateX: signalWakeX }, { scale: signalWakeScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.semanticTidePlane,
            {
              backgroundColor: proofColor,
              opacity: semanticTideOpacity,
              transform: [
                { translateX: semanticTideX },
                { scaleX: semanticTideScale },
                { rotate: "-8deg" },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.semanticTideEdge,
            {
              backgroundColor: proofColor,
              opacity: semanticEdgeOpacity,
              transform: [{ translateX: semanticTideX }],
            },
          ]}
        />
        <View
          style={[
            styles.semanticDepthLens,
            { borderColor: proofColor, opacity: semanticDepthOpacity },
          ]}
        />
        <View style={[styles.depthDisc, { borderColor: palette.border }]} />
        {/* S10I V1B: legacy View-based lens/beads removed; premium raster is the only static H2O matter. */}
        <Animated.View
          style={[
            styles.liquidRippleSecondary,
            {
              borderColor: palette.currentStrong,
              opacity: liquidRippleSecondaryOpacity,
              transform: [{ scale: liquidRippleSecondaryScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.liquidRipple,
            {
              borderColor: palette.signal,
              opacity: liquidRippleOpacity,
              transform: [{ scale: liquidRippleScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.liquidRippleCore,
            {
              backgroundColor: palette.signal,
              opacity: liquidRippleCoreOpacity,
              transform: [{ scale: liquidRippleScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.deepStateShear,
            {
              backgroundColor: deepStateColor,
              opacity: deepStateOpacity,
              transform: [{ translateX: deepStateShearX }, { rotate: "-11deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.deepStateLine,
            {
              backgroundColor: deepStateColor,
              opacity: deepStateLineOpacity,
              transform: [{ translateX: deepStateShearX }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.deepStateOrbit,
            {
              borderColor: deepStateColor,
              opacity: deepStateOpacity,
              transform: [{ scale: deepStateOrbitScale }],
            },
          ]}
        />
      </View>

      <View style={styles.topline}>
        <View style={styles.labelRow}>
          <Animated.View
            style={[
              styles.beacon,
              { backgroundColor: palette.signal, transform: [{ scale: beaconScale }] },
            ]}
          />
          <Text style={[styles.label, { color: palette.signal }]}>{label}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: palette.chip, borderColor: palette.border }]}>
          <Animated.View
            style={[
              styles.statusDot,
              {
                backgroundColor: statusColor,
                opacity: statusOpacity,
                transform: [{ scale: statusKind === "live" ? beaconScale : 1 }],
              },
            ]}
          />
          <Text style={[styles.status, { color: statusColor }]}>{status}</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
      <Text style={[styles.body, { color: palette.body }]}>{body}</Text>

      <View style={[styles.proofCard, { backgroundColor: palette.chip, borderColor: palette.border }]}>
        <View style={styles.proofTopline}>
          <View style={[styles.proofDrop, { backgroundColor: proofColor }]} />
          <Text style={[styles.proofLabel, { color: proofColor }]}>{proofLabel}</Text>
        </View>
        <Text style={[styles.proofEvidence, { color: palette.title }]}>{evidence}</Text>
        <Text style={[styles.proofFreshness, { color: palette.body }]}>{freshnessLabel}</Text>
      </View>

      <View style={styles.markerRow}>
        {markers.map((marker, index) => (
          <React.Fragment key={marker}>
            <View style={[styles.marker, { backgroundColor: palette.chip, borderColor: palette.border }]}>
              <Text style={[styles.markerText, { color: marker === "CHOIX" ? palette.accent : palette.signal }]}>
                {marker}
              </Text>
            </View>
            {index < markers.length - 1 ? (
              <View style={[styles.markerLink, { backgroundColor: palette.border }]} />
            ) : null}
          </React.Fragment>
        ))}
        {onPress ? <Text style={[styles.arrow, { color: palette.accent }]}>→</Text> : null}
      </View>

      <View style={[styles.controlLine, { borderTopColor: palette.border }]}>
        <Text style={[styles.controlText, { color: palette.body }]}>ASSISTANCE EXPLICABLE</Text>
        <View style={[styles.controlDot, { backgroundColor: palette.signal }]} />
        <Text style={[styles.controlChoice, { color: palette.accent }]}>CHOIX HUMAIN</Text>
      </View>
      <Image
        source={RAIL_H2O_FOREGROUND}
        style={styles.h2oRailForeground}
        resizeMode="stretch"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
        onLoad={() => { if (__DEV__) console.log("DA_S10K_RAIL_H2O_LOADED_MERCHANT"); }}
      />
    </View>
  );

  if (!onPress) return rail(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={runRipple}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${label}. ${title}`}
      accessibilityHint={
        accessibilityHint ||
        "Ouvre cette surface. Aucune action métier n’est exécutée automatiquement."
      }
      accessibilityState={{ busy: statusKind === "sync" }}
    >
      {({ pressed }) => rail(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 176,
    borderWidth: 1,
    borderRadius: 30,
    padding: 18,
    overflow: "hidden",
  },
  h2oRailForeground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 60,
    opacity: 0.90,
  },
  currentBand: {
    position: "absolute",
    width: 420,
    height: 94,
    borderRadius: 999,
    right: -126,
    top: 22,
  },
  currentLine: {
    position: "absolute",
    left: -60,
    right: -60,
    top: 78,
    height: 1,
    opacity: 0.54,
  },
  deepStateShear: {
    position: "absolute",
    left: -150,
    top: 24,
    width: 460,
    height: 108,
    borderRadius: 999,
  },
  deepStateLine: {
    position: "absolute",
    left: 18,
    top: 108,
    width: 154,
    height: 1,
    borderRadius: 999,
  },
  deepStateOrbit: {
    position: "absolute",
    right: -48,
    top: -56,
    width: 152,
    height: 152,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.010)",
  },
  semanticTidePlane: {
    position: "absolute",
    left: -118,
    top: 34,
    width: 420,
    height: 92,
    borderRadius: 999,
  },
  semanticTideEdge: {
    position: "absolute",
    left: 14,
    top: 92,
    width: 118,
    height: 1,
    borderRadius: 999,
  },
  semanticDepthLens: {
    position: "absolute",
    right: -58,
    top: -74,
    width: 178,
    height: 178,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.012)",
  },
  signalWakeTrail: {
    position: "absolute",
    left: 30,
    top: 78,
    width: 34,
    height: 1,
    borderRadius: 999,
    transformOrigin: "left center",
  },
  signalWakeHalo: {
    position: "absolute",
    left: 43,
    top: 70,
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  signalWakeCore: {
    position: "absolute",
    left: 48,
    top: 75,
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  depthDisc: {
    position: "absolute",
    width: 176,
    height: 176,
    borderRadius: 999,
    borderWidth: 1,
    right: -92,
    top: -100,
    backgroundColor: "rgba(255,255,255,0.012)",
  },
  // S10I V1B: legacy liquidLens/liquidBead styles removed.
  liquidRippleSecondary: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 999,
    borderWidth: 0.8,
    left: "50%",
    top: "50%",
    marginLeft: -35,
    marginTop: -35,
  },
  liquidRipple: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 999,
    borderWidth: 1.4,
    left: "50%",
    top: "50%",
    marginLeft: -35,
    marginTop: -35,
  },
  liquidRippleCore: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 999,
    left: "50%",
    top: "50%",
    marginLeft: -7,
    marginTop: -7,
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  labelRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
  beacon: { width: 9, height: 9, borderRadius: 999 },
  label: { flex: 1, fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 1.8 },
  statusPill: {
    flexShrink: 0,
    minHeight: 30,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 999 },
  status: { fontSize: 8, fontWeight: "900", letterSpacing: 1.25 },
  title: { marginTop: 17, fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.5 },
  body: { marginTop: 7, fontSize: 12, lineHeight: 18, maxWidth: 520 },
  proofCard: { marginTop: 14, borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 11 },
  proofTopline: { flexDirection: "row", alignItems: "center", gap: 8 },
  proofDrop: { width: 9, height: 12, borderRadius: 7, borderTopLeftRadius: 9, transform: [{ rotate: "36deg" }] },
  proofLabel: { fontSize: 8, lineHeight: 11, fontWeight: "900", letterSpacing: 1.15 },
  proofEvidence: { marginTop: 7, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  proofFreshness: { marginTop: 3, fontSize: 9, lineHeight: 13 },
  markerRow: { marginTop: 16, flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: 8 },
  marker: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  markerText: { fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  markerLink: { width: 10, height: 1, opacity: 0.74 },
  arrow: { marginLeft: "auto", fontSize: 24, fontWeight: "700" },
  controlLine: {
    marginTop: 13,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  controlText: { fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  controlDot: { width: 4, height: 4, borderRadius: 999, opacity: 0.78 },
  controlChoice: { fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  pressed: { opacity: 0.82, transform: [{ scale: WATER_MOTION.pressScale }] },
});
