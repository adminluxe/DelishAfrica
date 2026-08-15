import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { AquaticSignature } from "../components/aquatic/AquaticSignature";

const stages = [
  {
    label: "Paiement",
    title: "Départ sécurisé",
    detail: "La commande entre dans le parcours avec un signal clair et une continuité immédiate.",
    signal: "CONFIRMÉ",
  },
  {
    label: "Cuisine",
    title: "Préparation synchronisée",
    detail: "Le restaurant lit la priorité, le rythme et la fenêtre de remise sans bruit inutile.",
    signal: "EN COURS",
  },
  {
    label: "Coursier",
    title: "Relais intelligent",
    detail: "Disponibilité, distance et ETA se rejoignent pour préparer la meilleure continuité terrain.",
    signal: "ALIGNÉ",
  },
  {
    label: "Livraison",
    title: "Suivi vivant",
    detail: "Le client garde une lecture simple du trajet jusqu’à l’arrivée, sans perdre le fil.",
    signal: "VISIBLE",
  },
] as const;

export default function DeliveryIntelligenceScreen() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const detailOpacity = useRef(new Animated.Value(1)).current;
  const detailTranslateY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const selectedStage = stages[selectedIndex];

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    pulse.stopAnimation();

    if (reduceMotion) {
      pulse.setValue(0.42);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [pulse, reduceMotion]);

  function selectStage(nextIndex: number) {
    if (nextIndex === selectedIndex) return;

    if (reduceMotion) {
      setSelectedIndex(nextIndex);
      detailOpacity.setValue(1);
      detailTranslateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(detailOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(detailTranslateY, {
        toValue: 8,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;

      setSelectedIndex(nextIndex);
      detailTranslateY.setValue(-8);

      Animated.parallel([
        Animated.timing(detailOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(detailTranslateY, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  return (
    <AquaticSignature reduceMotion={reduceMotion}>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroHalo} pointerEvents="none" />
            <Text style={styles.brand}>DELISHAFRICA®</Text>
            <Text style={styles.kicker}>DELIVERY INTELLIGENCE · AQUATIC</Text>
            <Text style={styles.title}>Chaque geste fait avancer la même onde.</Text>
            <Text style={styles.subtitle}>
              Paiement, cuisine, coursier et suivi partagent une seule lecture du parcours, fluide et compréhensible.
            </Text>

            <View style={styles.heroSignalRow}>
              <Animated.View
                style={[
                  styles.heroSignal,
                  {
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.46, 1],
                    }),
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.88, 1.18],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Text style={styles.heroSignalText}>4 signaux reliés · 1 parcours continu</Text>
            </View>
          </View>

          <View style={styles.flowCard}>
            <View style={styles.flowHeader}>
              <View style={styles.flowHeaderCopy}>
                <Text style={styles.flowKicker}>ONDE OPÉRATIONNELLE</Text>
                <Text style={styles.flowTitle}>Le parcours reste lisible à chaque relais.</Text>
              </View>
              <View style={styles.flowBadge}>
                <Text style={styles.flowBadgeText}>SYNCHRONISÉ</Text>
              </View>
            </View>

            <View style={styles.routeRow}>
              {stages.map((stage, index) => (
                <React.Fragment key={stage.label}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.routeNodeWrap,
                      pressed && styles.pressFeedback,
                    ]}
                    onPress={() => selectStage(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${stage.label} · ${stage.title}`}
                    accessibilityState={{ selected: index === selectedIndex }}
                  >
                    <View
                      style={[
                        styles.routeNode,
                        index <= selectedIndex && styles.routeNodeReached,
                        index === selectedIndex && styles.routeNodeActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.routeNodeIndex,
                          index <= selectedIndex && styles.routeNodeIndexReached,
                        ]}
                      >
                        0{index + 1}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.routeNodeLabel,
                        index === selectedIndex && styles.routeNodeLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {stage.label}
                    </Text>
                  </Pressable>

                  {index < stages.length - 1 ? (
                    <View
                      style={[
                        styles.routeLine,
                        index < selectedIndex && styles.routeLineReached,
                      ]}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </View>

            <Animated.View
              style={[
                styles.stageCard,
                {
                  opacity: detailOpacity,
                  transform: [{ translateY: detailTranslateY }],
                },
              ]}
            >
              <View style={styles.stageTopRow}>
                <Text style={styles.stageLabel}>{selectedStage.label}</Text>
                <View style={styles.stageSignal}>
                  <Text style={styles.stageSignalText}>{selectedStage.signal}</Text>
                </View>
              </View>
              <Text style={styles.stageTitle}>{selectedStage.title}</Text>
              <Text style={styles.stageDetail}>{selectedStage.detail}</Text>
            </Animated.View>
          </View>

          <View style={styles.intelligenceGrid}>
            <View style={styles.intelligenceCard}>
              <Text style={styles.intelligenceNumber}>01</Text>
              <Text style={styles.intelligenceTitle}>Priorités claires</Text>
              <Text style={styles.intelligenceText}>
                Chaque acteur voit l’action utile au bon moment.
              </Text>
            </View>

            <View style={styles.intelligenceCard}>
              <Text style={styles.intelligenceNumber}>02</Text>
              <Text style={styles.intelligenceTitle}>Relais continus</Text>
              <Text style={styles.intelligenceText}>
                Le passage cuisine → terrain reste cohérent et compréhensible.
              </Text>
            </View>

            <View style={styles.intelligenceCard}>
              <Text style={styles.intelligenceNumber}>03</Text>
              <Text style={styles.intelligenceTitle}>Lecture vivante</Text>
              <Text style={styles.intelligenceText}>
                Le client suit l’essentiel sans écran technique ni surcharge.
              </Text>
            </View>

            <View style={styles.intelligenceCard}>
              <Text style={styles.intelligenceNumber}>04</Text>
              <Text style={styles.intelligenceTitle}>Confiance partagée</Text>
              <Text style={styles.intelligenceText}>
                Une même histoire relie la commande, le restaurant et la livraison.
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
            onPress={() => router.push("/menu" as any)}
            accessibilityRole="button"
            accessibilityLabel="Commander maintenant"
          >
            <Text style={styles.primaryText}>Commander maintenant</Text>
            <Text style={styles.primaryArrow}>→</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondary, pressed && styles.pressFeedback]}
            onPress={() => router.push("/order-tracking" as any)}
            accessibilityRole="button"
            accessibilityLabel="Voir le suivi live"
          >
            <Text style={styles.secondaryText}>Voir le suivi live</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.ghost, pressed && styles.pressFeedback]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Retour à la marketplace"
          >
            <Text style={styles.ghostText}>Retour à la marketplace</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </AquaticSignature>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 56,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    padding: 23,
    backgroundColor: "rgba(6, 39, 39, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(155, 239, 225, 0.24)",
  },
  heroHalo: {
    position: "absolute",
    width: 250,
    height: 104,
    borderRadius: 999,
    right: -74,
    top: -56,
    backgroundColor: "rgba(155, 239, 225, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(216, 255, 248, 0.11)",
    transform: [{ rotate: "-12deg" }],
  },
  brand: {
    color: "#F5BE67",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.5,
  },
  kicker: {
    color: "#9BEFE1",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.1,
    marginTop: 16,
  },
  title: {
    color: "#FFF9EC",
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 10,
    maxWidth: 330,
  },
  subtitle: {
    color: "rgba(255, 249, 236, 0.67)",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
    marginTop: 14,
    maxWidth: 335,
  },
  heroSignalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 20,
  },
  heroSignal: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#9BEFE1",
    shadowColor: "#9BEFE1",
    shadowOpacity: 0.78,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
  },
  heroSignalText: {
    color: "rgba(255, 249, 236, 0.68)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  flowCard: {
    marginTop: 16,
    borderRadius: 30,
    padding: 19,
    backgroundColor: "rgba(4, 23, 27, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(155, 239, 225, 0.17)",
  },
  flowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  flowHeaderCopy: {
    flex: 1,
  },
  flowKicker: {
    color: "#9BEFE1",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 2,
  },
  flowTitle: {
    color: "#FFF9EC",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    marginTop: 8,
  },
  flowBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(155, 239, 225, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(155, 239, 225, 0.18)",
  },
  flowBadgeText: {
    color: "#A7F3E7",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 23,
  },
  routeNodeWrap: {
    width: 54,
    alignItems: "center",
  },
  routeNode: {
    width: 37,
    height: 37,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  routeNodeReached: {
    borderColor: "rgba(155, 239, 225, 0.36)",
    backgroundColor: "rgba(155, 239, 225, 0.10)",
  },
  routeNodeActive: {
    backgroundColor: "#9BEFE1",
    borderColor: "#D8FFF8",
    shadowColor: "#9BEFE1",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  routeNodeIndex: {
    color: "rgba(255,255,255,0.43)",
    fontSize: 10,
    fontWeight: "900",
  },
  routeNodeIndexReached: {
    color: "#11322F",
  },
  routeNodeLabel: {
    color: "rgba(255,249,236,0.46)",
    fontSize: 8,
    fontWeight: "900",
    marginTop: 7,
  },
  routeNodeLabelActive: {
    color: "#FFF9EC",
  },
  routeLine: {
    flex: 1,
    height: 2,
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  routeLineReached: {
    backgroundColor: "rgba(155, 239, 225, 0.56)",
  },
  stageCard: {
    minHeight: 166,
    marginTop: 19,
    borderRadius: 24,
    padding: 17,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stageTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stageLabel: {
    color: "#F5BE67",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  stageSignal: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "rgba(245, 190, 103, 0.10)",
  },
  stageSignalText: {
    color: "#F8CA80",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  stageTitle: {
    color: "#FFF9EC",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    marginTop: 13,
  },
  stageDetail: {
    color: "rgba(255,249,236,0.62)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    marginTop: 9,
  },
  intelligenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  intelligenceCard: {
    width: "48.4%",
    minHeight: 154,
    borderRadius: 24,
    padding: 15,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.075)",
  },
  intelligenceNumber: {
    color: "#9BEFE1",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.7,
  },
  intelligenceTitle: {
    color: "#FFF9EC",
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
    marginTop: 12,
  },
  intelligenceText: {
    color: "rgba(255,249,236,0.55)",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    marginTop: 8,
  },
  primary: {
    minHeight: 56,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5BE67",
  },
  primaryPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.988 }],
  },
  primaryText: {
    color: "#13241F",
    fontSize: 15,
    fontWeight: "900",
  },
  primaryArrow: {
    color: "#13241F",
    fontSize: 22,
    fontWeight: "900",
  },
  secondary: {
    minHeight: 54,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(155, 239, 225, 0.15)",
  },
  secondaryText: {
    color: "#FFF9EC",
    fontSize: 14,
    fontWeight: "900",
  },
  ghost: {
    minHeight: 48,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: {
    color: "rgba(255,249,236,0.50)",
    fontSize: 13,
    fontWeight: "900",
  },
  pressFeedback: {
    opacity: 0.78,
  },
});
