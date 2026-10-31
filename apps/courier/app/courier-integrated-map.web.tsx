import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

/**
 * DelishAfrica® Courier: safe browser fallback.
 * The native iOS/Android screen continues to use courier-integrated-map.tsx
 * (react-native-maps + GPS). Never import native-only map internals on web.
 * No invented location, ETA, driver status, or live order data.
 */
export default function CourierIntegratedMapWeb() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.top}>
          <Text style={s.brand}>DELISHAFRICA®  /  COURIER</Text>
          <View style={s.badge}><Text style={s.badgeText}>NAVIGATION SÉCURISÉE</Text></View>
        </View>
        <Text style={s.eyebrow}>VOTRE MISSION • VOTRE RYTHME</Text>
        <Text style={s.title}>Le terrain, sans approximation.</Text>
        <Text style={s.copy}>
          L’itinéraire GPS et la carte interactive sont disponibles dans l’application
          native sur iOS et Android. Sur le web, consultez les détails vérifiés
          de votre mission sans afficher de position inventée.
        </Text>
        <View style={s.card}>
          <View style={s.dot} />
          <View style={s.cardContent}>
            <Text style={s.cardKicker}>CARTE NATIVE</Text>
            <Text style={s.cardTitle}>Repères réels, guidage fiable.</Text>
            <Text style={s.cardCopy}>
              L’autorisation de localisation n’est demandée que dans l’application
              compatible. Aucune position n’est transmise depuis cet écran web.
            </Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" style={s.primary}
          onPress={() => router.push("/courier-real-map")}>
          <Text style={s.primaryText}>Voir les détails de mission</Text>
          <Text style={s.chevron}>›</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={s.secondary}
          onPress={() => router.replace("/")}>
          <Text style={s.secondaryText}>Retour à l’espace coursier</Text>
        </Pressable>
        <Text style={s.footer}>
          DelishAfrica® — Informations réelles uniquement. Aucun itinéraire
          estimé n’est présenté comme confirmé.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#061B18" },
  scroll: {
    flexGrow: 1, width: "100%", maxWidth: 720, alignSelf: "center",
    justifyContent: "center", paddingHorizontal: 26, paddingVertical: 44,
  },
  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "center",
    justifyContent: "space-between", gap: 14, marginBottom: 45 },
  brand: { color: "#C8FFE7", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  badge: { borderRadius: 22, borderWidth: 1, borderColor: "#456E62",
    backgroundColor: "#112E29", paddingHorizontal: 14, paddingVertical: 8 },
  badgeText: { color: "#B8E7D2", fontSize: 10, letterSpacing: 1, fontWeight: "800" },
  eyebrow: { color: "#D9AA64", fontSize: 12, fontWeight: "900", letterSpacing: 2,
    marginBottom: 13 },
  title: { color: "#FFFFFF", fontSize: 38, lineHeight: 45, fontWeight: "900",
    maxWidth: 540, marginBottom: 19 },
  copy: { color: "#D2E2DB", fontSize: 16, lineHeight: 26, marginBottom: 30 },
  card: { flexDirection: "row", padding: 23, borderRadius: 26,
    backgroundColor: "#10332D", borderColor: "#30665A", borderWidth: 1,
    marginBottom: 25, gap: 14 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#70E2A3",
    marginTop: 5 },
  cardContent: { flex: 1 },
  cardKicker: { fontSize: 11, letterSpacing: 2, color: "#8DCEB3",
    fontWeight: "800", marginBottom: 8 },
  cardTitle: { fontSize: 19, fontWeight: "900", lineHeight: 25, color: "#FFFFFF",
    marginBottom: 9 },
  cardCopy: { color: "#C0DBCF", fontSize: 14, lineHeight: 23 },
  primary: { flexDirection: "row", borderRadius: 20, backgroundColor: "#EAC585",
    paddingHorizontal: 22, paddingVertical: 19, alignItems: "center",
    justifyContent: "space-between" },
  primaryText: { color: "#113124", fontSize: 16, fontWeight: "900", flexShrink: 1 },
  chevron: { color: "#113124", fontSize: 27, fontWeight: "800" },
  secondary: { paddingVertical: 22, alignItems: "center" },
  secondaryText: { color: "#C8E7DC", fontSize: 14, fontWeight: "700" },
  footer: { fontSize: 11, lineHeight: 18, color: "#72968B", marginTop: 14 },
});
