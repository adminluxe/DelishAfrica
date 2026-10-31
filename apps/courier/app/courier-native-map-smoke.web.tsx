import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

/** Web-only fallback: never load react-native-maps or device GPS in a browser.
 * iOS/Android keep the complete courier-native-map-smoke.tsx screen.
 */
export default function CourierNativeMapSmokeWeb() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.brand}>DELISHAFRICA® / COURIER</Text>
        <Text style={styles.kicker}>VALIDATION CARTE NATIVE</Text>
        <Text style={styles.title}>Le guidage prend vie sur mobile.</Text>
        <Text style={styles.description}>
          Cette démonstration vérifie les cartes natives iOS et Android.
          Elle ne fait aucun appel API, n’obtient aucune localisation de
          l’utilisateur et ne modifie aucune livraison.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mode navigateur</Text>
          <Text style={styles.cardCopy}>
            Carte native indisponible ici : pour les repères de test,
            ouvrez DelishAfrica® Courier sur un téléphone compatible.
          </Text>
        </View>
        <Pressable accessibilityRole="button" style={styles.primary}
          onPress={() => router.push("/courier-real-map")}>
          <Text style={styles.primaryText}>Consulter l’espace mission</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.secondary}
          onPress={() => router.replace("/")}>
          <Text style={styles.secondaryText}>Retour à l’accueil</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#061B18" },
  page: { flexGrow: 1, justifyContent: "center", alignSelf: "center",
    width: "100%", maxWidth: 690, padding: 28 },
  brand: { color: "#CBFEE6", letterSpacing: 2.3, fontSize: 12,
    fontWeight: "900", marginBottom: 35 },
  kicker: { color: "#E8BD7A", letterSpacing: 2, fontSize: 12,
    fontWeight: "900", marginBottom: 13 },
  title: { color: "white", fontWeight: "900", fontSize: 34, lineHeight: 42,
    marginBottom: 19 },
  description: { color: "#C5DDD0", fontSize: 16, lineHeight: 26,
    marginBottom: 24 },
  card: { backgroundColor: "#10342D", borderWidth: 1, borderColor: "#427267",
    borderRadius: 24, padding: 25, marginBottom: 24 },
  cardTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900",
    marginBottom: 12 },
  cardCopy: { color: "#D0E5DA", fontSize: 15, lineHeight: 24 },
  primary: { backgroundColor: "#E9C58B", borderRadius: 19,
    padding: 19, alignItems: "center" },
  primaryText: { color: "#143024", fontSize: 16, fontWeight: "900" },
  secondary: { paddingVertical: 22, alignItems: "center" },
  secondaryText: { color: "#C8E7DC", fontSize: 14, fontWeight: "700" },
});
