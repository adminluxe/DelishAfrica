import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { WATER_MOTION, WATER_TONES } from "./tokens";

export type RouteCurrentPhase = "idle" | "offer" | "pickup" | "route" | "delivery";

export type RouteCurrentMetric = {
  label: string;
  value: string | number;
};

type WaterRouteCurrentProps = {
  phase: RouteCurrentPhase;
  statusLabel: string;
  headline: string;
  body: string;
  metrics: RouteCurrentMetric[];
  orderId?: string;
  destination?: string;
  actionLabel?: string;
  onOpen?: () => void;
};

/**
 * DelishAfrica® Water × AI — Route Current.
 *
 * Contract:
 * - presentation only: no fetch, no persistence and no business mutation;
 * - current visualises already-known route truth without inventing ETA or status;
 * - Oracle remains explainable and the Courier keeps the decision;
 * - transform/opacity animation only;
 * - Reduce Motion collapses the current into a stable composition.
 */
export function WaterRouteCurrent({
  phase,
  statusLabel,
  headline,
  body,
  metrics,
  orderId,
  destination,
  actionLabel,
  onOpen,
}: WaterRouteCurrentProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const palette = WATER_TONES.courier;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    }).catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (enabled) => {
      setReduceMotion(Boolean(enabled));
    });

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    drift.stopAnimation();
    pulse.stopAnimation();

    if (reduceMotion) {
      drift.setValue(0.36);
      pulse.setValue(0.5);
      return undefined;
    }

    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 6400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 6400,
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
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
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

  const phaseIndex = useMemo(() => {
    if (phase === "offer") return 0;
    if (phase === "pickup") return 1;
    if (phase === "route") return 2;
    if (phase === "delivery") return 3;
    return -1;
  }, [phase]);

  const currentX = drift.interpolate({ inputRange: [0, 1], outputRange: [-72, 86] });
  const currentOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.62] });
  const beaconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] });

  const steps = ["CHOIX", "RETRAIT", "ROUTE", "LIVRAISON"];

  const surface = (pressed = false) => (
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
              transform: [{ translateX: currentX }, { rotate: "-8deg" }],
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
        <View style={[styles.depthOrb, { borderColor: palette.border }]} />
      </View>

      <View style={styles.topline}>
        <View style={styles.brandRow}>
          <Animated.View
            style={[
              styles.beacon,
              { backgroundColor: palette.signal, transform: [{ scale: beaconScale }] },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: palette.signal }]}>ROUTE · CURRENT</Text>
            <Text style={[styles.contract, { color: palette.body }]}>
              Oracle explicable · décision Courier
            </Text>
          </View>
        </View>
        <View style={[styles.statusPill, { borderColor: palette.border, backgroundColor: palette.chip }]}>
          <Text style={[styles.statusText, { color: palette.accent }]}>{statusLabel}</Text>
        </View>
      </View>

      <Text style={[styles.headline, { color: palette.title }]}>{headline}</Text>
      <Text style={[styles.body, { color: palette.body }]}>{body}</Text>

      {orderId || destination ? (
        <View style={[styles.truthCard, { borderColor: palette.border }]}>
          {orderId ? (
            <View style={{ flex: 1 }}>
              <Text style={[styles.truthLabel, { color: palette.signal }]}>MISSION</Text>
              <Text style={[styles.truthValue, { color: palette.title }]} numberOfLines={1}>{orderId}</Text>
            </View>
          ) : null}
          {destination ? (
            <View style={{ flex: 1.3 }}>
              <Text style={[styles.truthLabel, { color: palette.signal }]}>PROCHAIN POINT</Text>
              <Text style={[styles.truthValue, { color: palette.title }]} numberOfLines={2}>{destination}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.metricRow}>
        {metrics.slice(0, 3).map((metric) => (
          <View key={metric.label} style={[styles.metric, { backgroundColor: palette.chip }]}>
            <Text style={[styles.metricValue, { color: palette.title }]}>{metric.value}</Text>
            <Text style={[styles.metricLabel, { color: palette.body }]}>{metric.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.routeRail}>
        {steps.map((step, index) => {
          const reached = phaseIndex >= index;
          const active = phaseIndex === index;
          return (
            <React.Fragment key={step}>
              <View style={styles.stepWrap}>
                <Animated.View
                  style={[
                    styles.stepDot,
                    { borderColor: reached ? palette.signal : palette.border },
                    reached && { backgroundColor: palette.signal },
                    active && { transform: [{ scale: beaconScale }] },
                  ]}
                >
                  <Text style={[styles.stepIndex, { color: reached ? "#002218" : palette.body }]}>
                    {index + 1}
                  </Text>
                </Animated.View>
                <Text style={[styles.stepLabel, { color: reached ? palette.title : palette.body }]}>
                  {step}
                </Text>
              </View>
              {index < steps.length - 1 ? (
                <View
                  style={[
                    styles.stepLine,
                    { backgroundColor: index < phaseIndex ? palette.signal : palette.border },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      {actionLabel && onOpen ? (
        <View style={[styles.actionRow, { borderColor: palette.border, backgroundColor: palette.chip }]}>
          <Text style={[styles.actionText, { color: palette.title }]}>{actionLabel}</Text>
          <Text style={[styles.arrow, { color: palette.accent }]}>→</Text>
        </View>
      ) : null}
    </View>
  );

  if (!onOpen || !actionLabel) return surface(false);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${actionLabel}`}
      accessibilityHint="Ouvre l’étape Courier correspondante sans modifier automatiquement la mission"
    >
      {({ pressed }) => surface(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: 32,
    padding: 20,
    overflow: "hidden",
  },
  currentBand: {
    position: "absolute",
    width: 620,
    height: 126,
    borderRadius: 999,
    right: -220,
    top: 118,
  },
  currentLine: {
    position: "absolute",
    left: -100,
    right: -100,
    top: 192,
    height: 1,
    opacity: 0.48,
  },
  depthOrb: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 999,
    borderWidth: 1,
    right: -126,
    top: -112,
    backgroundColor: "rgba(9, 72, 57, 0.13)",
  },
  topline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  beacon: { width: 10, height: 10, borderRadius: 999 },
  kicker: { fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 2.1 },
  contract: { marginTop: 2, fontSize: 9, lineHeight: 13, fontWeight: "700", letterSpacing: 0.35 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  headline: { marginTop: 19, fontSize: 27, lineHeight: 31, fontWeight: "900", letterSpacing: -0.8 },
  body: { marginTop: 8, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  truthCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(0, 20, 15, 0.24)",
  },
  truthLabel: { fontSize: 7, fontWeight: "900", letterSpacing: 1.4 },
  truthValue: { marginTop: 4, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  metricRow: { marginTop: 14, flexDirection: "row", gap: 8 },
  metric: { flex: 1, minHeight: 72, borderRadius: 17, padding: 11 },
  metricValue: { fontSize: 18, lineHeight: 21, fontWeight: "900" },
  metricLabel: { marginTop: 5, fontSize: 7, fontWeight: "900", letterSpacing: 1.0, textTransform: "uppercase" },
  routeRail: { marginTop: 18, flexDirection: "row", alignItems: "flex-start" },
  stepWrap: { width: 60, alignItems: "center" },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  stepIndex: { fontSize: 10, fontWeight: "900" },
  stepLabel: { marginTop: 6, fontSize: 7, lineHeight: 10, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" },
  stepLine: { flex: 1, height: 1, marginTop: 16, opacity: 0.72 },
  actionRow: {
    marginTop: 16,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  arrow: { fontSize: 24, fontWeight: "700" },
  pressed: { opacity: 0.82, transform: [{ scale: WATER_MOTION.pressScale }] },
});
