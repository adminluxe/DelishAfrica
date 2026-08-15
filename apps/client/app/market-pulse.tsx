import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildMarketplaceOpportunityGraph,
  type MarketplaceLivePartner,
  type MarketplaceOpportunitySignal,
} from "../lib/marketplace-opportunity-graph";
import { buildMarketplaceCulturalConstellations } from "../lib/marketplace-cultural-constellations";
import LivingCitySignal from "../components/LivingCitySignal";

const API_ORIGIN = "https://api.delishafrica.me";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

async function openExternal(url: string) {
  const supported = await Linking.canOpenURL(url);
  if (supported) await Linking.openURL(url);
}

function stateTone(state: MarketplaceOpportunitySignal["state"]): string {
  if (state === "LIVE") return "LIVE";
  if (state === "READY") return "PRÊTE";
  if (state === "RISING") return "EN ACCÉLÉRATION";
  return "EN VEILLE";
}

// DELISHAFRICA_LIVING_CITIES_V1
export default function MarketPulseScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ country?: string | string[]; city?: string | string[] }>();
  const requestedCountry = firstParam(params.country);
  const requestedCity = firstParam(params.city);
  const [partners, setPartners] = useState<MarketplaceLivePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState(requestedCountry || "Tous");
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    let active = true;
    fetch(`${API_ORIGIN}/api/partners?t=${Date.now()}`)
      .then((response) => response.json())
      .then((value) => {
        if (active) setPartners(Array.isArray(value) ? value : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const graph = useMemo(() => buildMarketplaceOpportunityGraph(partners), [partners]);
  const culturalConstellations = useMemo(() => buildMarketplaceCulturalConstellations(partners), [partners]);
  const culturalLead = culturalConstellations.find((item) => item.id !== "grand-atlas") || culturalConstellations[0];
  const countries = useMemo(() => ["Tous", ...Array.from(new Set(graph.map((item) => item.country))).sort((a, b) => a.localeCompare(b, "fr"))], [graph]);
  const filtered = useMemo(() => {
    const scoped = country === "Tous" ? graph : graph.filter((item) => item.country === country);
    if (!requestedCity) return scoped;
    return [...scoped].sort((a, b) => Number(b.city === requestedCity) - Number(a.city === requestedCity) || b.readinessScore - a.readinessScore);
  }, [graph, country, requestedCity]);
  const lead = filtered[0] || graph[0];
  const readyCount = graph.filter((item) => item.state === "READY" || item.state === "LIVE").length;
  const liveCount = graph.filter((item) => item.state === "LIVE").length;
  const discoveryTotal = graph.reduce((sum, item) => sum + item.discoveryCount, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 44), paddingBottom: Math.max(insets.bottom + 42, 62) }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.role}>Territoires · Passeports</Text>
        </View>
        <Animated.View style={[styles.signalOrb, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.18] }) }] }]} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <Text style={styles.heroKicker}>CARTE D’EXPANSION · ROUTES CULTURELLES</Text>
        <Text style={styles.heroTitle}>Le marché devient une trajectoire. Les cultures deviennent des routes.</Text>
        <Text style={styles.heroText}>Chaque ville garde son passeport. Les héritages, les cuisines et les diasporas dessinent des routes culturelles mondiales sans fabriquer de popularité.</Text>
        <View style={styles.heroStats}>
          <View><Text style={styles.heroValue}>{graph.length}</Text><Text style={styles.heroLabel}>villes cartographiées</Text></View>
          <View><Text style={styles.heroValue}>{readyCount}</Text><Text style={styles.heroLabel}>villes prêtes ou live</Text></View>
          <View><Text style={styles.heroValue}>{discoveryTotal}</Text><Text style={styles.heroLabel}>signaux qualifiés</Text></View>
        </View>
      </View>

      {lead ? (
        <View style={styles.leadCard}>
          <Text style={styles.leadKicker}>PROCHAINE FENÊTRE D’EXPANSION</Text>
          <View style={styles.leadRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.leadTitle}>{lead.city}</Text>
              <Text style={styles.leadMeta}>{lead.country} · vague {lead.launchWave}</Text>
            </View>
            <LivingCitySignal city={lead.city} score={lead.readinessScore} state={lead.state} size={86} />
          </View>
          <Text style={styles.leadState}>{lead.stateLabel}</Text>
          <Text style={styles.leadText}>{lead.nextMove}</Text>
          <View style={styles.rail}><Animated.View style={[styles.railSignal, { width: `${Math.max(8, lead.readinessScore)}%` as never }]} /></View>
        </View>
      ) : null}

      {culturalLead ? (
        <Pressable
          style={styles.culturalLead}
          onPress={() => router.push({ pathname: "/market-cultural-constellation" as never, params: { constellationId: culturalLead.id } } as never)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.culturalKicker}>ROUTE CULTURELLE PRIORITAIRE</Text>
            <Text style={styles.culturalTitle}>{culturalLead.name}</Text>
            <Text style={styles.culturalBridge}>{culturalLead.bridge}</Text>
            <Text style={styles.culturalText}>{culturalLead.nextMove}</Text>
          </View>
          <View style={styles.culturalScore}><Text style={styles.culturalScoreValue}>{culturalLead.readinessScore}</Text><Text style={styles.culturalScoreLabel}>ROUTE</Text></View>
        </Pressable>
      ) : null}

      <Text style={styles.sectionKicker}>NAVIGUER PAR MARCHÉ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {countries.map((item) => (
          <Pressable key={item} style={[styles.chip, country === item && styles.chipActive]} onPress={() => setCountry(item)}>
            <Text style={[styles.chipText, country === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionKicker}>CARTE DES OUVERTURES</Text>
          <Text style={styles.sectionTitle}>Les villes parlent avant l’ouverture.</Text>
        </View>
        {loading ? <ActivityIndicator color="#D9AE68" /> : <Text style={styles.sectionCount}>{filtered.length}</Text>}
      </View>

      {filtered.map((signal, index) => {
        const firstEntry = signal.entries[0];
        const demandSubject = encodeURIComponent(`Réveiller ${signal.city} sur DelishAfrica`);
        const demandBody = encodeURIComponent(`Bonjour DelishAfrica,\n\nJe souhaite voir le réseau DelishAfrica se développer à ${signal.city}, ${signal.country}.\n\nIndice Opportunity Graph : ${signal.readinessScore}/100\nÉtat : ${signal.state}\n`);
        return (
          <View key={signal.id} style={[styles.cityCard, index === 0 && styles.cityCardLead]}>
            <View style={styles.cityTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cityRank}>HORIZON {String(index + 1).padStart(2, "0")}</Text>
                <Text style={styles.cityTitle}>{signal.city}</Text>
                <Text style={styles.cityMeta}>{signal.country} · {stateTone(signal.state)}</Text>
              </View>
              {index === 0 ? (
                <LivingCitySignal city={signal.city} score={signal.readinessScore} state={signal.state} size={72} compact />
              ) : (
                <View style={[styles.cityScore, signal.state === "LIVE" && styles.cityScoreLive]}>
                  <Text style={[styles.cityScoreValue, signal.state === "LIVE" && styles.cityScoreValueLive]}>{signal.readinessScore}</Text>
                </View>
              )}
            </View>
            <View style={styles.cityRail}><View style={[styles.cityRailFill, { width: `${Math.max(6, signal.readinessScore)}%` as never }]} /></View>
            <View style={styles.metrics}>
              <View><Text style={styles.metricValue}>{signal.discoveryCount}</Text><Text style={styles.metricLabel}>découvertes</Text></View>
              <View><Text style={styles.metricValue}>{signal.officialSourceCount}</Text><Text style={styles.metricLabel}>sources officielles</Text></View>
              <View><Text style={styles.metricValue}>{signal.cuisineCount}</Text><Text style={styles.metricLabel}>univers cuisine</Text></View>
              <View><Text style={styles.metricValue}>{signal.activePartnerCount}</Text><Text style={styles.metricLabel}>partenaires actifs</Text></View>
            </View>
            <Text style={styles.cityMove}>{signal.nextMove}</Text>
            <Text style={styles.cuisines} numberOfLines={2}>{signal.cuisines.slice(0, 6).join(" · ")}</Text>
            <View style={styles.cityActions}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => router.push({ pathname: "/market-launch-passport" as never, params: { city: signal.city, country: signal.country } } as never)}
              >
                <Text style={styles.primaryButtonText}>Ouvrir le passeport</Text>
              </Pressable>
              {firstEntry ? (
                <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: "/restaurant-preview" as never, params: { radarId: firstEntry.id } } as never)}>
                  <Text style={styles.secondaryButtonText}>Explorer une adresse</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.secondaryButton} onPress={() => openExternal(`mailto:partners@delishafrica.me?subject=${demandSubject}&body=${demandBody}`)}>
                <Text style={styles.secondaryButtonText}>Réveiller cette ville</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={styles.truthCard}>
        <Text style={styles.truthKicker}>MÉTHODE EXPLICABLE</Text>
        <Text style={styles.truthTitle}>Nous mesurons la préparation et documentons la prochaine action.</Text>
        <Text style={styles.truthText}>L’indice assemble cinq dimensions vérifiables. Le passeport ajoute les étapes, les lacunes et la manœuvre suivante. Ensemble, ils organisent le travail terrain sans fabriquer de preuve sociale.</Text>
        <View style={styles.truthFooter}><Text style={styles.truthFooterText}>{liveCount} ville{liveCount > 1 ? "s" : ""} déjà reliée{liveCount > 1 ? "s" : ""} au réseau actif.</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07130E" },
  content: { paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  backText: { color: "#FFF8EA", fontSize: 22, fontWeight: "800", marginTop: -2 },
  brand: { color: "#D9AE68", fontSize: 11, fontWeight: "900", letterSpacing: 2.3 },
  role: { color: "rgba(255,248,234,0.50)", fontSize: 11, fontWeight: "700", marginTop: 4 },
  signalOrb: { width: 14, height: 14, borderRadius: 99, backgroundColor: "#50D18D", shadowColor: "#50D18D", shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  hero: { position: "relative", overflow: "hidden", borderRadius: 34, padding: 24, marginTop: 22, backgroundColor: "#102F23" },
  heroGlow: { position: "absolute", width: 260, height: 260, borderRadius: 999, right: -112, top: -132, backgroundColor: "rgba(80,209,141,0.15)" },
  heroKicker: { color: "#8CE6B8", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  heroTitle: { color: "#FFF8EA", fontSize: 32, lineHeight: 37, fontWeight: "900", letterSpacing: -0.7, marginTop: 10, maxWidth: 350 },
  heroText: { color: "rgba(255,248,234,0.62)", fontSize: 13, lineHeight: 21, marginTop: 13 },
  heroStats: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginTop: 24 },
  heroValue: { color: "#FFF8EA", fontSize: 22, fontWeight: "900" },
  heroLabel: { color: "rgba(255,248,234,0.45)", fontSize: 9, lineHeight: 13, fontWeight: "800", maxWidth: 84, marginTop: 3 },
  leadCard: { borderRadius: 30, padding: 22, marginTop: 16, backgroundColor: "#F1E3C5" },
  leadKicker: { color: "#7C4A29", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  leadRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  leadTitle: { color: "#15251B", fontSize: 31, fontWeight: "900" },
  leadMeta: { color: "rgba(21,37,27,0.53)", fontSize: 12, fontWeight: "800", marginTop: 4 },
  scoreDisc: { width: 72, height: 72, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "#15251B" },
  scoreValue: { color: "#F5D496", fontSize: 25, fontWeight: "900" },
  scoreLabel: { color: "rgba(245,212,150,0.56)", fontSize: 8, fontWeight: "900" },
  leadState: { color: "#7C4A29", fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: 16 },
  leadText: { color: "rgba(21,37,27,0.70)", fontSize: 14, lineHeight: 21, marginTop: 6 },
  rail: { height: 4, borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(21,37,27,0.10)", marginTop: 18 },
  railSignal: { height: 4, borderRadius: 99, backgroundColor: "#A86638" },
  culturalLead: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 30, padding: 21, marginTop: 16, backgroundColor: "#0C1D29", borderWidth: 1, borderColor: "rgba(159,225,255,0.16)" },
  culturalKicker: { color: "#9FE1FF", fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  culturalTitle: { color: "#F4FAFF", fontSize: 24, fontWeight: "900", marginTop: 8 },
  culturalBridge: { color: "#D9AE68", fontSize: 11, fontWeight: "900", marginTop: 6 },
  culturalText: { color: "rgba(236,247,255,0.52)", fontSize: 11, lineHeight: 17, marginTop: 7 },
  culturalScore: { width: 68, height: 68, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "#9FE1FF" },
  culturalScoreValue: { color: "#0C1D29", fontSize: 22, fontWeight: "900" },
  culturalScoreLabel: { color: "rgba(12,29,41,0.55)", fontSize: 7, fontWeight: "900", marginTop: 2 },
  sectionKicker: { color: "#B77A4C", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginTop: 28 },
  chips: { gap: 9, paddingVertical: 14, paddingRight: 18 },
  chip: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  chipActive: { backgroundColor: "#D9AE68", borderColor: "#D9AE68" },
  chipText: { color: "rgba(255,248,234,0.62)", fontSize: 11, fontWeight: "900" },
  chipTextActive: { color: "#1A1207" },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 12 },
  sectionTitle: { color: "#FFF8EA", fontSize: 27, lineHeight: 32, fontWeight: "900", marginTop: 7 },
  sectionCount: { color: "#D9AE68", fontSize: 18, fontWeight: "900", paddingBottom: 2 },
  cityCard: { borderRadius: 30, padding: 20, marginTop: 12, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  cityCardLead: { borderColor: "rgba(217,174,104,0.28)", backgroundColor: "rgba(217,174,104,0.065)" },
  cityTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cityRank: { color: "#D9AE68", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  cityTitle: { color: "#FFF8EA", fontSize: 27, fontWeight: "900", marginTop: 5 },
  cityMeta: { color: "rgba(255,248,234,0.48)", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginTop: 4 },
  cityScore: { width: 58, height: 58, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "#E8D6B4" },
  cityScoreLive: { backgroundColor: "#50D18D" },
  cityScoreValue: { color: "#17251C", fontSize: 20, fontWeight: "900" },
  cityScoreValueLive: { color: "#062013" },
  cityRail: { height: 3, borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", marginTop: 16 },
  cityRailFill: { height: 3, borderRadius: 99, backgroundColor: "#D9AE68" },
  metrics: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 18 },
  metricValue: { color: "#FFF8EA", fontSize: 18, fontWeight: "900" },
  metricLabel: { color: "rgba(255,248,234,0.38)", fontSize: 8, lineHeight: 11, fontWeight: "800", maxWidth: 72, marginTop: 3 },
  cityMove: { color: "rgba(255,248,234,0.72)", fontSize: 13, lineHeight: 20, marginTop: 17 },
  cuisines: { color: "#D9AE68", fontSize: 10, lineHeight: 16, fontWeight: "800", marginTop: 7 },
  cityActions: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 18 },
  primaryButton: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: "#D9AE68" },
  primaryButtonText: { color: "#1A1207", fontSize: 10, fontWeight: "900" },
  secondaryButton: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  secondaryButtonText: { color: "#FFF8EA", fontSize: 10, fontWeight: "900" },
  truthCard: { borderRadius: 30, padding: 22, marginTop: 18, backgroundColor: "#112C21" },
  truthKicker: { color: "#8CE6B8", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  truthTitle: { color: "#FFF8EA", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 9 },
  truthText: { color: "rgba(255,248,234,0.60)", fontSize: 13, lineHeight: 21, marginTop: 10 },
  truthFooter: { borderRadius: 18, padding: 13, marginTop: 18, backgroundColor: "rgba(80,209,141,0.10)" },
  truthFooterText: { color: "#8CE6B8", fontSize: 10, fontWeight: "900" },
});
