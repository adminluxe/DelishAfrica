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
// DA_GALA_ROUTE_INTELLIGENCE_WAKE_V4 - route phase shapes current energy, Oracle remains explainable and non-autonomous.
// DA_GALA_NETWORK_ORGANISM_V1 - ONE CURRENT: macro 14.8s / signal 6.8s / micro 5.7s; route energy stays directional.
// DA_GALA_REFRACTIVE_INTELLIGENCE_V1 - route truth becomes a directional living signal inside the water.
// DA_GALA_CAUSTIC_CORE_V1 - the living signal gains a luminous pearl, wake-tail and caustic crest without adding timers.
// DA_GALA_LIVING_FOCUS_V1 - the signal now hands off toward one visible action focus; no autonomous action, no new timer.
// DA_GALA_DECISION_BLOOM_V1 - the arriving signal opens a refractive decision aperture at the human action focus; no autonomous action, no new timer.
// DA_GALA_HYDRODYNAMIC_VEIL_V1 - hard aperture geometry dissolves into layered, phase-shifted soft water veils; no new timer.
// DA_GALA_MULTI_OCTAVE_SURF_V1 - independent macro/mid/fine wave bands dissolve hard silhouettes into feathered caustic water; no new timer.
// DA_GALA_SUBSURFACE_CONTINUUM_V1 - subtractive soft-fusion pass reduces dominant layers and injects seamless veils so the interface reads as one living liquid field; no new timer.
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
  const phaseEnergy = phase === "idle" ? 0.30 : phase === "offer" ? 0.52 : phase === "pickup" ? 0.72 : phase === "route" ? 1 : 0.82;
  const phaseColor = phase === "delivery" ? palette.accent : palette.signal;
  const intelligenceWakeOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.028 * phaseEnergy, 0.12 * phaseEnergy] });
  const intelligenceLensScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.90, 1.15] });
  const refractiveOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.055 * phaseEnergy, 0.19 * phaseEnergy] });
  const livingSignalX = drift.interpolate({ inputRange: [0, 1], outputRange: [-108, 170] });
  const livingSignalOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.10 * phaseEnergy, 0.44 * phaseEnergy] });
  const causticCrestOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06 * phaseEnergy, 0.34 * phaseEnergy] });
  const signalTrailOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.05 * phaseEnergy, 0.28 * phaseEnergy] });
  const signalHaloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.34] });
  const signalCoreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.22] });
  const activeThreadOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.04 * phaseEnergy, 0.26 * phaseEnergy] });
  const activeThreadScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.56, 1.08] });
  const handoffHaloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.08 * phaseEnergy, 0.38 * phaseEnergy] });
  const handoffNodeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.28] });
  const decisionBloomOpacity = drift.interpolate({ inputRange: [0, 0.68, 0.90, 1], outputRange: [0.0045 * phaseEnergy, 0.011 * phaseEnergy, 0.060 * phaseEnergy, 0.017 * phaseEnergy] });
  const decisionBloomScale = drift.interpolate({ inputRange: [0, 0.72, 0.90, 1], outputRange: [0.78, 0.86, 1.22, 0.96] });
  const decisionArcRotate = drift.interpolate({ inputRange: [0, 1], outputRange: ["-14deg", "9deg"] });
  const decisionGlintX = drift.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });
  const softWaveAOpacity = drift.interpolate({ inputRange: [0, 0.34, 0.72, 1], outputRange: [0.0045 * phaseEnergy, 0.018 * phaseEnergy, 0.042 * phaseEnergy, 0.011 * phaseEnergy] });
  const softWaveBOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.0065 * phaseEnergy, 0.028 * phaseEnergy] });
  const softWaveCOpacity = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.004 * phaseEnergy, 0.022 * phaseEnergy, 0.0065 * phaseEnergy] });
  const softWaveShift = drift.interpolate({ inputRange: [0, 1], outputRange: [-28, 26] });
  const softWaveReverse = drift.interpolate({ inputRange: [0, 1], outputRange: [22, -18] });
  const softWaveScaleX = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const softWaveScaleY = drift.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] });
  // Multi-octave approximation inspired by physical water rendering: independent scales, directions and phase changes.
  const octaveMacroX = drift.interpolate({ inputRange: [0, 0.22, 0.51, 0.78, 1], outputRange: [-40, -6, 44, 14, -32] });
  const octaveMacroY = drift.interpolate({ inputRange: [0, 0.22, 0.51, 0.78, 1], outputRange: [10, -8, 9, -11, 5] });
  const octaveMidX = drift.interpolate({ inputRange: [0, 0.26, 0.48, 0.74, 1], outputRange: [26, -24, 12, 30, -14] });
  const octaveMidY = drift.interpolate({ inputRange: [0, 0.26, 0.48, 0.74, 1], outputRange: [-6, 10, -7, 8, -4] });
  const octaveFineX = drift.interpolate({ inputRange: [0, 0.18, 0.43, 0.69, 1], outputRange: [-18, 15, -10, 19, -7] });
  const octaveFineY = drift.interpolate({ inputRange: [0, 0.18, 0.43, 0.69, 1], outputRange: [6, -5, 8, -7, 3] });
  const octaveMacroOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.0045 * phaseEnergy, 0.020 * phaseEnergy] });
  const octaveMidOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.0060 * phaseEnergy, 0.026 * phaseEnergy] });
  const octaveFineOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.0075 * phaseEnergy, 0.033 * phaseEnergy] });
  const octaveGlintOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.012 * phaseEnergy, 0.086 * phaseEnergy] });
  const octaveMacroScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.07] });
  const octaveMidScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.93] });
  const softWaveFarY = drift.interpolate({ inputRange: [0, 0.24, 0.55, 0.82, 1], outputRange: [7, -8, 11, -6, 3] });
  const softWaveMidY = drift.interpolate({ inputRange: [0, 0.28, 0.50, 0.76, 1], outputRange: [-6, 9, -8, 7, -3] });
  const softWaveNearY = drift.interpolate({ inputRange: [0, 0.20, 0.46, 0.72, 1], outputRange: [5, -7, 8, -5, 2] });
  const softWaveFarRotate = drift.interpolate({ inputRange: [0, 0.24, 0.55, 0.82, 1], outputRange: ["-6deg", "-1deg", "4deg", "-4deg", "0deg"] });
  const softWaveMidRotate = drift.interpolate({ inputRange: [0, 0.28, 0.50, 0.76, 1], outputRange: ["3deg", "-2deg", "5deg", "1deg", "4deg"] });
  const softWaveNearRotate = drift.interpolate({ inputRange: [0, 0.20, 0.46, 0.72, 1], outputRange: ["-3deg", "2deg", "-5deg", "1deg", "-2deg"] });
  const octaveGlintRotate = drift.interpolate({ inputRange: [0, 0.32, 0.68, 1], outputRange: ["-5deg", "1deg", "5deg", "-2deg"] });

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
  const currentOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.22] });
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
            styles.organismFarCurrent,
            {
              backgroundColor: palette.currentStrong,
              opacity: phaseEnergy * 0.092,
              transform: [{ translateX: currentX }, { rotate: "5deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.refractiveWake,
            {
              backgroundColor: phaseColor,
              opacity: refractiveOpacity,
              transform: [{ translateX: currentX }, { rotate: "-5deg" }, { scaleX: 1.05 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.causticCrest,
            { backgroundColor: phaseColor, opacity: causticCrestOpacity, transform: [{ translateX: currentX }, { rotate: "-5deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalTrail,
            { backgroundColor: phaseColor, opacity: signalTrailOpacity, transform: [{ translateX: livingSignalX }, { rotate: "-5deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalHalo,
            { borderColor: phaseColor, opacity: signalTrailOpacity, transform: [{ translateX: livingSignalX }, { scale: signalHaloScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalCore,
            { backgroundColor: phaseColor, opacity: livingSignalOpacity, transform: [{ translateX: livingSignalX }, { scale: signalCoreScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.activeThread,
            { backgroundColor: phaseColor, opacity: activeThreadOpacity, transform: [{ translateX: livingSignalX }, { scaleX: activeThreadScale }, { rotate: "-5deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.handoffHalo,
            { borderColor: phaseColor, opacity: handoffHaloOpacity, transform: [{ scale: handoffNodeScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.handoffNode,
            { backgroundColor: phaseColor, opacity: handoffHaloOpacity, transform: [{ scale: handoffNodeScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveMacro,
            { backgroundColor: phaseColor, opacity: octaveMacroOpacity, transform: [{ translateX: octaveMacroX }, { translateY: octaveMacroY }, { scale: octaveMacroScale }, { rotate: "-4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveMid,
            { backgroundColor: phaseColor, opacity: octaveMidOpacity, transform: [{ translateX: octaveMidX }, { translateY: octaveMidY }, { scale: octaveMidScale }, { rotate: "3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveFine,
            { backgroundColor: phaseColor, opacity: octaveFineOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveGlint,
            { backgroundColor: phaseColor, opacity: octaveGlintOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.fusionVeil,
            { backgroundColor: phaseColor, opacity: octaveMacroOpacity, transform: [{ translateX: octaveMidX }, { translateY: octaveMacroY }, { scale: octaveMacroScale }, { rotate: "-3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.cardGlaze,
            { backgroundColor: "#A8FFDA", opacity: octaveGlintOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveFar,
            { backgroundColor: phaseColor, opacity: softWaveCOpacity, transform: [{ translateX: softWaveReverse }, { translateY: softWaveFarY }, { scaleX: softWaveScaleX }, { scaleY: softWaveScaleY }, { rotate: softWaveFarRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveMid,
            { backgroundColor: phaseColor, opacity: softWaveBOpacity, transform: [{ translateX: softWaveShift }, { translateY: softWaveMidY }, { scaleX: softWaveScaleX }, { rotate: softWaveMidRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveNear,
            { backgroundColor: phaseColor, opacity: softWaveAOpacity, transform: [{ translateX: softWaveReverse }, { translateY: softWaveNearY }, { scaleY: softWaveScaleY }, { rotate: softWaveNearRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomOuter,
            { borderColor: phaseColor, opacity: decisionBloomOpacity, transform: [{ scale: decisionBloomScale }, { rotate: decisionArcRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomInner,
            { borderColor: phaseColor, opacity: decisionBloomOpacity, transform: [{ scale: decisionBloomScale }, { rotate: "5deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionGlint,
            { backgroundColor: phaseColor, opacity: decisionBloomOpacity, transform: [{ translateX: decisionGlintX }, { rotate: decisionArcRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.livingSignal,
            {
              backgroundColor: phaseColor,
              opacity: livingSignalOpacity,
              transform: [{ translateX: livingSignalX }, { rotate: "-5deg" }],
            },
          ]}
        />
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
        <Animated.View style={[styles.intelligenceWake, { backgroundColor: phaseColor, opacity: intelligenceWakeOpacity, transform: [{ translateX: currentX }, { rotate: "-5deg" }] }]} />
        <Animated.View style={[styles.intelligenceLens, { borderColor: phaseColor, opacity: intelligenceWakeOpacity, transform: [{ scale: intelligenceLensScale }] }]} />
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
  organismFarCurrent: {
    position: "absolute",
    width: 700,
    height: 72,
    borderTopLeftRadius: 86,
    borderTopRightRadius: 136,
    borderBottomRightRadius: 44,
    borderBottomLeftRadius: 112,
    left: -290,
    top: 326,
  },
  refractiveWake: {
    position: "absolute",
    width: 488,
    height: 86,
    left: -154,
    top: 196,
    borderTopLeftRadius: 72,
    borderTopRightRadius: 128,
    borderBottomRightRadius: 46,
    borderBottomLeftRadius: 114,
  },
  causticCrest: { position: "absolute", width: 248, height: 3, right: -36, top: 220, borderTopLeftRadius: 12, borderTopRightRadius: 4, borderBottomRightRadius: 10, borderBottomLeftRadius: 3 },
  signalTrail: { position: "absolute", width: 148, height: 8, left: 58, top: 234, borderTopLeftRadius: 18, borderTopRightRadius: 4, borderBottomRightRadius: 14, borderBottomLeftRadius: 3 },
  signalHalo: { position: "absolute", width: 42, height: 42, left: 108, top: 217, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.012)" },
  signalCore: { position: "absolute", width: 10, height: 10, left: 124, top: 233, borderRadius: 999, shadowColor: "#FFFFFF", shadowOpacity: 0.48, shadowRadius: 9 },
  activeThread: { position: "absolute", width: 208, height: 2, left: 68, top: 316, borderTopLeftRadius: 16, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  handoffHalo: { position: "absolute", width: 38, height: 38, right: 28, top: 300, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.010)" },
  handoffNode: { position: "absolute", width: 8, height: 8, right: 43, top: 315, borderRadius: 999, shadowColor: "#FFFFFF", shadowOpacity: 0.44, shadowRadius: 8 },
  octaveMacro: { position: "absolute", width: 620, height: 170, right: -254, top: 210, borderTopLeftRadius: 246, borderTopRightRadius: 92, borderBottomRightRadius: 220, borderBottomLeftRadius: 68, shadowColor: "#A8FFDA", shadowOpacity: 0.12, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  octaveMid: { position: "absolute", width: 462, height: 110, right: -144, top: 260, borderTopLeftRadius: 178, borderTopRightRadius: 72, borderBottomRightRadius: 162, borderBottomLeftRadius: 50, shadowColor: "#A8FFDA", shadowOpacity: 0.10, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  octaveFine: { position: "absolute", width: 298, height: 42, right: -30, top: 316, borderTopLeftRadius: 110, borderTopRightRadius: 32, borderBottomRightRadius: 100, borderBottomLeftRadius: 20 },
  octaveGlint: { position: "absolute", width: 176, height: 2, right: 22, top: 322, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 12, borderBottomLeftRadius: 1, shadowColor: "#A8FFDA", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  fusionVeil: { position: "absolute", width: 548, height: 214, right: -132, top: 214, borderTopLeftRadius: 210, borderTopRightRadius: 76, borderBottomRightRadius: 194, borderBottomLeftRadius: 62, shadowColor: "#A8FFDA", shadowOpacity: 0.05, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  cardGlaze: { position: "absolute", width: 218, height: 2, right: 40, top: 320, borderTopLeftRadius: 22, borderTopRightRadius: 2, borderBottomRightRadius: 20, borderBottomLeftRadius: 1, shadowColor: "#A8FFDA", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  softWaveFar: { position: "absolute", width: 420, height: 94, right: -138, top: 248, borderTopLeftRadius: 166, borderTopRightRadius: 76, borderBottomRightRadius: 144, borderBottomLeftRadius: 58 },
  softWaveMid: { position: "absolute", width: 356, height: 74, right: -94, top: 274, borderTopLeftRadius: 138, borderTopRightRadius: 64, borderBottomRightRadius: 126, borderBottomLeftRadius: 48 },
  softWaveNear: { position: "absolute", width: 282, height: 56, right: -46, top: 300, borderTopLeftRadius: 104, borderTopRightRadius: 48, borderBottomRightRadius: 96, borderBottomLeftRadius: 34 },
  decisionBloomOuter: { position: "absolute", width: 82, height: 48, right: 5, top: 293, borderTopLeftRadius: 31, borderTopRightRadius: 15, borderBottomRightRadius: 28, borderBottomLeftRadius: 12, borderWidth: 0.1, backgroundColor: "rgba(255,255,255,0.008)" },
  decisionBloomInner: { position: "absolute", width: 48, height: 27, right: 22, top: 304, borderTopLeftRadius: 19, borderTopRightRadius: 9, borderBottomRightRadius: 17, borderBottomLeftRadius: 7, borderWidth: 0.1 },
  decisionGlint: { position: "absolute", width: 44, height: 3, right: 19, top: 318, borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  livingSignal: {
    position: "absolute",
    width: 124,
    height: 4,
    left: 92,
    top: 236,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 9,
  },
  currentBand: {
    position: "absolute",
    width: 620,
    height: 126,
    borderTopLeftRadius: 92,
    borderTopRightRadius: 172,
    borderBottomRightRadius: 62,
    borderBottomLeftRadius: 146,
    right: -220,
    top: 154,
  },
  currentLine: {
    position: "absolute",
    left: -100,
    right: -100,
    top: 218,
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
  intelligenceWake: { position: "absolute", left: -128, right: -128, top: 218, height: 66, borderRadius: 999 },
  intelligenceLens: { position: "absolute", width: 170, height: 170, borderRadius: 999, borderWidth: 1, right: -78, top: 76, backgroundColor: "rgba(255,255,255,0.008)" },
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
