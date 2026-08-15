import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  marketplaceCulturalConstellationById,
  type MarketplaceCulturalConstellation,
} from "../lib/marketplace-cultural-constellations";
import type { MarketplaceLivePartner } from "../lib/marketplace-opportunity-graph";

const API_ORIGIN = "https://api.delishafrica.me";
const FOLLOW_KEY = "da.marketplace.followed-cultural-constellations.v1";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function orbitPosition(index: number): { top: number; left: number } {
  const positions = [
    { top: 24, left: 142 },
    { top: 82, left: 246 },
    { top: 171, left: 214 },
    { top: 188, left: 76 },
    { top: 91, left: 28 },
  ];
  return positions[index % positions.length];
}

export default function MarketCulturalConstellationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ constellationId?: string | string[] }>();
  const constellationId = firstParam(params.constellationId);
  const [partners, setPartners] = useState<MarketplaceLivePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState<string[]>([]);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      fetch(`${API_ORIGIN}/api/partners?t=${Date.now()}`).then((response) => response.json()),
      AsyncStorage.getItem(FOLLOW_KEY),
    ]).then(([partnerResult, followedResult]) => {
      if (!active) return;
      if (partnerResult.status === "fulfilled") {
        setPartners(Array.isArray(partnerResult.value) ? partnerResult.value : []);
      }
      if (followedResult.status === "fulfilled" && followedResult.value) {
        try {
          const parsed = JSON.parse(followedResult.value);
          setFollowed(Array.isArray(parsed) ? parsed.map(String) : []);
        } catch {
          setFollowed([]);
        }
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const constellation = useMemo(
    () => marketplaceCulturalConstellationById(constellationId, partners),
    [constellationId, partners],
  );
  const isFollowed = Boolean(constellation && followed.includes(constellation.id));

  async function toggleFollow(target: MarketplaceCulturalConstellation) {
    const next = followed.includes(target.id)
      ? followed.filter((item) => item !== target.id)
      : [target.id, ...followed.filter((item) => item !== target.id)].slice(0, 5);
    setFollowed(next);
    await AsyncStorage.setItem(FOLLOW_KEY, JSON.stringify(next));
  }

  async function shareConstellation(target: MarketplaceCulturalConstellation) {
    await Share.share({
      message: `${target.name} · ${target.origin}\n${target.bridge}\n${target.discoveryCount} découvertes · ${target.cityCount} villes · ${target.readinessScore}/100\n\n${target.narrative}\n\nDelishAfrica® · Routes culturelles`,
    });
  }

  if (loading && !constellation) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#D9AE68" />
        <Text style={styles.loadingText}>Alignement de la constellation…</Text>
      </View>
    );
  }

  if (!constellation) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: Math.max(insets.top + 24, 54) }]}>
        <Text style={styles.brand}>DELISHAFRICA®</Text>
        <Text style={styles.missingTitle}>La route culturelle se redessine.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}><Text style={styles.primaryButtonText}>Retour au réseau</Text></Pressable>
      </View>
    );
  }

  const orbitStops = constellation.cityStops.slice(0, 5);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 44), paddingBottom: Math.max(insets.bottom + 44, 64) }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.role}>Routes culturelles</Text>
        </View>
        <Animated.View style={[styles.signalOrb, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.2] }) }] }]} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <Text style={styles.heroKicker}>ROUTE CULTURELLE · DELISHAFRICA</Text>
        <Text style={styles.heroTitle}>{constellation.name}</Text>
        <Text style={styles.heroMeta}>{constellation.origin} · {constellation.stateLabel}</Text>
        <Text style={styles.heroNarrative}>{constellation.narrative}</Text>
        <View style={styles.heroCode}><Text style={styles.heroCodeLabel}>CODE DE ROUTE</Text><Text style={styles.heroCodeValue}>{constellation.routeCode}</Text></View>
      </View>

      <View style={styles.orbitCard}>
        <View style={styles.orbitRingOuter} />
        <View style={styles.orbitRingMiddle} />
        <View style={styles.orbitRingInner} />
        <Animated.View style={[styles.orbitCore, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }]}>
          <Text style={styles.orbitCoreValue}>{constellation.readinessScore}</Text>
          <Text style={styles.orbitCoreLabel}>/100</Text>
        </Animated.View>
        {orbitStops.map((stop, index) => {
          const position = orbitPosition(index);
          return (
            <Pressable
              key={stop.id}
              style={[styles.orbitNode, { top: position.top, left: position.left }]}
              onPress={() => router.push({ pathname: "/market-launch-passport" as never, params: { city: stop.city, country: stop.country } } as never)}
            >
              <Text style={styles.orbitNodeCity} numberOfLines={1}>{stop.city}</Text>
              <Text style={styles.orbitNodeScore}>{stop.readinessScore}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bridgeCard}>
        <Text style={styles.bridgeKicker}>PONT CULTUREL</Text>
        <Text style={styles.bridgeTitle}>{constellation.bridge}</Text>
        <Text style={styles.bridgeText}>{constellation.nextMove}</Text>
        <View style={styles.metrics}>
          <View><Text style={styles.metricValue}>{constellation.countryCount}</Text><Text style={styles.metricLabel}>pays reliés</Text></View>
          <View><Text style={styles.metricValue}>{constellation.cityCount}</Text><Text style={styles.metricLabel}>escales</Text></View>
          <View><Text style={styles.metricValue}>{constellation.officialSourceCount}</Text><Text style={styles.metricLabel}>preuves officielles</Text></View>
          <View><Text style={styles.metricValue}>{constellation.activePartnerCount}</Text><Text style={styles.metricLabel}>partenaires actifs</Text></View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.primaryButton, isFollowed && styles.primaryButtonFollowed]} onPress={() => toggleFollow(constellation)}>
          <Text style={[styles.primaryButtonText, isFollowed && styles.primaryButtonTextFollowed]}>{isFollowed ? "Route suivie" : "Suivre cette route"}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => shareConstellation(constellation)}><Text style={styles.secondaryButtonText}>Partager</Text></Pressable>
      </View>

      <Text style={styles.sectionKicker}>ITINÉRAIRE VIVANT</Text>
      <Text style={styles.sectionTitle}>Les villes deviennent des escales, pas des silos.</Text>
      {constellation.cityStops.slice(0, 8).map((stop, index) => (
        <Pressable
          key={stop.id}
          style={styles.stopCard}
          onPress={() => router.push({ pathname: "/market-launch-passport" as never, params: { city: stop.city, country: stop.country } } as never)}
        >
          <View style={styles.stopRank}><Text style={styles.stopRankText}>{String(index + 1).padStart(2, "0")}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stopTitle}>{stop.city}</Text>
            <Text style={styles.stopMeta}>{stop.country} · {stop.stateLabel}</Text>
            <Text style={styles.stopEvidence}>{stop.discoveryCount} découvertes · {stop.officialSourceCount} preuves officielles</Text>
          </View>
          <Text style={styles.stopScore}>{stop.readinessScore}</Text>
        </Pressable>
      ))}

      <Text style={styles.sectionKicker}>SIGNATURES REPÉRÉES</Text>
      <Text style={styles.sectionTitle}>La route existe déjà dans le monde réel.</Text>
      <View style={styles.cuisineCloud}>
        {constellation.cuisines.slice(0, 10).map((cuisine) => <View key={cuisine} style={styles.cuisinePill}><Text style={styles.cuisineText}>{cuisine}</Text></View>)}
      </View>
      {constellation.entries.slice(0, 8).map((entry) => (
        <Pressable key={entry.id} style={styles.entryCard} onPress={() => router.push({ pathname: "/restaurant-preview" as never, params: { radarId: entry.id } } as never)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.entryName}>{entry.name}</Text>
            <Text style={styles.entryMeta}>{entry.city} · {entry.country} · {entry.cuisine}</Text>
          </View>
          <Text style={styles.entrySource}>{entry.sourceKind === "official" ? "SOURCE OFF." : "SOURCE PUB."}</Text>
        </Pressable>
      ))}

      <View style={styles.truthCard}>
        <Text style={styles.truthKicker}>PROMESSE DE VÉRITÉ</Text>
        <Text style={styles.truthTitle}>Relier les cultures sans inventer la foule.</Text>
        <Text style={styles.truthText}>{constellation.truth}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07130E" },
  content: { paddingHorizontal: 18 },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24, backgroundColor: "#07130E" },
  loadingText: { color: "rgba(255,248,234,0.56)", fontSize: 13, fontWeight: "800" },
  missingTitle: { color: "#FFF8EA", fontSize: 29, lineHeight: 35, fontWeight: "900", textAlign: "center", marginTop: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  backText: { color: "#FFF8EA", fontSize: 22, fontWeight: "800", marginTop: -2 },
  brand: { color: "#D9AE68", fontSize: 11, fontWeight: "900", letterSpacing: 2.3 },
  role: { color: "rgba(255,248,234,0.50)", fontSize: 11, fontWeight: "700", marginTop: 4 },
  signalOrb: { width: 14, height: 14, borderRadius: 99, backgroundColor: "#8ED8FF", shadowColor: "#8ED8FF", shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  hero: { position: "relative", overflow: "hidden", borderRadius: 34, padding: 24, marginTop: 22, backgroundColor: "#10283A" },
  heroGlow: { position: "absolute", width: 270, height: 270, borderRadius: 999, right: -118, top: -138, backgroundColor: "rgba(130,215,255,0.15)" },
  heroKicker: { color: "#9FE1FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  heroTitle: { color: "#F4FAFF", fontSize: 35, lineHeight: 40, fontWeight: "900", marginTop: 11, maxWidth: 340 },
  heroMeta: { color: "#D9AE68", fontSize: 11, fontWeight: "900", letterSpacing: 1.1, marginTop: 9 },
  heroNarrative: { color: "rgba(236,247,255,0.66)", fontSize: 14, lineHeight: 22, marginTop: 13 },
  heroCode: { alignSelf: "flex-start", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginTop: 18, backgroundColor: "rgba(130,215,255,0.09)", borderWidth: 1, borderColor: "rgba(130,215,255,0.14)" },
  heroCodeLabel: { color: "rgba(169,228,255,0.56)", fontSize: 7, fontWeight: "900", letterSpacing: 1.5 },
  heroCodeValue: { color: "#A9E4FF", fontSize: 11, fontWeight: "900", marginTop: 4 },
  orbitCard: { height: 286, marginTop: 16, borderRadius: 34, overflow: "hidden", backgroundColor: "#0C1D29", borderWidth: 1, borderColor: "rgba(130,215,255,0.12)" },
  orbitRingOuter: { position: "absolute", width: 236, height: 236, borderRadius: 999, left: 53, top: 25, borderWidth: 1, borderColor: "rgba(130,215,255,0.15)" },
  orbitRingMiddle: { position: "absolute", width: 166, height: 166, borderRadius: 999, left: 88, top: 60, borderWidth: 1, borderColor: "rgba(217,174,104,0.16)" },
  orbitRingInner: { position: "absolute", width: 96, height: 96, borderRadius: 999, left: 123, top: 95, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  orbitCore: { position: "absolute", width: 78, height: 78, borderRadius: 99, left: 132, top: 104, alignItems: "center", justifyContent: "center", backgroundColor: "#D9AE68", shadowColor: "#D9AE68", shadowOpacity: 0.35, shadowRadius: 18 },
  orbitCoreValue: { color: "#15231B", fontSize: 25, fontWeight: "900" },
  orbitCoreLabel: { color: "rgba(21,35,27,0.56)", fontSize: 8, fontWeight: "900" },
  orbitNode: { position: "absolute", width: 76, minHeight: 48, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#16384B", borderWidth: 1, borderColor: "rgba(159,225,255,0.20)" },
  orbitNodeCity: { color: "#F4FAFF", fontSize: 10, fontWeight: "900", maxWidth: 62 },
  orbitNodeScore: { color: "#9FE1FF", fontSize: 9, fontWeight: "900", marginTop: 3 },
  bridgeCard: { borderRadius: 30, padding: 22, marginTop: 16, backgroundColor: "#F1E3C5" },
  bridgeKicker: { color: "#7C4A29", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  bridgeTitle: { color: "#15251B", fontSize: 25, lineHeight: 31, fontWeight: "900", marginTop: 10 },
  bridgeText: { color: "rgba(21,37,27,0.68)", fontSize: 13, lineHeight: 21, marginTop: 10 },
  metrics: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 22 },
  metricValue: { color: "#15251B", fontSize: 21, fontWeight: "900" },
  metricLabel: { color: "rgba(21,37,27,0.48)", fontSize: 8, lineHeight: 11, fontWeight: "800", maxWidth: 72, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryButton: { flex: 1, borderRadius: 999, paddingHorizontal: 17, paddingVertical: 14, alignItems: "center", backgroundColor: "#D9AE68" },
  primaryButtonFollowed: { backgroundColor: "#50D18D" },
  primaryButtonText: { color: "#1A1207", fontSize: 11, fontWeight: "900" },
  primaryButtonTextFollowed: { color: "#062013" },
  secondaryButton: { borderRadius: 999, paddingHorizontal: 19, paddingVertical: 14, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  secondaryButtonText: { color: "#FFF8EA", fontSize: 11, fontWeight: "900" },
  sectionKicker: { color: "#B77A4C", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginTop: 28 },
  sectionTitle: { color: "#FFF8EA", fontSize: 27, lineHeight: 32, fontWeight: "900", marginTop: 7, marginBottom: 12 },
  stopCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 24, padding: 15, marginTop: 9, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  stopRank: { width: 38, height: 38, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(217,174,104,0.13)" },
  stopRankText: { color: "#D9AE68", fontSize: 10, fontWeight: "900" },
  stopTitle: { color: "#FFF8EA", fontSize: 17, fontWeight: "900" },
  stopMeta: { color: "rgba(255,248,234,0.52)", fontSize: 10, fontWeight: "800", marginTop: 4 },
  stopEvidence: { color: "rgba(255,248,234,0.34)", fontSize: 9, fontWeight: "700", marginTop: 4 },
  stopScore: { color: "#9FE1FF", fontSize: 18, fontWeight: "900" },
  cuisineCloud: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  cuisinePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(217,174,104,0.10)", borderWidth: 1, borderColor: "rgba(217,174,104,0.14)" },
  cuisineText: { color: "#E8C98F", fontSize: 10, fontWeight: "900" },
  entryCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, padding: 15, marginTop: 9, backgroundColor: "#102219", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  entryName: { color: "#FFF8EA", fontSize: 16, fontWeight: "900" },
  entryMeta: { color: "rgba(255,248,234,0.48)", fontSize: 10, fontWeight: "700", marginTop: 4 },
  entrySource: { color: "#8CE6B8", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  truthCard: { borderRadius: 30, padding: 22, marginTop: 18, backgroundColor: "#112C21" },
  truthKicker: { color: "#8CE6B8", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  truthTitle: { color: "#FFF8EA", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 9 },
  truthText: { color: "rgba(255,248,234,0.60)", fontSize: 13, lineHeight: 21, marginTop: 10 },
});
