import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
  marketplaceLaunchPassportForCity,
  type MarketplaceLaunchPassport,
  type MarketplaceLaunchPhaseState,
} from "../lib/marketplace-launch-passport";
import type { MarketplaceLivePartner } from "../lib/marketplace-opportunity-graph";
import { buildMarketplaceCulturalConstellations } from "../lib/marketplace-cultural-constellations";
import LivingCitySignal from "../components/LivingCitySignal";

const API_ORIGIN = "https://api.delishafrica.me";
const FOLLOW_KEY = "da.marketplace.followed-city-passports.v1";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function phaseTone(state: MarketplaceLaunchPhaseState): string {
  if (state === "COMPLETE") return "ACQUIS";
  if (state === "ACTIVE") return "MAINTENANT";
  if (state === "NEXT") return "ENSUITE";
  return "VERROUILLÉ";
}

async function openExternal(url: string) {
  const supported = await Linking.canOpenURL(url);
  if (supported) await Linking.openURL(url);
}

// DELISHAFRICA_LIVING_CITIES_V1
export default function MarketLaunchPassportScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ city?: string | string[]; country?: string | string[] }>();
  const requestedCity = firstParam(params.city);
  const requestedCountry = firstParam(params.country);
  const [partners, setPartners] = useState<MarketplaceLivePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState<string[]>([]);

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

  const passport = useMemo(
    () => marketplaceLaunchPassportForCity(requestedCity, requestedCountry, partners),
    [requestedCity, requestedCountry, partners],
  );
  const culturalConstellation = useMemo(() => {
    if (!passport) return undefined;
    return buildMarketplaceCulturalConstellations(partners).find((item) =>
      item.id !== "grand-atlas" && item.cityStops.some((stop) => stop.city === passport.city && stop.country === passport.country),
    );
  }, [passport, partners]);
  const isFollowed = Boolean(passport && followed.includes(passport.id));

  async function toggleFollow() {
    if (!passport) return;
    const next = isFollowed
      ? followed.filter((id) => id !== passport.id)
      : [...new Set([...followed, passport.id])].slice(-5);
    setFollowed(next);
    await AsyncStorage.setItem(FOLLOW_KEY, JSON.stringify(next));
  }

  async function sharePassport(value: MarketplaceLaunchPassport) {
    await Share.share({
      title: `Passeport de lancement · ${value.city}`,
      message: `DelishAfrica cartographie ${value.city}, ${value.country}.\n\nIndice de préparation : ${value.readinessScore}/100\nÉtat : ${value.stateLabel}\nSignature : ${value.signature}\nProchaine action : ${value.firstMove}\n\nCe passeport décrit des preuves publiques et des partenaires actifs, jamais une demande inventée.`,
    });
  }

  if (loading && !passport) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: Math.max(insets.top + 26, 58) }]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#D9AE68" />
        <Text style={styles.loadingText}>Composition du passeport…</Text>
      </View>
    );
  }

  if (!passport) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: Math.max(insets.top + 26, 58) }]}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.brand}>DELISHAFRICA®</Text>
        <Text style={styles.missingTitle}>Cette ville n’a pas encore de passeport.</Text>
        <Text style={styles.missingText}>Revenez à la carte des ouvertures pour choisir une autre trajectoire.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}><Text style={styles.primaryButtonText}>Retour à la carte</Text></Pressable>
      </View>
    );
  }

  const subject = encodeURIComponent(`Officialiser ${passport.city} avec DelishAfrica`);
  const body = encodeURIComponent(`Bonjour DelishAfrica,\n\nJe souhaite contribuer à l’officialisation de ${passport.city}, ${passport.country}.\n\nPasseport : ${passport.launchCode}\nIndice : ${passport.readinessScore}/100\nÉtat : ${passport.stateLabel}\n`);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 44), paddingBottom: Math.max(insets.bottom + 42, 64) }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><Text style={styles.backText}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.role}>Passeport de ville</Text>
        </View>
        <View style={styles.codePill}><Text style={styles.codeText}>{passport.launchCode}</Text></View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroOrbit} pointerEvents="none" />
        <Text style={styles.heroKicker}>OUVERTURE DE VILLE · PASSEPORT</Text>
        <Text style={styles.heroTitle}>{passport.city}</Text>
        <Text style={styles.heroMeta}>{passport.country} · {passport.stateLabel}</Text>
        <Text style={styles.heroHeadline}>{passport.headline}</Text>
        <View style={styles.scoreRow}>
          <LivingCitySignal city={passport.city} score={passport.readinessScore} state={passport.state} size={104} />
          <View style={{ flex: 1 }}>
            <Text style={styles.evidenceLabel}>FORCE DES PREUVES</Text>
            <Text style={styles.evidenceValue}>{passport.evidenceStrength}</Text>
            <Text style={styles.signature}>{passport.signature}</Text>
          </View>
        </View>
      </View>

      <View style={styles.personalCard}>
        <Text style={styles.personalKicker}>VOTRE HORIZON</Text>
        <Text style={styles.personalTitle}>{isFollowed ? "Cette ville reste dans votre horizon." : "Gardez cette ville dans votre horizon."}</Text>
        <Text style={styles.personalText}>Ce choix est enregistré uniquement sur cet appareil. Il personnalise votre carte sans fabriquer de compteur public ni de faux signal communautaire.</Text>
        <View style={styles.personalActions}>
          <Pressable style={[styles.primaryButton, isFollowed && styles.primaryButtonFollowed]} onPress={toggleFollow}>
            <Text style={[styles.primaryButtonText, isFollowed && styles.primaryButtonTextFollowed]}>{isFollowed ? "Retirer de mon horizon" : "Suivre cette ville"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => sharePassport(passport)}><Text style={styles.secondaryButtonText}>Partager le passeport</Text></Pressable>
        </View>
      </View>

      <Text style={styles.sectionKicker}>TRAJECTOIRE D’OUVERTURE</Text>
      <Text style={styles.sectionTitle}>La ville avance par preuves, pas par promesses.</Text>
      <View style={styles.phaseStack}>
        {passport.phases.map((phase, index) => (
          <View key={phase.id} style={[styles.phaseCard, phase.state === "ACTIVE" && styles.phaseCardActive]}>
            <View style={[styles.phaseIndex, phase.state === "COMPLETE" && styles.phaseIndexComplete]}><Text style={styles.phaseIndexText}>{String(index + 1).padStart(2, "0")}</Text></View>
            <View style={{ flex: 1 }}>
              <View style={styles.phaseTop}><Text style={styles.phaseTitle}>{phase.label}</Text><Text style={styles.phaseTone}>{phaseTone(phase.state)}</Text></View>
              <Text style={styles.phaseDetail}>{phase.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.commandCard}>
        <Text style={styles.commandKicker}>PROCHAINE MANŒUVRE</Text>
        <Text style={styles.commandTitle}>{passport.firstMove}</Text>
        <View style={styles.commandDivider} />
        <Text style={styles.commandLabel}>PIÈCE MANQUANTE</Text>
        <Text style={styles.commandMissing}>{passport.missingPiece}</Text>
      </View>

      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionKicker}>ADRESSES QUI DESSINENT LA VILLE</Text>
          <Text style={styles.sectionTitle}>{passport.discoveryCount} preuve{passport.discoveryCount > 1 ? "s" : ""} publique{passport.discoveryCount > 1 ? "s" : ""}.</Text>
        </View>
        <Text style={styles.sectionCount}>{passport.officialSourceCount} OFF.</Text>
      </View>
      {passport.entries.slice(0, 6).map((entry) => (
        <Pressable key={entry.id} style={styles.entryCard} onPress={() => router.push({ pathname: "/restaurant-preview" as never, params: { radarId: entry.id } } as never)}>
          <View style={styles.entryMonogram}><Text style={styles.entryMonogramText}>{entry.name.slice(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.entryName}>{entry.name}</Text>
            <Text style={styles.entryMeta}>{entry.cuisine} · {entry.sourceKind === "official" ? "source officielle" : "source publique"}</Text>
          </View>
          <Text style={styles.entryArrow}>→</Text>
        </Pressable>
      ))}

      <View style={styles.activationCard}>
        <Text style={styles.activationKicker}>ACTIVATION TERRAIN</Text>
        <Text style={styles.activationTitle}>Vous connaissez une adresse, un propriétaire ou une équipe locale ?</Text>
        <Text style={styles.activationText}>Le passeport transforme une découverte publique en point de départ vérifiable. L’officialisation reste humaine, consentie et maîtrisée par l’établissement.</Text>
        <Pressable style={styles.activationButton} onPress={() => openExternal(`mailto:partners@delishafrica.me?subject=${subject}&body=${body}`)}>
          <Text style={styles.activationButtonText}>Ouvrir la voie à {passport.city}</Text>
        </Pressable>
      </View>

      {culturalConstellation ? (
        <Pressable
          style={styles.culturalCard}
          onPress={() => router.push({ pathname: "/market-cultural-constellation" as never, params: { constellationId: culturalConstellation.id } } as never)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.culturalKicker}>APRÈS LA VILLE, LA ROUTE</Text>
            <Text style={styles.culturalTitle}>{passport.city} rejoint {culturalConstellation.name}.</Text>
            <Text style={styles.culturalText}>{culturalConstellation.bridge}</Text>
          </View>
          <Text style={styles.culturalArrow}>→</Text>
        </Pressable>
      ) : null}

      <View style={styles.truthCard}><Text style={styles.truthText}>{passport.truth}</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07130E" },
  content: { paddingHorizontal: 18 },
  loadingScreen: { flex: 1, paddingHorizontal: 24, backgroundColor: "#07130E" },
  loadingText: { color: "rgba(255,248,234,0.55)", marginTop: 14 },
  missingTitle: { color: "#FFF8EA", fontSize: 30, lineHeight: 36, fontWeight: "900", marginTop: 30 },
  missingText: { color: "rgba(255,248,234,0.58)", fontSize: 14, lineHeight: 22, marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  backText: { color: "#FFF8EA", fontSize: 22, fontWeight: "800", marginTop: -2 },
  brand: { color: "#D9AE68", fontSize: 11, fontWeight: "900", letterSpacing: 2.3 },
  role: { color: "rgba(255,248,234,0.50)", fontSize: 11, fontWeight: "700", marginTop: 4 },
  codePill: { maxWidth: 116, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(217,174,104,0.12)", borderWidth: 1, borderColor: "rgba(217,174,104,0.18)" },
  codeText: { color: "#E9C98F", fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
  hero: { position: "relative", overflow: "hidden", borderRadius: 36, padding: 24, marginTop: 22, backgroundColor: "#10283A", borderWidth: 1, borderColor: "rgba(130,215,255,0.16)" },
  heroOrbit: { position: "absolute", width: 280, height: 280, borderRadius: 999, borderWidth: 1, borderColor: "rgba(130,215,255,0.13)", right: -116, top: -132 },
  heroKicker: { color: "#82D7FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  heroTitle: { color: "#F4FAFF", fontSize: 43, lineHeight: 48, fontWeight: "900", letterSpacing: -1.1, marginTop: 13 },
  heroMeta: { color: "#9DDFFF", fontSize: 11, fontWeight: "900", letterSpacing: 1.1, marginTop: 8 },
  heroHeadline: { color: "rgba(236,247,255,0.70)", fontSize: 15, lineHeight: 23, fontWeight: "700", marginTop: 18, maxWidth: 330 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 24 },
  scoreDisc: { width: 86, height: 86, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "#D9AE68" },
  scoreValue: { color: "#17251C", fontSize: 31, fontWeight: "900" },
  scoreLabel: { color: "rgba(23,37,28,0.55)", fontSize: 9, fontWeight: "900" },
  evidenceLabel: { color: "rgba(236,247,255,0.42)", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 },
  evidenceValue: { color: "#F4FAFF", fontSize: 22, fontWeight: "900", marginTop: 5 },
  signature: { color: "#82D7FF", fontSize: 10, lineHeight: 16, fontWeight: "800", marginTop: 5 },
  personalCard: { borderRadius: 30, padding: 21, marginTop: 16, backgroundColor: "#F2E6CD" },
  personalKicker: { color: "#7D4C2B", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  personalTitle: { color: "#17251C", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 9 },
  personalText: { color: "rgba(23,37,28,0.64)", fontSize: 12, lineHeight: 19, marginTop: 9 },
  personalActions: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 17 },
  primaryButton: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#D9AE68" },
  primaryButtonFollowed: { backgroundColor: "#17251C" },
  primaryButtonText: { color: "#1A1207", fontSize: 11, fontWeight: "900" },
  primaryButtonTextFollowed: { color: "#F8EBD2" },
  secondaryButton: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(23,37,28,0.16)" },
  secondaryButtonText: { color: "#17251C", fontSize: 11, fontWeight: "900" },
  sectionKicker: { color: "#B77A4C", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginTop: 28 },
  sectionTitle: { color: "#FFF8EA", fontSize: 27, lineHeight: 32, fontWeight: "900", marginTop: 7, marginBottom: 13 },
  phaseStack: { gap: 10 },
  phaseCard: { flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 24, padding: 16, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  phaseCardActive: { borderColor: "rgba(217,174,104,0.28)", backgroundColor: "rgba(217,174,104,0.075)" },
  phaseIndex: { width: 42, height: 42, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
  phaseIndexComplete: { backgroundColor: "#50D18D" },
  phaseIndexText: { color: "#FFF8EA", fontSize: 11, fontWeight: "900" },
  phaseTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  phaseTitle: { color: "#FFF8EA", fontSize: 17, fontWeight: "900" },
  phaseTone: { color: "#D9AE68", fontSize: 7, fontWeight: "900", letterSpacing: 1.2 },
  phaseDetail: { color: "rgba(255,248,234,0.50)", fontSize: 11, lineHeight: 17, marginTop: 5 },
  commandCard: { borderRadius: 30, padding: 22, marginTop: 16, backgroundColor: "#102F23" },
  commandKicker: { color: "#8CE6B8", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  commandTitle: { color: "#FFF8EA", fontSize: 23, lineHeight: 29, fontWeight: "900", marginTop: 9 },
  commandDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 18 },
  commandLabel: { color: "rgba(255,248,234,0.38)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  commandMissing: { color: "#D9AE68", fontSize: 14, lineHeight: 21, fontWeight: "800", marginTop: 6 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  sectionCount: { color: "#82D7FF", fontSize: 10, fontWeight: "900", paddingBottom: 15 },
  entryCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, padding: 14, marginBottom: 10, backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  entryMonogram: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#19344A" },
  entryMonogramText: { color: "#A9E4FF", fontSize: 15, fontWeight: "900" },
  entryName: { color: "#FFF8EA", fontSize: 15, fontWeight: "900" },
  entryMeta: { color: "rgba(255,248,234,0.46)", fontSize: 9, fontWeight: "800", marginTop: 4 },
  entryArrow: { color: "#D9AE68", fontSize: 22, fontWeight: "700" },
  activationCard: { borderRadius: 32, padding: 22, marginTop: 18, backgroundColor: "#EBD7B0" },
  activationKicker: { color: "#7F4D28", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  activationTitle: { color: "#17251C", fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 10 },
  activationText: { color: "rgba(23,37,28,0.65)", fontSize: 13, lineHeight: 20, marginTop: 10 },
  activationButton: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, marginTop: 18, backgroundColor: "#17251C" },
  activationButtonText: { color: "#F8EBD2", fontSize: 11, fontWeight: "900" },
  culturalCard: { borderRadius: 26, padding: 18, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0C1D29", borderWidth: 1, borderColor: "rgba(159,225,255,0.16)" },
  culturalKicker: { color: "#9FE1FF", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 },
  culturalTitle: { color: "#F4FAFF", fontSize: 18, lineHeight: 23, fontWeight: "900", marginTop: 7 },
  culturalText: { color: "rgba(236,247,255,0.50)", fontSize: 10, lineHeight: 16, marginTop: 6 },
  culturalArrow: { color: "#9FE1FF", fontSize: 26, fontWeight: "800" },
  truthCard: { borderRadius: 22, padding: 16, marginTop: 16, backgroundColor: "rgba(130,215,255,0.07)", borderWidth: 1, borderColor: "rgba(130,215,255,0.12)" },
  truthText: { color: "#A9E4FF", fontSize: 9, lineHeight: 15, fontWeight: "800" },
});
