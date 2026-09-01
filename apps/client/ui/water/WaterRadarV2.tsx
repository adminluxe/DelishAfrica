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
        duration: 9200,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    const tideLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tide, {
          toValue: 1,
          duration: 3100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(tide, {
          toValue: 0,
          duration: 3100,
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
            styles.current,
            {
              backgroundColor: palette.current,
              opacity: pulseOpacity,
              transform: [{ translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-42, 54] }) }, { rotate: "-8deg" }],
            },
          ]}
        />
        <View style={[styles.depthHalo, { borderColor: palette.border }]} />
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
  current: {
    position: "absolute",
    width: 520,
    height: 120,
    borderRadius: 999,
    right: -210,
    top: 124,
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
