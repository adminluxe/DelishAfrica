import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { WATER_MARKERS, WATER_MOTION, WATER_TONES, type WaterMode, type WaterTone } from "./tokens";

const RAIL_H2O_FOREGROUND = require("../../assets/h2o/client-h2o-rail-premium-v1.png");

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
          duration: WATER_MOTION.currentMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: WATER_MOTION.currentMs,
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
          duration: WATER_MOTION.pulseMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: WATER_MOTION.pulseMs,
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
  }, [drift, pulse, reduceMotion]);

  const currentX = drift.interpolate({ inputRange: [0, 1], outputRange: [-36, 42] });
  const currentOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.78] });
  const beaconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1.14] });
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
        onLoad={() => { if (__DEV__) console.log("DA_S10J_RAIL_H2O_LOADED_CLIENT"); }}
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
    opacity: 0.88,
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
