import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { DELIVERY_ZONES_V1_LABEL } from "../utils/daDeliveryZones";

export default function DeliveryZonesScreen() {
const router = useRouter();

return (
<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
<View style={styles.hero}>
<Text style={styles.kicker}>DELISHAFRICA® DELIVERY ZONES</Text>
<Text style={styles.title}>Zones de livraison</Text>
<Text style={styles.subtitle}>
Une première couche simple et sûre avant Google Maps natif : on valide les zones par ville, adresse et cohérence restaurant.
</Text>
</View>

<View style={styles.cardGold}>
<Text style={styles.cardLabel}>Zone active V1</Text>
<Text style={styles.big}>{DELIVERY_ZONES_V1_LABEL}</Text>
<Text style={styles.cardTextGold}>
Thieyp reste le restaurant actif. Les nouveaux partenaires sont visibles, mais leurs livraisons seront ouvertes après validation.
</Text>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Règle panier</Text>
<Text style={styles.cardText}>
Une commande reste liée à un seul restaurant. Cela protège la cuisine, le coursier et le suivi live.
</Text>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Règle checkout</Text>
<Text style={styles.cardText}>
Avant le paiement, DelishAfrica vérifie que la ville ou l’adresse correspond à Bruxelles ou aux communes proches.
</Text>
</View>

<View style={styles.card}>
<Text style={styles.cardTitle}>Google Maps plus tard</Text>
<Text style={styles.cardText}>
Le SDK natif Google Maps nécessitera une clé protégée, app.config et un rebuild. Pour l’instant, on reste en text-only safe.
</Text>
</View>

<Pressable style={styles.primaryButton} onPress={() => router.push("/restaurants" as any)}>
<Text style={styles.primaryButtonText}>Voir les restaurants</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.back()}>
<Text style={styles.secondaryButtonText}>Retour</Text>
</Pressable>
</ScrollView>
);
}

const styles = StyleSheet.create({
screen: { flex: 1, backgroundColor: "#070A14" },
content: { padding: 20, paddingTop: 72, paddingBottom: 48 },
hero: {
borderRadius: 32,
padding: 24,
backgroundColor: "#11182A",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 18,
},
kicker: { color: "#F7C873", fontWeight: "900", letterSpacing: 1.1, marginBottom: 10 },
title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },
subtitle: { color: "#D8DDEE", fontSize: 16, lineHeight: 23 },
cardGold: {
borderRadius: 28,
padding: 22,
backgroundColor: "#FFF2C7",
marginBottom: 16,
},
card: {
borderRadius: 28,
padding: 22,
backgroundColor: "#0F1728",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 16,
},
cardLabel: { color: "#6B5C3C", fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
big: { color: "#1B1208", fontSize: 28, fontWeight: "900", marginBottom: 10 },
cardTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", marginBottom: 10 },
cardText: { color: "#D8DDEE", fontSize: 16, lineHeight: 23, fontWeight: "700" },

cardTextGold: { color: "#3B2A12", fontSize: 16, lineHeight: 23, fontWeight: "800" },
primaryButton: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "#F7C873", marginTop: 6, marginBottom: 10 },
primaryButtonText: { color: "#111827", fontWeight: "900", fontSize: 16 },
secondaryButton: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)" },
secondaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
});
