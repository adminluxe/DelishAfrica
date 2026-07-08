import React from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

const lanes = [
{
label: "À accepter",
value: "Décision rapide",
detail: "Chaque commande entrante doit être lue, acceptée ou redirigée sans brouillard opérationnel.",
},
{
label: "En cuisine",
value: "Cadence maîtrisée",
detail: "Le cockpit aide à garder une préparation lisible avant l'arrivée du coursier.",
},
{
label: "Prêtes",
value: "Sortie contrôlée",
detail: "Une commande prête doit être visible immédiatement pour accélérer le dispatch.",
},
{
label: "Historique",
value: "Qualité suivie",
detail: "Les commandes livrées nourrissent la lecture future de performance partenaire.",
},
];

export default function KitchenOracleScreen() {
return (
<SafeAreaView style={styles.safe}>
<StatusBar barStyle="light-content" />
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
<View style={styles.hero}>
<Text style={styles.brand}>DELISHAFRICA® MERCHANT</Text>
<Text style={styles.kicker}>KITCHEN ORACLE</Text>
<Text style={styles.title}>La cuisine devient une tour de contrôle.</Text>
<Text style={styles.subtitle}>
Une lecture premium pour prioriser les commandes, suivre la rythme de service et préparer la coordination coursier.
</Text>
</View>

<View style={styles.pressureCard}>
<Text style={styles.pressureLabel}>Rythme service</Text>
<Text style={styles.pressureValue}>Maîtrisée</Text>
<Text style={styles.pressureText}>
Les signaux cuisine, commandes actives et sorties prêtes convergent vers une expérience plus fluide.
</Text>
<View style={styles.barShell}>
<View style={styles.barFill} />
</View>
</View>

<View style={styles.oracleCard}>
<Text style={styles.oracleKicker}>RECOMMANDATION</Text>
<Text style={styles.oracleTitle}>Accepter vite. Préparer juste. Sortir au bon moment.</Text>
<Text style={styles.oracleText}>
DelishAfrica® prépare une lecture plus fine des priorités cuisine, des fenêtres client et de la coordination coursier.
</Text>
</View>

{lanes.map((lane, index) => (
<View key={lane.label} style={styles.lane}>
<Text style={styles.laneNumber}>0{index + 1}</Text>
<View style={styles.laneBody}>
<Text style={styles.laneLabel}>{lane.label}</Text>
<Text style={styles.laneValue}>{lane.value}</Text>
<Text style={styles.laneDetail}>{lane.detail}</Text>
</View>
</View>
))}

<Pressable style={styles.primary} onPress={() => router.push("/orders" as any)}>
<Text style={styles.primaryText}>Ouvrir les commandes</Text>
</Pressable>

<Pressable style={styles.secondary} onPress={() => router.push("/ops-dashboard" as any)}>
<Text style={styles.secondaryText}>Voir Ops Lite</Text>
</Pressable>

<Pressable style={styles.ghost} onPress={() => router.back()}>
<Text style={styles.ghostText}>Retour</Text>
</Pressable>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(120, 245, 255, 0.018)", borderWidth: 1, borderColor: "rgba(214, 255, 248, 0.046)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(225, 255, 248, 0.040)" },
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(120, 245, 255, 0.020)", borderWidth: 1, borderColor: "rgba(230, 255, 250, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 246, 230, 0.014)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.038)" },
safe: { flex: 1, backgroundColor: "#130B07" },
content: { padding: 20, paddingBottom: 44 },
hero: {
borderRadius: 34,
padding: 24,
backgroundColor: "#2A130B",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.26)",
marginBottom: 16,
},
brand: { color: "#F7B267", fontSize: 12, fontWeight: "900", letterSpacing: 3, marginBottom: 14 },
kicker: { color: "rgba(255,248,239,0.62)", fontSize: 11, fontWeight: "900", letterSpacing: 3, marginBottom: 10 },
title: { color: "#FFF8EF", fontSize: 33, lineHeight: 39, fontWeight: "900" },
subtitle: { color: "rgba(255,248,239,0.76)", fontSize: 15, lineHeight: 23, marginTop: 14, fontWeight: "700" },
pressureCard: { borderRadius: 28, padding: 20, backgroundColor: "#FFF8EF", marginBottom: 16 },
pressureLabel: { color: "rgba(36,18,11,0.58)", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
pressureValue: { color: "#24120B", fontSize: 39, fontWeight: "900", marginTop: 4 },
pressureText: { color: "rgba(36,18,11,0.72)", fontSize: 15, lineHeight: 22, fontWeight: "800", marginTop: 8 },
barShell: { height: 10, borderRadius: 999, backgroundColor: "rgba(36,18,11,0.12)", marginTop: 16, overflow: "hidden" },
barFill: { width: "86%", height: "100%", borderRadius: 999, backgroundColor: "#24120B" },
oracleCard: {
borderRadius: 28,
padding: 20,
backgroundColor: "#F7B267",
marginBottom: 16,
},
oracleKicker: { color: "rgba(36,18,11,0.62)", fontSize: 11, fontWeight: "900", letterSpacing: 2.4, marginBottom: 8 },
oracleTitle: { color: "#24120B", fontSize: 25, lineHeight: 31, fontWeight: "900" },
oracleText: { color: "rgba(36,18,11,0.72)", fontSize: 15, lineHeight: 22, marginTop: 8, fontWeight: "800" },
lane: {
flexDirection: "row",
borderRadius: 24,
padding: 18,
backgroundColor: "rgba(255,248,239,0.08)",
borderWidth: 1,
borderColor: "rgba(255,248,239,0.10)",
marginBottom: 12,
},
laneNumber: { color: "#F7B267", fontSize: 18, fontWeight: "900", marginRight: 14 },
laneBody: { flex: 1 },
laneLabel: { color: "rgba(255,248,239,0.58)", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
laneValue: { color: "#FFF8EF", fontSize: 22, fontWeight: "900", marginTop: 5 },
laneDetail: { color: "rgba(255,248,239,0.72)", fontSize: 14, lineHeight: 20, marginTop: 6, fontWeight: "700" },
primary: { borderRadius: 20, paddingVertical: 16, alignItems: "center", backgroundColor: "#FFF8EF", marginTop: 8 },
primaryText: { color: "#24120B", fontSize: 15, fontWeight: "900" },
secondary: {
borderRadius: 20,
paddingVertical: 16,
alignItems: "center",
backgroundColor: "rgba(255,248,239,0.08)",
marginTop: 10,
borderWidth: 1,
borderColor: "rgba(255,248,239,0.12)",
},
secondaryText: { color: "#FFF8EF", fontSize: 15, fontWeight: "900" },
ghost: { paddingVertical: 18, alignItems: "center" },
ghostText: { color: "rgba(255,248,239,0.58)", fontSize: 14, fontWeight: "900" },
});
