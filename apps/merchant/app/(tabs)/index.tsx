import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

function go(path: string) {
  router.push(path as any);
}

export default function MerchantHome() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>DELISHAFRICA · MERCHANT</Text>
            <Text style={styles.subtitle}>Espace Partenaire</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>CUISINE PARTENAIRE</Text>
          <Text style={styles.heroTitle}>Commandes. Thieyp. Lisibilité.</Text>
          <Text style={styles.heroText}>
            Cockpit connecté à Thieyp : commandes, préparation, menu réel et consignes coursier.
          </Text>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>01</Text>
              <Text style={styles.metricLabel}>Restaurant actif</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>API</Text>
              <Text style={styles.metricLabel}>Connectée</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>3</Text>
              <Text style={styles.metricLabel}>Étapes cuisine</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Actions cuisine</Text>
        <Text style={styles.sectionText}>
          Les écrans importants restent accessibles, sans console technique ni routes brutes visibles.
        </Text>

        <Pressable style={[styles.card, styles.primary]} onPress={() => go("/orders")}>
          <View>
            <Text style={styles.kickerLight}>PRODUCTION</Text>
            <Text style={styles.cardTitle}>Voir les commandes</Text>
            <Text style={styles.cardText}>Accepter, préparer et marquer les commandes comme prêtes.</Text>
          </View>
          <Text style={styles.arrowLight}>→</Text>
        </Pressable>

        <Pressable style={[styles.card, styles.dark]} onPress={() => go("/partner-space")}>
          <View>
            <Text style={styles.kicker}>PARTENAIRE ACTIF</Text>
            <Text style={styles.cardTitle}>Thieyp</Text>
            <Text style={styles.cardText}>Rue Longue Vie 46, Ixelles · cuisine sénégalaise · menu réel chargé.</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        <Pressable style={[styles.card, styles.dark]} onPress={() => go("/explore")}>
          <View>
            <Text style={styles.kicker}>DÉCOUVERTE</Text>
            <Text style={styles.cardTitle}>Partenaires & menus</Text>
            <Text style={styles.cardText}>Thieyp actif, avec de nouveaux partenaires en préparation.</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>

        <Pressable style={[styles.card, styles.ops]} onPress={() => go("/ops-dashboard")}>
          <View>
            <Text style={styles.kickerDark}>QUALITÉ</Text>
            <Text style={styles.opsTitle}>Ops & suivi</Text>
            <Text style={styles.opsText}>Garder un œil sur la fluidité de service et les points de contrôle.</Text>
          </View>
          <Text style={styles.opsArrow}>→</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Parcours commande</Text>
          <Text style={styles.footerText}>
            Client commande → restaurant accepte → cuisine prépare → commande prête → Courier récupère → livraison confirmée.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080706" },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 44 },
  topbar: {
    marginTop: 8,
    marginBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: "#FF9B45",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 5,
  },
  subtitle: { color: "#EAD8C7", marginTop: 6, fontSize: 14, fontWeight: "800" },
  pill: {
    backgroundColor: "rgba(255, 143, 53, 0.16)",
    borderColor: "rgba(255, 143, 53, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: "#FFB46F", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  hero: {
    backgroundColor: "#15100D",
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 143, 53, 0.18)",
    marginBottom: 26,
  },
  kicker: {
    color: "#FFB46F",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 5,
    marginBottom: 10,
  },
  kickerLight: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 5,
    marginBottom: 10,
  },
  kickerDark: {
    color: "#2A1200",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 5,
    marginBottom: 10,
  },
  heroTitle: { color: "#FFFFFF", fontSize: 31, lineHeight: 36, fontWeight: "900" },
  heroText: { color: "#E5D0C0", fontSize: 15, lineHeight: 22, marginTop: 12, fontWeight: "700" },
  metrics: { flexDirection: "row", gap: 10, marginTop: 20 },
  metric: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 12,
  },
  metricValue: { color: "#FFFFFF", fontWeight: "900", fontSize: 18 },
  metricLabel: { color: "#D8BFAE", fontWeight: "800", fontSize: 11, marginTop: 4 },
  sectionTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 5 },
  sectionText: { color: "#CBB9AB", fontSize: 14, lineHeight: 20, marginBottom: 16, fontWeight: "700" },
  card: {
    minHeight: 118,
    borderRadius: 25,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primary: { backgroundColor: "#FF8F35" },
  dark: {
    backgroundColor: "#15100D",
    borderWidth: 1,
    borderColor: "rgba(255, 143, 53, 0.18)",
  },
  ops: { backgroundColor: "#FFC06F" },
  cardTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900" },
  cardText: { color: "#E7D4C5", fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 260, fontWeight: "700" },
  arrow: { color: "#FFB46F", fontSize: 30, fontWeight: "900" },
  arrowLight: { color: "#FFFFFF", fontSize: 32, fontWeight: "900" },
  opsTitle: { color: "#241000", fontSize: 23, fontWeight: "900" },
  opsText: { color: "#3A1C00", fontSize: 14, lineHeight: 20, marginTop: 7, maxWidth: 260, fontWeight: "800" },
  opsArrow: { color: "#2A1200", fontSize: 30, fontWeight: "900" },
  footer: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 22,
    padding: 18,
    marginTop: 4,
  },
  footerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  footerText: { color: "#CAB5A5", lineHeight: 20, marginTop: 8, fontWeight: "700" },
});
