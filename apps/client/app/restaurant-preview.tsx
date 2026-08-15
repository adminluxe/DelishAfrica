import React, { useMemo } from "react";
import {
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
import { marketplaceRadarById } from "../lib/marketplace-discovery-engine";
import { marketplacePulseForEntry } from "../lib/marketplace-opportunity-graph";
import { marketplaceCulturalConstellationForEntry } from "../lib/marketplace-cultural-constellations";
import TastePortrait from "../components/TastePortrait";

const DELISHAFRICA_DISCOVERY_TASTE_PORTRAITS_V1 = true;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

const PREVIEW_PALETTES = [
  { canvas: "#7A321D", glow: "rgba(255,207,114,0.20)", accent: "#FFCF72" },
  { canvas: "#1B5A49", glow: "rgba(143,226,192,0.19)", accent: "#8FE2C0" },
  { canvas: "#4B2C6F", glow: "rgba(215,169,255,0.19)", accent: "#D7A9FF" },
  { canvas: "#174F6A", glow: "rgba(141,220,255,0.18)", accent: "#8DDCFF" },
  { canvas: "#6A4A17", glow: "rgba(245,194,83,0.19)", accent: "#F5C253" },
];

function previewPalette(identity: string) {
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) hash = ((hash << 5) - hash + identity.charCodeAt(index)) | 0;
  return PREVIEW_PALETTES[Math.abs(hash) % PREVIEW_PALETTES.length];
}

async function openExternal(url: string) {
  const supported = await Linking.canOpenURL(url);
  if (supported) await Linking.openURL(url);
}

