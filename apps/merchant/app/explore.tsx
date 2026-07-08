import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function MerchantExploreScreen() {
  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>DELISHAFRICA · MERCHANT</Text>
        <Text style={styles.title}>Partenaires & menus</Text>
        <Text style={styles.text}>
          Thieyp est le partenaire actif de référence. Les autres restaurants sont en préparation pour les prochaines ouvertures partenaires.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.badge}>ACTIF</Text>
        <Text style={styles.cardTitle}>Thieyp</Text>
        <Text style={styles.text}>Rue Longue Vie 46, 1050 Ixelles</Text>
        <Text style={styles.text}>Menu réel : Rice and Peace, attiéké, yassa, mafé, bissap, gingembre, baobab.</Text>
      </View>

      <Pressable style={styles.cta} onPress={() => router.push("/partner-space" as any)}>
        <Text style={styles.ctaText}>Ouvrir l’espace partenaire</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080706" },
  page: { padding: 20, paddingBottom: 44, gap: 16 },
  hero: { borderRadius: 28, padding: 22, backgroundColor: "#15100D", borderWidth: 1, borderColor: "rgba(255,143,53,0.22)" },
  kicker: { color: "#FFB46F", fontSize: 12, fontWeight: "900", letterSpacing: 3, marginBottom: 10 },
  title: { color: "#FFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },
  text: { color: "rgba(255,255,255,0.76)", fontSize: 15, lineHeight: 22 },
  card: { borderRadius: 24, padding: 18, backgroundColor: "#2A130D", borderWidth: 1, borderColor: "rgba(255,181,107,0.35)" },
  badge: { color: "#FFB46F", fontSize: 12, fontWeight: "900", letterSpacing: 3, marginBottom: 8 },
  cardTitle: { color: "#FFF", fontSize: 26, fontWeight: "900", marginBottom: 8 },
  cta: { borderRadius: 18, paddingVertical: 16, alignItems: "center", backgroundColor: "#FF8F35" },
  ctaText: { color: "#17100A", fontSize: 16, fontWeight: "900" },
});
