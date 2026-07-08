import React from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

const steps = [
["Paiement", "Commande sécurisée", "Le paiement valide le départ du parcours."],
["Cuisine", "Préparation priorisée", "Le restaurant reçoit une lecture claire de la commande."],
["Coursier", "Sélection intelligente", "Distance, ETA et disponibilité préparent le futur algorithme."],
["Livraison", "Suivi live", "Le client garde une vue simple jusqu'à la livraison."]
];

export default function DeliveryIntelligenceScreen() {
return (
<SafeAreaView style={styles.safe}>
<StatusBar barStyle="light-content" />
<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
<View style={styles.hero}>
<Text style={styles.brand}>DELISHAFRICA®</Text>
<Text style={styles.kicker}>DELIVERY INTELLIGENCE</Text>
<Text style={styles.title}>This is DelishAfrica®.</Text>
<Text style={styles.subtitle}>
Une expérience où paiement, cuisine, coursier et suivi live avancent dans le même langage.
</Text>
</View>

<View style={styles.scoreCard}>
<Text style={styles.scoreLabel}>Signal opérationnel</Text>
<Text style={styles.score}>92%</Text>
<Text style={styles.scoreText}>
Compatibilité estimée entre préparation cuisine, disponibilité coursier et fenêtre de livraison.
</Text>
<View style={styles.barShell}>
<View style={styles.barFill} />
</View>
</View>

<View style={styles.routeCard}>
<Text style={styles.sectionTitle}>Trajet intelligent</Text>
<View style={styles.routeLine}>
<View style={styles.node}><Text style={styles.nodeText}>Client</Text></View>
<View style={styles.line} />
<View style={styles.nodeGold}><Text style={styles.nodeDark}>Restaurant</Text></View>
<View style={styles.line} />
<View style={styles.node}><Text style={styles.nodeText}>Coursier</Text></View>
</View>
<Text style={styles.routeText}>
Visualisez les grandes étapes du trajet, de la préparation à la livraison, dans une expérience claire et premium.
</Text>
</View>

{steps.map(([label, value, detail], index) => (
<View key={label} style={styles.step}>
<Text style={styles.stepNumber}>0{index + 1}</Text>
<View style={styles.stepBody}>
<Text style={styles.stepLabel}>{label}</Text>
<Text style={styles.stepValue}>{value}</Text>
<Text style={styles.stepDetail}>{detail}</Text>
</View>
</View>
))}

<Pressable style={styles.primary} onPress={() => router.push("/menu" as any)}>
<Text style={styles.primaryText}>Commander maintenant</Text>
</Pressable>

<Pressable style={styles.secondary} onPress={() => router.push("/order-tracking" as any)}>
<Text style={styles.secondaryText}>Voir le suivi live</Text>
</Pressable>

<Pressable style={styles.ghost} onPress={() => router.back()}>
<Text style={styles.ghostText}>Retour</Text>
</Pressable>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
safe: { flex: 1, backgroundColor: "#050816" },
content: { padding: 20, paddingBottom: 44 },
hero: {
borderRadius: 34,
padding: 24,
backgroundColor: "#101A38",
borderWidth: 1,
borderColor: "rgba(245,190,107,0.24)",
marginBottom: 16
},
brand: { color: "#F5BE6B", fontSize: 13, fontWeight: "900", letterSpacing: 5, marginBottom: 14 },
kicker: { color: "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: "900", letterSpacing: 3, marginBottom: 10 },
title: { color: "#FFFFFF", fontSize: 34, lineHeight: 39, fontWeight: "900" },
subtitle: { color: "rgba(255,255,255,0.74)", fontSize: 15, lineHeight: 23, marginTop: 14, fontWeight: "700" },
scoreCard: { borderRadius: 28, padding: 20, backgroundColor: "#FFF4D8", marginBottom: 16 },
scoreLabel: { color: "rgba(32,20,10,0.58)", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
score: { color: "#20140A", fontSize: 52, fontWeight: "900", marginTop: 2 },
scoreText: { color: "rgba(32,20,10,0.72)", fontSize: 15, lineHeight: 22, fontWeight: "800" },
barShell: { height: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.12)", marginTop: 16, overflow: "hidden" },
barFill: { width: "92%", height: "100%", borderRadius: 999, backgroundColor: "#20140A" },
routeCard: {
borderRadius: 28,
padding: 20,
backgroundColor: "rgba(255,255,255,0.07)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 16
},
sectionTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginBottom: 18 },
routeLine: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
node: {
minWidth: 58,
minHeight: 42,
paddingHorizontal: 10,
borderRadius: 999,
alignItems: "center",
justifyContent: "center",
backgroundColor: "#101A38",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.16)"
},
nodeGold: {
minWidth: 68,
minHeight: 48,
paddingHorizontal: 10,
borderRadius: 999,
alignItems: "center",
justifyContent: "center",
backgroundColor: "#F5BE6B"
},
nodeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
nodeDark: { color: "#101010", fontSize: 11, fontWeight: "900" },
line: { flex: 1, height: 2, backgroundColor: "rgba(245,190,107,0.38)", marginHorizontal: 6 },
routeText: { color: "rgba(255,255,255,0.70)", fontSize: 14, lineHeight: 21, fontWeight: "700" },
step: {
flexDirection: "row",
borderRadius: 24,
padding: 18,
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
marginBottom: 12
},
stepNumber: { color: "#F5BE6B", fontSize: 18, fontWeight: "900", marginRight: 14 },
stepBody: { flex: 1 },
stepLabel: { color: "rgba(255,255,255,0.58)", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
stepValue: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 5 },
stepDetail: { color: "rgba(255,255,255,0.70)", fontSize: 14, lineHeight: 20, marginTop: 6, fontWeight: "700" },
primary: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "#F5BE6B", marginTop: 8 },
primaryText: { color: "#111111", fontSize: 15, fontWeight: "900" },
secondary: {
borderRadius: 20,
paddingVertical: 16,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
marginTop: 10,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)"
},
secondaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
ghost: { paddingVertical: 18, alignItems: "center" },
ghostText: { color: "rgba(255,255,255,0.58)", fontSize: 14, fontWeight: "900" }
});
