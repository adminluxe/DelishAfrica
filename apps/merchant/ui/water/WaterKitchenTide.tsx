import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { WATER_MOTION, WATER_TONES } from "./tokens";

export type KitchenTideNetworkTruth = "syncing" | "live" | "stale";

type KitchenTidePriority = {
  id: string;
  restaurant: string;
  summary: string;
  updated: string;
};

type WaterKitchenTideProps = {
  pending: number;
  cooking: number;
  ready: number;
  route: number;
  networkTruth: KitchenTideNetworkTruth;
  serviceOpen: boolean;
  priority?: KitchenTidePriority | null;
  reduceMotion?: boolean;
  onOpenQueue: () => void;
};

/**
 * DelishAfrica® Kitchen Tide.
 *
 * It is an explainable operational pulse, not an autonomous scheduler.
 * Pressure is derived only from already-visible queue states:
 *   pending x3 + ready x2 + cooking x1 + route x1.
 *
 * The component performs no fetch, persistence, order mutation, payment mutation,
 * dispatch decision, auth operation or hidden prioritisation.
 */
// DA_GALA_KITCHEN_INTELLIGENCE_WAKE_V4 - pressure and network truth shape a visible tide, never an autonomous decision.
// DA_GALA_NETWORK_ORGANISM_V1 - ONE CURRENT: macro 14.8s / signal 6.8s / micro 5.7s; kitchen warmth remains distinct.
// DA_GALA_REFRACTIVE_INTELLIGENCE_V1 - service pressure becomes a warm signal carried inside the tide.
// DA_GALA_CAUSTIC_CORE_V1 - the living signal gains a luminous pearl, wake-tail and caustic crest without adding timers.
// DA_GALA_LIVING_FOCUS_V1 - the signal now hands off toward one visible action focus; no autonomous action, no new timer.
// DA_GALA_DECISION_BLOOM_V1 - the arriving signal opens a refractive decision aperture at the human action focus; no autonomous action, no new timer.
// DA_GALA_HYDRODYNAMIC_VEIL_V1 - hard aperture geometry dissolves into layered, phase-shifted soft water veils; no new timer.
// DA_GALA_MULTI_OCTAVE_SURF_V1 - independent macro/mid/fine wave bands dissolve hard silhouettes into feathered caustic water; no new timer.
// DA_GALA_SUBSURFACE_CONTINUUM_V1 - subtractive soft-fusion pass reduces dominant layers and injects seamless veils so the interface reads as one living liquid field; no new timer.
// DA_GALA_OSMOTIC_SEAM_V1 - Merchant water is quieted toward Courier-level integration: less explicit layering, broader softer field; no new timer.
// DA_GALA_PHASE_DECOHERENCE_V1 - multi-axis phase drift and boundary evaporation dissolve residual layer geometry while preserving business truth and existing animation clocks.
export function WaterKitchenTide({
  pending,
  cooking,
  ready,
  route,
  networkTruth,
  serviceOpen,
  priority,
  reduceMotion = false,
  onOpenQueue,
}: WaterKitchenTideProps) {
  const palette = WATER_TONES.merchant;
  const drift = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  const pressure = Math.max(0, pending * 3 + ready * 2 + cooking + route);
  const pressurePct = Math.min(100, Math.round((pressure / 12) * 100));
  const networkEnergy = networkTruth === "live" ? 1 : networkTruth === "stale" ? 0.42 : 0.68;
  const workloadEnergy = Math.min(1, 0.34 + pressurePct / 100 * 0.66);
  const intelligenceEnergy = networkEnergy * workloadEnergy;
  const intelligenceColor = networkTruth === "stale" ? palette.accent : palette.signal;
  const intelligenceWakeOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.013 * intelligenceEnergy, 0.056 * intelligenceEnergy] });
  const intelligenceLensScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.90, 1.12] });
  const refractiveOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.05 * intelligenceEnergy, 0.17 * intelligenceEnergy] });
  const livingSignalX = drift.interpolate({ inputRange: [0, 1], outputRange: [-96, 148] });
  const livingSignalOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.09 * intelligenceEnergy, 0.40 * intelligenceEnergy] });
  const causticCrestOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.06 * intelligenceEnergy, 0.34 * intelligenceEnergy] });
  const signalTrailOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.05 * intelligenceEnergy, 0.28 * intelligenceEnergy] });
  const signalHaloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.34] });
  const signalCoreScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.22] });
  const activeThreadOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.04 * intelligenceEnergy, 0.26 * intelligenceEnergy] });
  const activeThreadScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.56, 1.08] });
  const handoffHaloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.08 * intelligenceEnergy, 0.38 * intelligenceEnergy] });
  const handoffNodeScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.28] });
  const decisionBloomOpacity = drift.interpolate({ inputRange: [0, 0.68, 0.90, 1], outputRange: [0.0022 * intelligenceEnergy, 0.005 * intelligenceEnergy, 0.030 * intelligenceEnergy, 0.008 * intelligenceEnergy] });
  const decisionBloomScale = drift.interpolate({ inputRange: [0, 0.72, 0.90, 1], outputRange: [0.78, 0.86, 1.22, 0.96] });
  const decisionArcRotate = drift.interpolate({ inputRange: [0, 1], outputRange: ["10deg", "-12deg"] });
  const decisionGlintX = drift.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });
  const softWaveAOpacity = drift.interpolate({ inputRange: [0, 0.34, 0.72, 1], outputRange: [0.0028 * intelligenceEnergy, 0.011 * intelligenceEnergy, 0.026 * intelligenceEnergy, 0.007 * intelligenceEnergy] });
  const softWaveBOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.004 * intelligenceEnergy, 0.018 * intelligenceEnergy] });
  const softWaveCOpacity = drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.0025 * intelligenceEnergy, 0.014 * intelligenceEnergy, 0.004 * intelligenceEnergy] });
  const softWaveShift = drift.interpolate({ inputRange: [0, 1], outputRange: [-28, 26] });
  const softWaveReverse = drift.interpolate({ inputRange: [0, 1], outputRange: [22, -18] });
  const softWaveScaleX = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const softWaveScaleY = drift.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] });
  // Multi-octave approximation inspired by physical water rendering: independent scales, directions and phase changes.
  const octaveMacroX = drift.interpolate({ inputRange: [0, 0.22, 0.51, 0.78, 1], outputRange: [42, 8, -36, -10, 30] });
  const octaveMacroY = drift.interpolate({ inputRange: [0, 0.22, 0.51, 0.78, 1], outputRange: [-9, 6, -8, 10, -4] });
  const octaveMidX = drift.interpolate({ inputRange: [0, 0.26, 0.48, 0.74, 1], outputRange: [-22, 26, -12, -28, 14] });
  const octaveMidY = drift.interpolate({ inputRange: [0, 0.26, 0.48, 0.74, 1], outputRange: [7, -6, 9, -5, 3] });
  const octaveFineX = drift.interpolate({ inputRange: [0, 0.18, 0.43, 0.69, 1], outputRange: [15, -12, 10, -18, 7] });
  const octaveFineY = drift.interpolate({ inputRange: [0, 0.18, 0.43, 0.69, 1], outputRange: [-4, 6, -7, 5, -2] });
  const octaveMacroOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.0020 * intelligenceEnergy, 0.0090 * intelligenceEnergy] });
  const octaveMidOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.0027 * intelligenceEnergy, 0.0120 * intelligenceEnergy] });
  const octaveFineOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.0035 * intelligenceEnergy, 0.0155 * intelligenceEnergy] });
  const octaveGlintOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.0052 * intelligenceEnergy, 0.036 * intelligenceEnergy] });
  const octaveMacroScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.07] });
  const octaveMidScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.93] });
  const softWaveFarY = drift.interpolate({ inputRange: [0, 0.24, 0.55, 0.82, 1], outputRange: [-6, 8, -9, 6, -3] });
  const softWaveMidY = drift.interpolate({ inputRange: [0, 0.28, 0.50, 0.76, 1], outputRange: [5, -7, 8, -6, 3] });
  const softWaveNearY = drift.interpolate({ inputRange: [0, 0.20, 0.46, 0.72, 1], outputRange: [-4, 6, -6, 5, -2] });
  const softWaveFarRotate = drift.interpolate({ inputRange: [0, 0.24, 0.55, 0.82, 1], outputRange: ["6deg", "2deg", "-3deg", "5deg", "1deg"] });
  const softWaveMidRotate = drift.interpolate({ inputRange: [0, 0.28, 0.50, 0.76, 1], outputRange: ["-4deg", "1deg", "-5deg", "-1deg", "-3deg"] });
  const softWaveNearRotate = drift.interpolate({ inputRange: [0, 0.20, 0.46, 0.72, 1], outputRange: ["3deg", "-2deg", "4deg", "-1deg", "2deg"] });
  const octaveGlintRotate = drift.interpolate({ inputRange: [0, 0.32, 0.68, 1], outputRange: ["5deg", "-1deg", "-4deg", "2deg"] });

  const tide = useMemo(() => {
    if (pending > 0) {
      return {
        state: "DÉCISION",
        title: pending === 1 ? "Une décision crée la prochaine vague." : `${pending} décisions retiennent le courant.`,
        body: "Les nouvelles commandes pèsent davantage car une réponse Merchant débloque immédiatement la suite.",
      };
    }
    if (ready > 0) {
      return {
        state: "REMISE",
        title: ready === 1 ? "La cuisine a fini. Le terrain prend le relais." : `${ready} remises attendent le terrain.`,
        body: "Une commande prête pèse double : la cuisson est terminée et l’attente doit rester courte.",
      };
    }
    if (cooking > 0) {
      return {
        state: "CUISINE",
        title: cooking === 1 ? "La cuisine avance dans un courant stable." : `${cooking} commandes avancent en cuisine.`,
        body: "Le Pulse suit la cadence sans fabriquer d’urgence tant qu’aucune décision ou remise n’attend.",
      };
    }
    if (route > 0) {
      return {
        state: "TERRAIN",
        title: "La remise est partie. Le cockpit garde le contexte.",
        body: "Le terrain reste visible sans reprendre la main sur la décision du Courier.",
      };
    }
    return {
      state: serviceOpen ? "CALME" : "VEILLE",
      title: serviceOpen ? "Le calme fait partie du service." : "La cuisine attend votre signal réel.",
      body: serviceOpen
        ? "Aucune pression n’est inventée. Kitchen Tide reste prêt pour le prochain geste utile."
        : "Le Pulse reste lisible sans simuler de demande tant que le service est fermé.",
    };
  }, [cooking, pending, ready, route, serviceOpen]);

  const explanation = useMemo(() => {
    const parts: string[] = [];
    if (pending) parts.push(`${pending} décision${pending > 1 ? "s" : ""} ×3`);
    if (ready) parts.push(`${ready} remise${ready > 1 ? "s" : ""} ×2`);
    if (cooking) parts.push(`${cooking} cuisine ×1`);
    if (route) parts.push(`${route} terrain ×1`);
    return parts.length ? parts.join(" + ") : "aucun signal de pression";
  }, [cooking, pending, ready, route]);

  useEffect(() => {
    drift.stopAnimation();
    breathe.stopAnimation();

    if (reduceMotion) {
      drift.setValue(0.24);
      breathe.setValue(0.46);
      return undefined;
    }

    const driftLoop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 14800,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    driftLoop.start();
    breatheLoop.start();
    return () => {
      driftLoop.stop();
      breatheLoop.stop();
    };
  }, [breathe, drift, reduceMotion]);

  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-72, 80],
  });
  const waveOpacity = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.30, 0.62],
  });
  const beaconScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.16],
  });

  const truthLabel = networkTruth === "live" ? "LIVE" : networkTruth === "stale" ? "STALE" : "SYNC";

  return (
    <View
      style={[styles.shell, { backgroundColor: palette.background, borderColor: palette.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`Kitchen Tide. Pression ${pressurePct} sur 100. ${pending} à décider, ${cooking} en cuisine, ${ready} à remettre.`}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.organismFarCurrent,
            {
              backgroundColor: palette.currentStrong,
              opacity: intelligenceEnergy * 0.082,
              transform: [{ translateX: driftX }, { rotate: "-3deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.refractiveWake,
            {
              backgroundColor: intelligenceColor,
              opacity: refractiveOpacity,
              transform: [{ translateX: driftX }, { rotate: "3deg" }, { scaleX: 1.03 }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.causticCrest,
            { backgroundColor: intelligenceColor, opacity: causticCrestOpacity, transform: [{ translateX: driftX }, { rotate: "3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalTrail,
            { backgroundColor: intelligenceColor, opacity: signalTrailOpacity, transform: [{ translateX: livingSignalX }, { rotate: "3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalHalo,
            { borderColor: intelligenceColor, opacity: signalTrailOpacity, transform: [{ translateX: livingSignalX }, { scale: signalHaloScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.signalCore,
            { backgroundColor: intelligenceColor, opacity: livingSignalOpacity, transform: [{ translateX: livingSignalX }, { scale: signalCoreScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.activeThread,
            { backgroundColor: intelligenceColor, opacity: activeThreadOpacity, transform: [{ translateX: livingSignalX }, { scaleX: activeThreadScale }, { rotate: "3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.handoffHalo,
            { borderColor: intelligenceColor, opacity: handoffHaloOpacity, transform: [{ scale: handoffNodeScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.handoffNode,
            { backgroundColor: intelligenceColor, opacity: handoffHaloOpacity, transform: [{ scale: handoffNodeScale }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveMacro,
            { backgroundColor: intelligenceColor, opacity: octaveMacroOpacity, transform: [{ translateX: octaveMacroX }, { translateY: octaveMacroY }, { scale: octaveMacroScale }, { rotate: "4deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveMid,
            { backgroundColor: intelligenceColor, opacity: octaveMidOpacity, transform: [{ translateX: octaveMidX }, { translateY: octaveMidY }, { scale: octaveMidScale }, { rotate: "-3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveFine,
            { backgroundColor: intelligenceColor, opacity: octaveFineOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.octaveGlint,
            { backgroundColor: intelligenceColor, opacity: octaveGlintOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.fusionVeil,
            { backgroundColor: intelligenceColor, opacity: octaveMacroOpacity, transform: [{ translateX: octaveMidX }, { translateY: octaveMacroY }, { scale: octaveMacroScale }, { rotate: "3deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.cardGlaze,
            { backgroundColor: "#FFD39B", opacity: octaveGlintOpacity, transform: [{ translateX: octaveFineX }, { translateY: octaveFineY }, { rotate: octaveGlintRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveFar,
            { backgroundColor: intelligenceColor, opacity: softWaveCOpacity, transform: [{ translateX: softWaveReverse }, { translateY: softWaveFarY }, { scaleX: softWaveScaleX }, { scaleY: softWaveScaleY }, { rotate: softWaveFarRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveMid,
            { backgroundColor: intelligenceColor, opacity: softWaveBOpacity, transform: [{ translateX: softWaveShift }, { translateY: softWaveMidY }, { scaleX: softWaveScaleX }, { rotate: softWaveMidRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.softWaveNear,
            { backgroundColor: intelligenceColor, opacity: softWaveAOpacity, transform: [{ translateX: softWaveReverse }, { translateY: softWaveNearY }, { scaleY: softWaveScaleY }, { rotate: softWaveNearRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomOuter,
            { borderColor: intelligenceColor, opacity: decisionBloomOpacity, transform: [{ scale: decisionBloomScale }, { rotate: decisionArcRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionBloomInner,
            { borderColor: intelligenceColor, opacity: decisionBloomOpacity, transform: [{ scale: decisionBloomScale }, { rotate: "-6deg" }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decisionGlint,
            { backgroundColor: intelligenceColor, opacity: decisionBloomOpacity, transform: [{ translateX: decisionGlintX }, { rotate: decisionArcRotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.livingSignal,
            {
              backgroundColor: intelligenceColor,
              opacity: livingSignalOpacity,
              transform: [{ translateX: livingSignalX }, { rotate: "3deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.currentBand,
            {
              backgroundColor: palette.current,
              opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.062, 0.135] }),
              transform: [{ translateX: driftX }, { rotate: "-7deg" }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.currentBand,
            styles.currentBandLower,
            {
              backgroundColor: palette.currentStrong,
              opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.062, 0.135] }),
              transform: [{ translateX: Animated.multiply(driftX, -0.62) }, { rotate: "6deg" }],
            },
          ]}
        />
        <View style={[styles.depthDisc, { borderColor: palette.border }]} />
        <Animated.View style={[styles.intelligenceWake, { backgroundColor: intelligenceColor, opacity: intelligenceWakeOpacity, transform: [{ translateX: driftX }, { rotate: "4deg" }] }]} />
        <Animated.View style={[styles.intelligenceLens, { borderColor: intelligenceColor, opacity: intelligenceWakeOpacity, transform: [{ scale: intelligenceLensScale }] }]} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerLead}>
          <Animated.View
            style={[
              styles.beacon,
              {
                backgroundColor: palette.signal,
                opacity: waveOpacity,
                transform: [{ scale: beaconScale }],
              },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: palette.signal }]}>PULSE · KITCHEN TIDE</Text>
            <Text style={[styles.micro, { color: palette.body }]}>Pression explicable · décision humaine</Text>
          </View>
        </View>
        <View style={[styles.truthPill, { backgroundColor: palette.chip, borderColor: palette.border }]}>
          <Text style={[styles.truthText, { color: networkTruth === "stale" ? palette.accent : palette.signal }]}>
            {truthLabel}
          </Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.copyColumn}>
          <Text style={[styles.state, { color: palette.accent }]}>{tide.state}</Text>
          <Text style={[styles.title, { color: palette.title }]}>{tide.title}</Text>
          <Text style={[styles.body, { color: palette.body }]}>{tide.body}</Text>
        </View>

        <View style={styles.gaugeColumn} pointerEvents="none">
          <View style={[styles.gauge, { borderColor: palette.border, backgroundColor: palette.chip }]}>
            <Text style={[styles.gaugeValue, { color: palette.title }]}>{pressurePct}</Text>
            <Text style={[styles.gaugeUnit, { color: palette.body }]}>/100</Text>
            <View style={[styles.gaugeTrack, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
              <View
                style={[
                  styles.gaugeFill,
                  {
                    width: `${Math.max(6, pressurePct)}%`,
                    backgroundColor: pressurePct >= 60 ? palette.signal : palette.accent,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.gaugeCaption, { color: palette.body }]}>TIDE</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric value={pending} label="DÉCIDER" tone={palette.signal} />
        <Metric value={cooking} label="CUISINE" tone={palette.accent} />
        <Metric value={ready} label="REMISE" tone={palette.signal} />
        <Metric value={route} label="TERRAIN" tone={palette.accent} />
      </View>

      <View style={[styles.whyCard, { borderColor: palette.border, backgroundColor: "rgba(28, 17, 10, 0.42)" }]}>
        <Text style={[styles.whyKicker, { color: palette.signal }]}>POURQUOI CE NIVEAU ?</Text>
        <Text style={[styles.whyFormula, { color: palette.title }]}>{explanation}</Text>
        <Text style={[styles.whyBody, { color: palette.body }]}>
          Indice opérationnel uniquement. Ce n’est ni une note qualité ni une décision automatique.
        </Text>
      </View>

      {priority ? (
        <View style={[styles.priorityCard, { borderColor: palette.border, backgroundColor: palette.chip }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.priorityKicker, { color: palette.accent }]}>COURANT PRIORITAIRE</Text>
            <Text style={[styles.priorityTitle, { color: palette.title }]}>{priority.id}</Text>
            <Text style={[styles.priorityMeta, { color: palette.body }]} numberOfLines={1}>
              {priority.restaurant} · {priority.summary} · {priority.updated}
            </Text>
          </View>
          <View style={[styles.priorityDot, { backgroundColor: palette.signal }]} />
        </View>
      ) : null}

      <Pressable
        onPress={onOpenQueue}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: palette.chip, borderColor: palette.border },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Ouvrir la file de commandes"
        accessibilityHint="Affiche la file opérationnelle sans modifier automatiquement les commandes"
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionKicker, { color: palette.signal }]}>CHOIX MERCHANT</Text>
          <Text style={[styles.actionText, { color: palette.title }]}>Ouvrir la file et décider.</Text>
        </View>
        <Text style={[styles.arrow, { color: palette.accent }]}>→</Text>
      </Pressable>
    </View>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 1,
    borderRadius: 32,
    padding: 18,
    overflow: "hidden",
    gap: 16,
  },
  organismFarCurrent: {
    position: "absolute",
    width: 680,
    height: 76,
    borderTopLeftRadius: 72,
    borderTopRightRadius: 116,
    borderBottomRightRadius: 52,
    borderBottomLeftRadius: 96,
    right: -280,
    top: 332,
  },
  refractiveWake: {
    position: "absolute",
    width: 452,
    height: 82,
    right: -116,
    top: 214,
    borderTopLeftRadius: 122,
    borderTopRightRadius: 66,
    borderBottomRightRadius: 104,
    borderBottomLeftRadius: 48,
  },
  causticCrest: { position: "absolute", width: 226, height: 3, left: -24, top: 238, borderTopLeftRadius: 12, borderTopRightRadius: 4, borderBottomRightRadius: 10, borderBottomLeftRadius: 3 },
  signalTrail: { position: "absolute", width: 136, height: 8, right: 60, top: 246, borderTopLeftRadius: 18, borderTopRightRadius: 4, borderBottomRightRadius: 14, borderBottomLeftRadius: 3 },
  signalHalo: { position: "absolute", width: 42, height: 42, right: 108, top: 229, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.012)" },
  signalCore: { position: "absolute", width: 10, height: 10, right: 124, top: 245, borderRadius: 999, shadowColor: "#FFFFFF", shadowOpacity: 0.48, shadowRadius: 9 },
  activeThread: { position: "absolute", width: 184, height: 2, right: 72, top: 330, borderTopLeftRadius: 16, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  handoffHalo: { position: "absolute", width: 38, height: 38, right: 26, top: 314, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.010)" },
  handoffNode: { position: "absolute", width: 8, height: 8, right: 41, top: 329, borderRadius: 999, shadowColor: "#FFFFFF", shadowOpacity: 0.44, shadowRadius: 8 },
  octaveMacro: { position: "absolute", width: 604, height: 174, right: -250, top: 218, borderTopLeftRadius: 104, borderTopRightRadius: 244, borderBottomRightRadius: 82, borderBottomLeftRadius: 218, shadowColor: "#FFD39B", shadowOpacity: 0.12, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  octaveMid: { position: "absolute", width: 452, height: 112, right: -142, top: 270, borderTopLeftRadius: 80, borderTopRightRadius: 174, borderBottomRightRadius: 64, borderBottomLeftRadius: 158, shadowColor: "#FFD39B", shadowOpacity: 0.10, shadowRadius: 22, shadowOffset: { width: 0, height: 0 } },
  octaveFine: { position: "absolute", width: 292, height: 44, right: -34, top: 326, borderTopLeftRadius: 38, borderTopRightRadius: 110, borderBottomRightRadius: 26, borderBottomLeftRadius: 102 },
  octaveGlint: { position: "absolute", width: 172, height: 2, right: 20, top: 332, borderTopLeftRadius: 16, borderTopRightRadius: 2, borderBottomRightRadius: 12, borderBottomLeftRadius: 1, shadowColor: "#FFD39B", shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  fusionVeil: { position: "absolute", width: 670, height: 266, right: -224, top: 214, borderTopLeftRadius: 108, borderTopRightRadius: 258, borderBottomRightRadius: 88, borderBottomLeftRadius: 238, shadowColor: "#FFD39B", shadowOpacity: 0.016, shadowRadius: 38, shadowOffset: { width: 0, height: 0 } },
  cardGlaze: { position: "absolute", width: 150, height: 1, right: 56, top: 334, borderTopLeftRadius: 22, borderTopRightRadius: 2, borderBottomRightRadius: 20, borderBottomLeftRadius: 1, shadowColor: "#FFD39B", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  softWaveFar: { position: "absolute", width: 404, height: 98, right: -132, top: 266, borderTopLeftRadius: 88, borderTopRightRadius: 160, borderBottomRightRadius: 72, borderBottomLeftRadius: 142 },
  softWaveMid: { position: "absolute", width: 342, height: 78, right: -90, top: 291, borderTopLeftRadius: 74, borderTopRightRadius: 132, borderBottomRightRadius: 62, borderBottomLeftRadius: 120 },
  softWaveNear: { position: "absolute", width: 274, height: 58, right: -43, top: 318, borderTopLeftRadius: 56, borderTopRightRadius: 100, borderBottomRightRadius: 48, borderBottomLeftRadius: 88 },
  decisionBloomOuter: { position: "absolute", width: 80, height: 52, right: 5, top: 307, borderTopLeftRadius: 18, borderTopRightRadius: 32, borderBottomRightRadius: 16, borderBottomLeftRadius: 28, borderWidth: 0.1, backgroundColor: "rgba(255,255,255,0.008)" },
  decisionBloomInner: { position: "absolute", width: 48, height: 30, right: 21, top: 318, borderTopLeftRadius: 11, borderTopRightRadius: 20, borderBottomRightRadius: 9, borderBottomLeftRadius: 18, borderWidth: 0.1 },
  decisionGlint: { position: "absolute", width: 42, height: 3, right: 20, top: 333, borderTopLeftRadius: 14, borderTopRightRadius: 3, borderBottomRightRadius: 12, borderBottomLeftRadius: 2 },
  livingSignal: {
    position: "absolute",
    width: 108,
    height: 4,
    right: 88,
    top: 248,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 4,
  },
  currentBand: {
    position: "absolute",
    width: 520,
    height: 92,
    borderTopLeftRadius: 118,
    borderTopRightRadius: 72,
    borderBottomRightRadius: 132,
    borderBottomLeftRadius: 56,
    top: 174,
    left: -210,
  },
  currentBandLower: {
    top: 270,
    left: -120,
    height: 78,
  },
  depthDisc: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 999,
    right: -130,
    top: -115,
    borderWidth: 1,
    backgroundColor: "rgba(112, 67, 28, 0.10)",
  },
  intelligenceWake: { position: "absolute", left: -128, right: -128, top: 210, height: 68, borderRadius: 999 },
  intelligenceLens: { position: "absolute", width: 174, height: 174, borderRadius: 999, borderWidth: 1, left: -82, top: 96, backgroundColor: "rgba(255,255,255,0.008)" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLead: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  beacon: { width: 10, height: 10, borderRadius: 999 },
  kicker: { fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 2.0 },
  micro: { marginTop: 2, fontSize: 9, lineHeight: 13, fontWeight: "700", letterSpacing: 0.35 },
  truthPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  truthText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.4 },
  mainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  copyColumn: { flex: 1, minWidth: 0 },
  state: { fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 1.6 },
  title: { marginTop: 7, fontSize: 22, lineHeight: 27, fontWeight: "900", letterSpacing: -0.7 },
  body: { marginTop: 8, fontSize: 12, lineHeight: 18, fontWeight: "500" },
  gaugeColumn: { width: 100, alignItems: "center" },
  gauge: {
    width: 92,
    minHeight: 92,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  gaugeValue: { fontSize: 28, lineHeight: 31, fontWeight: "900", letterSpacing: -1.0 },
  gaugeUnit: { marginTop: -2, fontSize: 9, fontWeight: "800" },
  gaugeTrack: { width: "100%", height: 5, borderRadius: 999, marginTop: 10, overflow: "hidden" },
  gaugeFill: { height: "100%", borderRadius: 999 },
  gaugeCaption: { marginTop: 6, fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  metric: {
    minWidth: 64,
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  metricValue: { fontSize: 15, lineHeight: 18, fontWeight: "900" },
  metricLabel: { marginTop: 2, color: "rgba(247,236,220,0.48)", fontSize: 7, fontWeight: "900", letterSpacing: 0.95 },
  whyCard: { borderWidth: 1, borderRadius: 20, padding: 13 },
  whyKicker: { fontSize: 8, lineHeight: 12, fontWeight: "900", letterSpacing: 1.5 },
  whyFormula: { marginTop: 5, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  whyBody: { marginTop: 4, fontSize: 9, lineHeight: 13 },
  priorityCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  priorityKicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  priorityTitle: { marginTop: 4, fontSize: 15, lineHeight: 18, fontWeight: "900" },
  priorityMeta: { marginTop: 3, fontSize: 9, lineHeight: 13 },
  priorityDot: { width: 10, height: 10, borderRadius: 999 },
  action: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionKicker: { fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  actionText: { marginTop: 3, fontSize: 12, lineHeight: 16, fontWeight: "900" },
  arrow: { fontSize: 24, fontWeight: "700" },
  pressed: { opacity: 0.82, transform: [{ scale: WATER_MOTION.pressScale }] },
});