export default function RestaurantPreviewScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ radarId?: string | string[] }>();
  const radarId = firstParam(params.radarId);
  const entry = useMemo(() => marketplaceRadarById(radarId), [radarId]);
  const cityPulse = useMemo(() => entry ? marketplacePulseForEntry(entry) : undefined, [entry]);
  const culturalConstellation = useMemo(() => entry ? marketplaceCulturalConstellationForEntry(entry) : undefined, [entry]);
  const palette = useMemo(() => previewPalette(entry?.id || radarId), [entry?.id, radarId]);

  if (!entry) {
    return (
      <View style={[styles.missing, { paddingTop: Math.max(insets.top + 24, 54) }]}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.brand}>DELISHAFRICA®</Text>
        <Text style={styles.missingTitle}>Cette escale a changé de trajectoire.</Text>
        <Text style={styles.missingText}>Revenez au réseau DelishAfrica pour poursuivre l’exploration.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Retour au réseau</Text>
        </Pressable>
      </View>
    );
  }

  const partnerSubject = encodeURIComponent(`Officialiser ${entry.name} sur DelishAfrica`);
  const partnerBody = encodeURIComponent(
    `Bonjour DelishAfrica,\n\nJe souhaite officialiser ou mettre à jour la présence de ${entry.name} (${entry.city}, ${entry.country}).\n\nRéférence Discovery : ${entry.id}\nSource publique : ${entry.sourceUrl}\n`,
  );
  const demandSubject = encodeURIComponent(`Je veux ${entry.name} sur DelishAfrica`);
  const demandBody = encodeURIComponent(
    `Bonjour DelishAfrica,\n\nJe souhaite pouvoir commander auprès de ${entry.name} à ${entry.city}.\n\nRéférence Discovery : ${entry.id}\n`,
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 44), paddingBottom: Math.max(insets.bottom + 36, 56) }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.role}>Adresse repérée</Text>
        </View>
        <View style={styles.watchPill}><Text style={styles.watchPillText}>EN VEILLE</Text></View>
      </View>

      <View style={[styles.hero, { backgroundColor: palette.canvas }]}>
        <View style={[styles.heroGlow, { backgroundColor: palette.glow }]} pointerEvents="none" />
        <Text style={styles.monogram}>{entry.name.slice(0, 2).toUpperCase()}</Text>
        <Text style={styles.kicker}>DÉCOUVERTE PUBLIQUE QUALIFIÉE</Text>
        <Text style={styles.title}>{entry.name}</Text>
        <Text style={styles.meta}>{entry.city} · {entry.country} · {entry.cuisine}</Text>
        {entry.publicAddress ? <Text style={styles.publicAddress}>{entry.publicAddress}</Text> : null}
        <Text style={styles.description}>{entry.description}</Text>
      </View>

      <View style={styles.truthCard}>
        <Text style={styles.truthKicker}>STATUT TRANSPARENT</Text>
        <Text style={styles.truthTitle}>Visible dans la carte. Pas encore partenaire.</Text>
        <Text style={styles.truthText}>
          Cette fiche signale uniquement une présence publique trouvée en ligne. Elle ne prétend ni à un partenariat, ni à une disponibilité de commande, ni à une validation par l’établissement.
        </Text>
        <View style={styles.truthRows}>
          <View style={styles.truthRow}><Text style={styles.truthLabel}>Source</Text><Text style={styles.truthValue}>{entry.sourceLabel}</Text></View>
          <View style={styles.truthRow}><Text style={styles.truthLabel}>Vérifiée le</Text><Text style={styles.truthValue}>{entry.checkedAt}</Text></View>
          <View style={styles.truthRow}><Text style={styles.truthLabel}>Lancement</Text><Text style={styles.truthValue}>Vague {entry.launchWave}</Text></View>
        </View>
      </View>

      {entry.publicMenuHighlights?.length ? (
        <View style={styles.menuCard}>
          <Text style={styles.menuKicker}>REPÈRES DE CARTE</Text>
          <Text style={styles.menuTitle}>Quelques signatures publiques repérées.</Text>
          <Text style={styles.menuText}>{entry.publicMenuNote || "Repères publics à confirmer directement avec l’établissement."}</Text>
          <View style={styles.menuRows}>
            {entry.publicMenuHighlights.map((item) => (
              <View key={`${item.name}-${item.priceLabel || ""}`} style={styles.menuRow}>
                <TastePortrait
                  name={item.name}
                  category={entry.cuisine}
                  seed={entry.id}
                  size={68}
                  compact
                />
                <View style={styles.menuCopy}>
                  <Text style={styles.menuName}>{item.name}</Text>
                  <Text style={styles.menuSignal}>Repère public · à confirmer</Text>
                </View>
                {item.priceLabel ? <Text style={[styles.menuPrice, { color: palette.accent }]}>{item.priceLabel}</Text> : null}
              </View>
            ))}
          </View>
          <Text style={styles.menuGuard}>APERÇU INFORMATIF · NON COMMANDABLE · SOURCE OFFICIELLE</Text>
        </View>
      ) : null}

      {cityPulse ? (
        <Pressable
          style={styles.opportunityCard}
          onPress={() => router.push({ pathname: "/market-launch-passport" as never, params: { country: entry.country, city: entry.city } } as never)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.opportunityKicker}>PASSEPORT DE VILLE · {cityPulse.state}</Text>
            <Text style={styles.opportunityTitle}>Ouvrir le passeport de {entry.city} · {cityPulse.readinessScore}/100.</Text>
            <Text style={styles.opportunityText}>{cityPulse.nextMove}</Text>
          </View>
          <View style={styles.opportunityScore}><Text style={styles.opportunityScoreValue}>{cityPulse.readinessScore}</Text></View>
        </Pressable>
      ) : null}

      {culturalConstellation ? (
        <Pressable
          style={styles.culturalCard}
          onPress={() => router.push({ pathname: "/market-cultural-constellation" as never, params: { constellationId: culturalConstellation.id } } as never)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.culturalKicker}>ROUTE CULTURELLE</Text>
            <Text style={styles.culturalTitle}>{entry.name} appartient à la route {culturalConstellation.name}.</Text>
            <Text style={styles.culturalText}>{culturalConstellation.bridge}</Text>
          </View>
          <Text style={styles.culturalArrow}>→</Text>
        </Pressable>
      ) : null}

      <View style={styles.signalCard}>
        <Text style={styles.signalKicker}>VOTRE SIGNAL</Text>
        <Text style={styles.signalTitle}>Accélérez l’officialisation de cette découverte.</Text>
        <Text style={styles.signalText}>Votre demande aide l’équipe terrain à prioriser les prochaines officialisations.</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => openExternal(`mailto:partners@delishafrica.me?subject=${demandSubject}&body=${demandBody}`)}
        >
          <Text style={styles.primaryButtonText}>Je veux cette adresse</Text>
        </Pressable>
      </View>

      <Pressable style={styles.sourceButton} onPress={() => openExternal(entry.sourceUrl)}>
        <View>
          <Text style={styles.sourceKicker}>PREUVE PUBLIQUE</Text>
          <Text style={styles.sourceTitle}>Voir la source de découverte</Text>
        </View>
        <Text style={styles.sourceArrow}>↗</Text>
      </Pressable>

      <View style={styles.ownerCard}>
        <Text style={styles.ownerKicker}>VOUS REPRÉSENTEZ CET ÉTABLISSEMENT ?</Text>
        <Text style={styles.ownerTitle}>Tout le monde y est. On vous officialise ou on vous garde en veilleuse ?</Text>
        <Text style={styles.ownerText}>Une validation directe transforme cette présence repérée en fiche partenaire maîtrisée : identité, menu, horaires, commandes et visibilité.</Text>
        <Pressable
          style={styles.ownerButton}
          onPress={() => openExternal(`mailto:partners@delishafrica.me?subject=${partnerSubject}&body=${partnerBody}`)}
        >
          <Text style={styles.ownerButtonText}>Officialiser cet établissement</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07130E" },
  content: { paddingHorizontal: 18 },
  missing: { flex: 1, paddingHorizontal: 24, backgroundColor: "#07130E" },
  brand: { color: "#D9AE68", fontSize: 11, fontWeight: "900", letterSpacing: 2.3 },
  role: { color: "rgba(255,248,234,0.52)", fontSize: 11, fontWeight: "700", marginTop: 4 },
  missingTitle: { color: "#FFF8EA", fontSize: 31, lineHeight: 37, fontWeight: "900", marginTop: 28 },
  missingText: { color: "rgba(255,248,234,0.58)", fontSize: 15, lineHeight: 23, marginTop: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  backText: { color: "#FFF8EA", fontSize: 22, fontWeight: "800", marginTop: -2 },
  watchPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "rgba(217,174,104,0.13)", borderWidth: 1, borderColor: "rgba(217,174,104,0.18)" },
  watchPillText: { color: "#E9C98F", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  hero: { position: "relative", overflow: "hidden", borderRadius: 34, padding: 24, marginTop: 22, backgroundColor: "#5E3424" },
  heroGlow: { position: "absolute", width: 230, height: 230, borderRadius: 999, right: -92, top: -112, backgroundColor: "rgba(242,180,94,0.18)" },
  monogram: { color: "rgba(255,242,220,0.92)", fontSize: 58, fontWeight: "900", letterSpacing: -3 },
  kicker: { color: "#F5D9A7", fontSize: 9, fontWeight: "900", letterSpacing: 2, marginTop: 24 },
  title: { color: "#FFF8EA", fontSize: 34, lineHeight: 39, fontWeight: "900", marginTop: 8 },
  meta: { color: "#E7BA78", fontSize: 13, fontWeight: "900", marginTop: 10 },
  publicAddress: { color: "rgba(255,248,234,0.52)", fontSize: 11, lineHeight: 17, fontWeight: "700", marginTop: 8 },
  description: { color: "rgba(255,248,234,0.68)", fontSize: 14, lineHeight: 22, marginTop: 14, maxWidth: 330 },
  truthCard: { borderRadius: 30, padding: 21, marginTop: 16, backgroundColor: "#F2E6CD" },
  truthKicker: { color: "#7D4C2B", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  truthTitle: { color: "#17251C", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 9 },
  truthText: { color: "rgba(23,37,28,0.66)", fontSize: 13, lineHeight: 20, marginTop: 10 },
  truthRows: { marginTop: 18, borderTopWidth: 1, borderTopColor: "rgba(23,37,28,0.10)" },
  truthRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(23,37,28,0.08)" },
  truthLabel: { color: "rgba(23,37,28,0.48)", fontSize: 11, fontWeight: "800" },
  truthValue: { flex: 1, textAlign: "right", color: "#17251C", fontSize: 11, fontWeight: "900" },
  menuCard: { borderRadius: 30, padding: 21, marginTop: 16, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "rgba(217,174,104,0.18)" },
  menuKicker: { color: "#D9AE68", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  menuTitle: { color: "#FFF8EA", fontSize: 23, lineHeight: 28, fontWeight: "900", marginTop: 9 },
  menuText: { color: "rgba(255,248,234,0.55)", fontSize: 12, lineHeight: 19, marginTop: 9 },
  menuRows: { marginTop: 16, gap: 9 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  menuCopy: { flex: 1, minWidth: 0 },
  menuName: { color: "#FFF8EA", fontSize: 12, lineHeight: 17, fontWeight: "900" },
  menuSignal: { color: "rgba(255,248,234,0.34)", fontSize: 8, lineHeight: 12, fontWeight: "800", marginTop: 4 },
  menuPrice: { fontSize: 10, fontWeight: "900" },
  menuGuard: { color: "rgba(255,248,234,0.34)", fontSize: 7, lineHeight: 12, fontWeight: "900", letterSpacing: 1.2, marginTop: 14 },
  culturalCard: { borderRadius: 26, padding: 18, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0C1D29", borderWidth: 1, borderColor: "rgba(159,225,255,0.16)" },
  culturalKicker: { color: "#9FE1FF", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 },
  culturalTitle: { color: "#F4FAFF", fontSize: 18, lineHeight: 23, fontWeight: "900", marginTop: 7 },
  culturalText: { color: "rgba(236,247,255,0.50)", fontSize: 10, lineHeight: 16, marginTop: 6 },
  culturalArrow: { color: "#9FE1FF", fontSize: 26, fontWeight: "800" },
  signalCard: { borderRadius: 30, padding: 21, marginTop: 16, backgroundColor: "#0A1D15", borderWidth: 1, borderColor: "rgba(217,174,104,0.17)" },
  signalKicker: { color: "#D9AE68", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  signalTitle: { color: "#FFF8EA", fontSize: 23, lineHeight: 28, fontWeight: "900", marginTop: 9 },
  signalText: { color: "rgba(255,248,234,0.57)", fontSize: 13, lineHeight: 20, marginTop: 9 },
  primaryButton: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 17, paddingVertical: 13, marginTop: 18, backgroundColor: "#D9AE68" },
  primaryButtonText: { color: "#1A1207", fontSize: 12, fontWeight: "900" },
  sourceButton: { borderRadius: 24, padding: 18, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.045)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sourceKicker: { color: "rgba(255,248,234,0.43)", fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  sourceTitle: { color: "#FFF8EA", fontSize: 16, fontWeight: "900", marginTop: 5 },
  sourceArrow: { color: "#D9AE68", fontSize: 27, fontWeight: "700" },
  ownerCard: { borderRadius: 30, padding: 22, marginTop: 16, backgroundColor: "#EBD7B0" },
  ownerKicker: { color: "#7F4D28", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  ownerTitle: { color: "#17251C", fontSize: 24, lineHeight: 30, fontWeight: "900", marginTop: 10 },
  ownerText: { color: "rgba(23,37,28,0.65)", fontSize: 13, lineHeight: 20, marginTop: 10 },
  ownerButton: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, marginTop: 18, backgroundColor: "#17251C" },
  ownerButtonText: { color: "#F8EBD2", fontSize: 11, fontWeight: "900" },
  opportunityCard: { borderRadius: 26, padding: 18, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#102F23", borderWidth: 1, borderColor: "rgba(80,209,141,0.20)" },
  opportunityKicker: { color: "#8CE6B8", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 },
  opportunityTitle: { color: "#FFF8EA", fontSize: 19, lineHeight: 24, fontWeight: "900", marginTop: 7 },
  opportunityText: { color: "rgba(255,248,234,0.52)", fontSize: 11, lineHeight: 17, marginTop: 6 },
  opportunityScore: { width: 58, height: 58, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "#50D18D" },
  opportunityScoreValue: { color: "#062013", fontSize: 20, fontWeight: "900" },

});
