import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { WATER_MOTION, WATER_TONES } from "./tokens";

export type WaterRadarSignal = {
  name: string;
  meta: string;
  kind: "live" | "radar";
};

type WaterRadarV2Props = {
  liveCount: number;
  radarCount: number;
  countryCount: number;
  cuisineCount: number;
  networkTruth: "syncing" | "live" | "stale";
  hasActiveOrder: boolean;
  activeStage: number;
  signal?: WaterRadarSignal;
  reduceMotion?: boolean;
  onOpenPulse: () => void;
  onOpenSignal?: () => void;
};

/**
 * DelishAfrica® Water Radar V2.
 *
 * Product contract:
 * - visualises only data/signals already present in the marketplace;
 * - does not call the network and never mutates order/payment/auth state;
 * - "intelligence" is explainable and bounded: prioritisation remains transparent;
 * - CHOIX remains explicitly human;
 * - transform/opacity only; Reduce Motion collapses to a stable composition.
 */
// DA_GALA_RADAR_INTELLIGENCE_WAKE_V4 - network truth shapes the discovery current, never the user choice.
// DA_GALA_NETWORK_ORGANISM_V1 - ONE CURRENT: macro 14.8s / signal 6.8s / micro 5.7s; reading zones remain calm.
// DA_GALA_REFRACTIVE_INTELLIGENCE_V1 - living signal rides inside a softer, asymmetrical refractive wake.
// DA_GALA_CAUSTIC_CORE_V1 - the living signal gains a luminous pearl, wake-tail and caustic crest without adding timers.
// DA_GALA_LIVING_FOCUS_V1 - the signal now hands off toward one visible action focus; no autonomous action, no new timer.
// DA_GALA_DECISION_BLOOM_V1 - the arriving signal opens a refractive decision aperture at the human action focus; no autonomous action, no new timer.
// DA_GALA_HYDRODYNAMIC_VEIL_V1 - hard aperture geometry dissolves into layered, phase-shifted soft water veils; no new timer.
// DA_GALA_MULTI_OCTAVE_SURF_V1 - independent macro/mid/fine wave bands dissolve hard silhouettes into feathered caustic water; no new timer.
// DA_GALA_SUBSURFACE_CONTINUUM_V1 - subtractive soft-fusion pass reduces dominant layers and injects seamless veils so the interface reads as one living liquid field; no new timer.
// DA_GALA_OSMOTIC_SEAM_V1 - Client water loses one more degree of layer legibility so cards and current read as one field; no new timer.
// DA_GALA_PHASE_DECOHERENCE_V1 - multi-axis phase drift and boundary evaporation dissolve residual layer geometry while preserving business truth and existing animation clocks.
export function WaterRadarV2({
  liveCount,
  radarCount,
  countryCount,
  cuisineCount,
  networkTruth,
  hasActiveOrder,
  activeStage,
  signal,
  reduceMotion = false,
  onOpenPulse,
  onOpenSignal,
}: WaterRadarV2Props) {
  const sweep = useRef(new Animated.Value(0)).current;
  const tide = useRef(new Animated.Value(0)).current;
  const palette = WATER_TONES.client;
  const stateEnergy = networkTruth === "live" ? 1 : networkTruth === "stale" ? 0.38 : 0.66;
  const stateColor = networkTruth === "stale" ? palette.accent : palette.signal;
  const intelligenceWakeOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.014 * stateEnergy, 0.052 * stateEnergy] });
  const intelligenceLensScale = tide.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.11] });
  const refractiveOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.055 * stateEnergy, 0.18 * stateEnergy] });
  const livingSignalX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-118, 176] });
  const livingSignalOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.10 * stateEnergy, 0.42 * stateEnergy] });
  const causticCrestOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.06 * stateEnergy, 0.34 * stateEnergy] });
  const signalTrailOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.05 * stateEnergy, 0.28 * stateEnergy] });
  const signalHaloScale = tide.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.34] });
  const signalCoreScale = tide.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.22] });
  const activeThreadOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.04 * stateEnergy, 0.26 * stateEnergy] });
  const activeThreadScale = tide.interpolate({ inputRange: [0, 1], outputRange: [0.56, 1.08] });
  const handoffHaloOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.08 * stateEnergy, 0.38 * stateEnergy] });
  const handoffNodeScale = tide.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.28] });
  const decisionBloomOpacity = sweep.interpolate({ inputRange: [0, 0.68, 0.90, 1], outputRange: [0.0022 * stateEnergy, 0.005 * stateEnergy, 0.030 * stateEnergy, 0.008 * stateEnergy] });
  const decisionBloomScale = sweep.interpolate({ inputRange: [0, 0.72, 0.90, 1], outputRange: [0.78, 0.86, 1.22, 0.96] });
  const decisionArcRotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ["-13deg", "11deg"] });
  const decisionGlintX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });
  const softWaveAOpacity = sweep.interpolate({ inputRange: [0, 0.34, 0.72, 1], outputRange: [0.0028 * stateEnergy, 0.011 * stateEnergy, 0.026 * stateEnergy, 0.007 * stateEnergy] });
  const softWaveBOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.004 * stateEnergy, 0.018 * stateEnergy] });
  const softWaveCOpacity = sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0025 * stateEnergy, 0.014 * stateEnergy, 0.004 * stateEnergy] });
  const softWaveShift = sweep.interpolate({ inputRange: [0, 1], outputRange: [-28, 26] });
  const softWaveReverse = sweep.interpolate({ inputRange: [0, 1], outputRange: [22, -18] });
  const softWaveScaleX = tide.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const softWaveScaleY = sweep.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] });
  // Multi-octave approximation inspired by physical water rendering: independent scales, directions and phase changes.
  const octaveMacroX = sweep.interpolate({ inputRange: [0, 0.22, 0.51, 0.78, 1], outputRange: [-46, -8, 38, 12, -34] });
  const octaveMacroY = sweep.interpolate({ inputRange: [0, 0.22, 0.51, 0.78, 1], outputRange: [11, -7, 8, -9, 4] });
  const octaveMidX = sweep.interpolate({ inputRange: [0, 0.26, 0.48, 0.74, 1], outputRange: [24, -22, 10, 28, -12] });
  const octaveMidY = sweep.interpolate({ inputRange: [0, 0.26, 0.48, 0.74, 1], outputRange: [-5, 9, -6, 7, -3] });
  const octaveFineX = sweep.interpolate({ inputRange: [0, 0.18, 0.43, 0.69, 1], outputRange: [-16, 13, -9, 17, -6] });
  const octaveFineY = sweep.interpolate({ inputRange: [0, 0.18, 0.43, 0.69, 1], outputRange: [5, -4, 7, -6, 2] });
  const octaveMacroOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.0018 * stateEnergy, 0.0085 * stateEnergy] });
  const octaveMidOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.0025 * stateEnergy, 0.011 * stateEnergy] });
  const octaveFineOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.0033 * stateEnergy, 0.015 * stateEnergy] });
  const octaveGlintOpacity = tide.interpolate({ inputRange: [0, 1], outputRange: [0.005 * stateEnergy, 0.034 * stateEnergy] });
  const octaveMacroScale = tide.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.07] });
  const octaveMidScale = tide.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.93] });
  const softWaveFarY = sweep.interpolate({ inputRange: [0, 0.24, 0.55, 0.82, 1], outputRange: [6, -7, 10, -5, 3] });
  const softWaveMidY = sweep.interpolate({ inputRange: [0, 0.28, 0.50, 0.76, 1], outputRange: [-5, 8, -7, 6, -3] });
  const softWaveNearY = sweep.interpolate({ inputRange: [0, 0.20, 0.46, 0.72, 1], outputRange: [4, -6, 7, -4, 2] });
  const softWaveFarRotate = sweep.interpolate({ inputRange: [0, 0.24, 0.55, 0.82, 1], outputRange: ["-7deg", "-2deg", "3deg", "-5deg", "-1deg"] });
  const softWaveMidRotate = sweep.interpolate({ inputRange: [0, 0.28, 0.50, 0.76, 1], outputRange: ["4deg", "-1deg", "5deg", "1deg", "3deg"] });
  const softWaveNearRotate = sweep.interpolate({ inputRange: [0, 0.20, 0.46, 0.72, 1], outputRange: ["-3deg", "2deg", "-4deg", "1deg", "-2deg"] });
  const octaveGlintRotate = sweep.interpolate({ inputRange: [0, 0.32, 0.68, 1], outputRange: ["-5deg", "1deg", "4deg", "-2deg"] });

  useEffect(() => {
    sweep.stopAnimation();
    tide.stopAnimation();

    if (reduceMotion) {
      sweep.setValue(0.18);
      tide.setValue(0.42);
      return undefined;
    }

    const sweepLoop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 14800,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
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

    sweepLoop.start();
    tideLoop.start();
    return () => {
      sweepLoop.stop();
      tideLoop.stop();
    };
  }, [reduceMotion, sweep, tide]);

  const sweepRotation = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const pulseScale = tide.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1.16],
  });
  const pulseOpacity = tide.interpolate({
    inputRange: [0, 1],
    outputRange: [0.46, 0.94],
  });

  const state = useMemo(() => {
    if (hasActiveOrder) {
      const stage = activeStage >= 2 ? "ROUTE" : activeStage === 1 ? "CUISINE" : "DEMANDE";
      return {
        kicker: "COURANT PERSONNEL",
        title: "Votre commande traverse déjà le réseau.",
        body: `Le Radar garde ${stage.toLowerCase()} au premier plan sans masquer la découverte autour de vous.`,
        marker: stage,
      };
    }
    if (signal) {
      return {
        kicker: signal.kind === "live" ? "SIGNAL OUVERT" : "SIGNAL À L’HORIZON",
        title: `${signal.name} remonte dans le courant.`,
        body: signal.kind === "live"
          ? "Une table réellement disponible est priorisée. Vous gardez toujours la décision."
          : "Une adresse publique qualifiée apparaît en veille. Aucun statut d’ouverture n’est inventé.",
        marker: signal.kind === "live" ? "OUVERT" : "VEILLE",
      };
    }
    return {
      kicker: "RADAR CALME",
      title: "Le marché se dessine autour de vous.",
      body: "Les signaux deviennent visibles à mesure qu’ils sont qualifiés, sans fabriquer de disponibilité.",
      marker: "ÉCOUTE",
    };
  }, [activeStage, hasActiveOrder, signal]);

  const networkLabel = networkTruth === "live" ? "LIVE" : networkTruth === "stale" ? "STALE" : "SYNC";

  return (
    <View
      style={[styles.shell, { backgroundColor: palette.background, borderColor: palette.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`Radar DelishAfrica. ${liveCount} partenaires actifs, ${radarCount} signaux en veille.`}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.organismFarCurrent,
            {
              backgroundColor: palette.currentStrong,
              opacity: stateEnergy * 0.085,
              transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-150, 150] }) }, { rotate: "4deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.refractiveWake,
            {
              backgroundColor: stateColor,
              opacity: refractiveOpacity,
              transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-54, 72] }) }, { rotate: "-4deg" }, { scaleX: 1.04 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.causticCrest,
            { backgroundColor: stateColor, opacity: causticCrestOpacity, transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-66, 82] }) }, { rotate: "-4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalTrail,
            { backgroundColor: stateColor, opacity: signalTrailOpacity, transform: [{ translateX: livingSignalX }, { rotate: "-4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalHalo,
            { borderColor: stateColor, opacity: signalTrailOpacity, transform: [{ translateX: livingSignalX }, { scale: signalHaloScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalCore,
            { backgroundColor: stateColor, opacity: livingSignalOpacity, transform: [{ translateX: livingSignalX }, { scale: signalCoreScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.activeThread,
            { backgroundColor: stateColor, opacity: activeThreadOpacity, transform: [{ translateX: livingSignalX }, { scaleX: activeThreadScale }, { rotate: "-4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.handoffHalo,
            { borderColor: stateColor, opacity: handoffHaloOpacity, transform: [{ scale: handoffNodeScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.handoffNode,
            { backgroundColor: stateColor, opacity: handoffHaloOpacity, transform: [{ scale: handoffNodeScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveMacro,
            { backgroundColor: stateColor, opacity: octaveMacroOpacity, transform: [{ translateX: octaveMacroX }, { translateY: octaveMacroY }, { scale: octaveMacroScale }, { rotate: "-4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveMid,
            { backgroundColor: stateColor, opacity: octaveMidOpacity, transform: [{ translateX: octaveMidX }, { translateY: octaveMidY }, { scale: octaveMidScale }, { rotate: "3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveFine,
            { backgroundColor: stateColor, opacity: octaveFineOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveGlint,
            { backgroundColor: stateColor, opacity: octaveGlintOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.fusionVeil,
            { backgroundColor: stateColor, opacity: octaveMacroOpacity, transform: [{ translateX: octaveMidX }, { translateY: octaveMacroY }, { scale: octaveMacroScale }, { rotate: "-3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.cardGlaze,
            { backgroundColor: "#C8FFF4", opacity: octaveGlintOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveFar,
            { backgroundColor: stateColor, opacity: softWaveCOpacity, transform: [{ translateX: softWaveReverse }, { translateY: softWaveFarY }, { scaleX: softWaveScaleX }, { scaleY: softWaveScaleY }, { rotate: softWaveFarRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveMid,
            { backgroundColor: stateColor, opacity: softWaveBOpacity, transform: [{ translateX: softWaveShift }, { translateY: softWaveMidY }, { scaleX: softWaveScaleX }, { rotate: softWaveMidRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveNear,
            { backgroundColor: stateColor, opacity: softWaveAOpacity, transform: [{ translateX: softWaveReverse }, { translateY: softWaveNearY }, { scaleY: softWaveScaleY }, { rotate: softWaveNearRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomOuter,
            { borderColor: stateColor, opacity: decisionBloomOpacity, transform: [{ scale: decisionBloomScale }, { rotate: decisionArcRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomInner,
            { borderColor: stateColor, opacity: decisionBloomOpacity, transform: [{ scale: decisionBloomScale }, { rotate: "7deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionGlint,
            { backgroundColor: stateColor, opacity: decisionBloomOpacity, transform: [{ translateX: decisionGlintX }, { rotate: decisionArcRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.livingSignal,
            {
              backgroundColor: stateColor,
              opacity: livingSignalOpacity,
              transform: [{ translateX: livingSignalX }, { rotate: "-4deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.current,
            {
              backgroundColor: palette.current,
              opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.070, 0.145] }),
              transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-42, 54] }) }, { rotate: "-8deg" }],
            },
          ]}
        />
        <View style={[styles.depthHalo, { borderColor: palette.border }]} />
        <Animated.View style={[styles.intelligenceWake, { backgroundColor: stateColor, opacity: intelligenceWakeOpacity, transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-76, 104] }) }, { rotate: "-5deg" }] }]} />
        <Animated.View style={[styles.intelligenceLens, { borderColor: stateColor, opacity: intelligenceWakeOpacity, transform: [{ scale: intelligenceLensScale }] }]} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerLead}>
          <Animated.View
            style={[
              styles.beacon,
              { backgroundColor: palette.signal, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: palette.signal }]}>RADAR · DISCOVERY OCEAN</Text>
            <Text style={[styles.micro, { color: palette.body }]}>Intelligence explicable · choix humain</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { borderColor: palette.border, backgroundColor: palette.chip }]}>
          <Text style={[styles.statusText, { color: networkTruth === "stale" ? palette.accent : palette.signal }]}>
            {networkLabel}
          </Text>
        </View>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.copyColumn}>
          <Text style={[styles.stateKicker, { color: palette.accent }]}>{state.kicker}</Text>
          <Text style={[styles.title, { color: palette.title }]}>{state.title}</Text>
          <Text style={[styles.body, { color: palette.body }]}>{state.body}</Text>

          <View style={styles.metricGrid}>
            <Metric value={liveCount} label="OUVERTS" />
            <Metric value={radarCount} label="VEILLE" />
            <Metric value={countryCount} label="PAYS" />
            <Metric value={cuisineCount} label="CUISINES" />
          </View>
        </View>

        <View style={styles.radarColumn} pointerEvents="none">
          <View style={[styles.radarDisc, { borderColor: palette.border }]}>
            <View style={[styles.ringOuter, { borderColor: palette.border }]} />
            <View style={[styles.ringMid, { borderColor: palette.border }]} />
            <View style={[styles.ringInner, { borderColor: palette.border }]} />
            <View style={[styles.crossHorizontal, { backgroundColor: palette.currentStrong }]} />
            <View style={[styles.crossVertical, { backgroundColor: palette.currentStrong }]} />

            <Animated.View style={[styles.sweepRotor, { transform: [{ rotate: sweepRotation }] }]}>
              <View style={[styles.sweepLine, { backgroundColor: palette.signal }]} />
              <View style={[styles.sweepGlow, { backgroundColor: palette.currentStrong }]} />
            </Animated.View>

            <Animated.View
              style={[
                styles.blip,
                styles.blipA,
                { backgroundColor: palette.signal, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.blip,
                styles.blipB,
                { backgroundColor: palette.accent, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
              ]}
            />
            <View style={[styles.blip, styles.blipC, { backgroundColor: palette.signal }]} />
            <View style={[styles.centerDot, { backgroundColor: palette.title, borderColor: palette.signal }]} />
          </View>
          <View style={[styles.stagePill, { backgroundColor: palette.chip, borderColor: palette.border }]}>
            <Text style={[styles.stagePillText, { color: palette.accent }]}>{state.marker}</Text>
          </View>
        </View>
      </View>

      {signal ? (
        <Pressable
          disabled={!onOpenSignal}
          onPress={onOpenSignal}
          style={({ pressed }) => [
            styles.signalCard,
            { borderColor: palette.border, backgroundColor: "rgba(1, 17, 17, 0.38)" },
            pressed && styles.pressed,
          ]}
          accessibilityRole={onOpenSignal ? "button" : undefined}
          accessibilityLabel={`${signal.name}. ${signal.meta}`}
          accessibilityHint={onOpenSignal ? "Ouvre ce signal dans la marketplace" : undefined}
        >
          <View style={[styles.signalKindPill, { backgroundColor: palette.chip }]}>
            <Text style={[styles.signalKind, { color: signal.kind === "live" ? palette.signal : palette.accent }]}>
              {signal.kind === "live" ? "TABLE OUVERTE" : "SIGNAL QUALIFIÉ"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.signalName, { color: palette.title }]} numberOfLines={1}>{signal.name}</Text>
            <Text style={[styles.signalMeta, { color: palette.body }]} numberOfLines={1}>{signal.meta}</Text>
          </View>
          {onOpenSignal ? <Text style={[styles.signalArrow, { color: palette.accent }]}>→</Text> : null}
        </Pressable>
      ) : null}

      <Pressable
        onPress={onOpenPulse}
        style={({ pressed }) => [
          styles.pulseAction,
          { borderColor: palette.border, backgroundColor: palette.chip },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir le pouls du réseau"
        accessibilityHint="Affiche les signaux de développement déjà qualifiés"
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.pulseActionKicker, { color: palette.signal }]}>PULSE DU RÉSEAU</Text>
          <Text style={[styles.pulseActionText, { color: palette.title }]}>Voir pourquoi ces signaux remontent.</Text>
        </View>
        <Text style={[styles.signalArrow, { color: palette.accent }]}>→</Text>
      </Pressable>
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 22,
    marginBottom: 24,
    borderWidth: 1,
    borderRadius: 34,
    padding: 18,
    overflow: "hidden",
  },
  organismFarCurrent: {
    position: "absolute",
    width: 660,
    height: 72,
    borderTopLeftRadius: 64,
    borderTopRightRadius: 108,
    borderBottomRightRadius: 48,
    borderBottomLeftRadius: 92,
    left: -250,
    top: 224,
  },
  refractiveWake: {
    position: "absolute",
    width: 470,
    height: 86,
    left: -146,
    top: 188,
    borderTopLeftRadius: 78,
    borderTopRightRadius: 126,
    borderBottomRightRadius: 54,
    borderBottomLeftRadius: 108,
  },
  causticCrest: { position: "absolute", width: 238, height: 3, right: -32, top: 208, borderTopLeftRadius: 12, borderTopRightRadius: 4, borderBottomRightRadius: 10, borderBottomLeftRadius: 3 },
  signalTrail: { position: "absolute", width: 142, height: 8, left: 46, top: 220, borderTopLeftRadius: 18, borderTopRightRadius: 4, borderBottomRightRadius: 14, borderBottomLeftRadius: 3 },
  signalHalo: { position: "absolute", width: 42, height: 42, left: 91, top: 203, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.012)" },
  signalCore: { position: "absolute", width: 10, height: 10, left: 107, top: 219, borderRadius: 999, shadowColor: "#FFFFFF", shadowOpacity: 0.48, shadowRadius: 9 },
  activeThread: { position: "absolute", width: 194, height: 2, left: 76, top: 304, borderTopLeftRadius: 16, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  handoffHalo: { position: "absolute", width: 38, height: 38, right: 28, top: 288, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.010)" },
  handoffNode: { position: "absolute", width: 8, height: 8, right: 43, top: 303, borderRadius: 999, shadowColor: "#FFFFFF", shadowOpacity: 0.44, shadowRadius: 8 },
  octaveMacro: { position: "absolute", width: 590, height: 168, right: -242, top: 196, borderTopLeftRadius: 236, borderTopRightRadius: 96, borderBottomRightRadius: 214, borderBottomLeftRadius: 72, shadowColor: "#C8FFF4", shadowOpacity: 0.12, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  octaveMid: { position: "absolute", width: 438, height: 108, right: -132, top: 246, borderTopLeftRadius: 168, borderTopRightRadius: 74, borderBottomRightRadius: 154, borderBottomLeftRadius: 54, shadowColor: "#C8FFF4", shadowOpacity: 0.10, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  octaveFine: { position: "absolute", width: 286, height: 42, right: -28, top: 304, borderTopLeftRadius: 104, borderTopRightRadius: 34, borderBottomRightRadius: 96, borderBottomLeftRadius: 22 },
  octaveGlint: { position: "absolute", width: 166, height: 2, right: 24, top: 308, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 12, borderBottomLeftRadius: 1, shadowColor: "#C8FFF4", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  fusionVeil: { position: "absolute", width: 660, height: 260, right: -218, top: 192, borderTopLeftRadius: 260, borderTopRightRadius: 112, borderBottomRightRadius: 236, borderBottomLeftRadius: 90, shadowColor: "#C8FFF4", shadowOpacity: 0.016, shadowRadius: 38, shadowOffset: { width: 0, height: 0 } },
  cardGlaze: { position: "absolute", width: 150, height: 1, right: 58, top: 312, borderTopLeftRadius: 22, borderTopRightRadius: 2, borderBottomRightRadius: 20, borderBottomLeftRadius: 1, shadowColor: "#C8FFF4", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  softWaveFar: { position: "absolute", width: 390, height: 94, right: -122, top: 238, borderTopLeftRadius: 154, borderTopRightRadius: 84, borderBottomRightRadius: 132, borderBottomLeftRadius: 66 },
  softWaveMid: { position: "absolute", width: 330, height: 76, right: -82, top: 261, borderTopLeftRadius: 122, borderTopRightRadius: 70, borderBottomRightRadius: 114, borderBottomLeftRadius: 52 },
  softWaveNear: { position: "absolute", width: 262, height: 58, right: -38, top: 286, borderTopLeftRadius: 92, borderTopRightRadius: 54, borderBottomRightRadius: 86, borderBottomLeftRadius: 38 },
  decisionBloomOuter: { position: "absolute", width: 78, height: 50, right: 7, top: 281, borderTopLeftRadius: 30, borderTopRightRadius: 18, borderBottomRightRadius: 29, borderBottomLeftRadius: 14, borderWidth: 0.1, backgroundColor: "rgba(255,255,255,0.008)" },
  decisionBloomInner: { position: "absolute", width: 46, height: 28, right: 23, top: 292, borderTopLeftRadius: 18, borderTopRightRadius: 12, borderBottomRightRadius: 17, borderBottomLeftRadius: 9, borderWidth: 0.1 },
  decisionGlint: { position: "absolute", width: 40, height: 3, right: 22, top: 306, borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  livingSignal: {
    position: "absolute",
    width: 116,
    height: 4,
    left: 74,
    top: 222,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 11,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 8,
  },
  current: {
    position: "absolute",
    width: 520,
    height: 120,
    borderTopLeftRadius: 104,
    borderTopRightRadius: 154,
    borderBottomRightRadius: 68,
    borderBottomLeftRadius: 132,
    right: -210,
    top: 154,
  },
  depthHalo: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    right: -150,
    top: -120,
    borderWidth: 1,
    backgroundColor: "rgba(8, 70, 68, 0.12)",
  },
  intelligenceWake: { position: "absolute", left: -116, right: -116, top: 178, height: 56, borderRadius: 999 },
  intelligenceLens: { position: "absolute", width: 158, height: 158, borderRadius: 999, borderWidth: 1, right: -76, top: 54, backgroundColor: "rgba(255,255,255,0.008)" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLead: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  beacon: { width: 10, height: 10, borderRadius: 999 },
  kicker: { fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 2.1 },
  micro: { marginTop: 2, fontSize: 9, lineHeight: 13, fontWeight: "700", letterSpacing: 0.4 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  contentRow: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12 },
  copyColumn: { flex: 1, minWidth: 0 },
  stateKicker: { fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 1.7 },
  title: { marginTop: 8, fontSize: 23, lineHeight: 27, fontWeight: "900", letterSpacing: -0.8 },
  body: { marginTop: 8, fontSize: 12, lineHeight: 18, fontWeight: "500" },
  metricGrid: { marginTop: 15, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  metric: {
    minWidth: 58,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  metricValue: { color: "#FFF6E7", fontSize: 15, lineHeight: 18, fontWeight: "900" },
  metricLabel: { marginTop: 2, color: "rgba(231,242,237,0.52)", fontSize: 7, fontWeight: "900", letterSpacing: 1.0 },
  radarColumn: { width: 132, alignItems: "center" },
  radarDisc: {
    width: 126,
    height: 126,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(2, 25, 25, 0.50)",
    overflow: "hidden",
  },
  ringOuter: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: 1, opacity: 0.76 },
  ringMid: { position: "absolute", width: 86, height: 86, borderRadius: 999, borderWidth: 1, left: 19, top: 19, opacity: 0.58 },
  ringInner: { position: "absolute", width: 44, height: 44, borderRadius: 999, borderWidth: 1, left: 40, top: 40, opacity: 0.44 },
  crossHorizontal: { position: "absolute", left: 8, right: 8, top: 62, height: 1, opacity: 0.42 },
  crossVertical: { position: "absolute", top: 8, bottom: 8, left: 62, width: 1, opacity: 0.42 },
  sweepRotor: { ...StyleSheet.absoluteFillObject },
  sweepLine: { position: "absolute", left: 62, top: 61, width: 57, height: 2, borderRadius: 999, opacity: 0.74 },
  sweepGlow: { position: "absolute", left: 62, top: 53, width: 53, height: 18, borderRadius: 999, opacity: 0.18 },
  blip: { position: "absolute", width: 7, height: 7, borderRadius: 999, shadowColor: "#8CF7EA", shadowOpacity: 0.42, shadowRadius: 8 },
  blipA: { left: 82, top: 28 },
  blipB: { left: 30, top: 78 },
  blipC: { left: 91, top: 88, width: 5, height: 5, opacity: 0.7 },
  centerDot: { position: "absolute", left: 57, top: 57, width: 12, height: 12, borderRadius: 999, borderWidth: 2 },
  stagePill: { marginTop: 9, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stagePillText: { fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  signalCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  signalKindPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  signalKind: { fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  signalName: { fontSize: 13, lineHeight: 17, fontWeight: "900" },
  signalMeta: { marginTop: 2, fontSize: 9, lineHeight: 13 },
  signalArrow: { fontSize: 24, fontWeight: "700" },
  pulseAction: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pulseActionKicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  pulseActionText: { marginTop: 3, fontSize: 11, lineHeight: 15, fontWeight: "800" },
  pressed: { opacity: 0.82, transform: [{ scale: WATER_MOTION.pressScale }] },
});
