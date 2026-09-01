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
        duration: 8800,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2600,
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
            styles.currentBand,
            {
              backgroundColor: palette.current,
              opacity: waveOpacity,
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
              opacity: waveOpacity,
              transform: [{ translateX: Animated.multiply(driftX, -0.62) }, { rotate: "6deg" }],
            },
          ]}
        />
        <View style={[styles.depthDisc, { borderColor: palette.border }]} />
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
  currentBand: {
    position: "absolute",
    width: 520,
    height: 92,
    borderRadius: 999,
    top: 150,
    left: -210,
  },
  currentBandLower: {
    top: 246,
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
