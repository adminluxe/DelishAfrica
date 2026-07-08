import React from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

const APP_LABEL = `Client`;
const SCREEN_TITLE = `Terrain OS Client`;
const KICKER = `LIVE STORY INTELLIGENTE`;
const HEADLINE = `Votre commande devient un récit vivant.`;
const SUBTITLE = `Cuisine, coursier, distance et promesse d’arrivée dans une seule lecture.`;
const PROMISE = `Promesse client`;
const PROMISE_TEXT = `Voir avant d’attendre. Comprendre avant de demander.`;
const CTA_LABEL = `Retour expérience client`;
const ROUTE_STEPS = ["Thieyp","Cuisine","Coursier","Vous"];

const C = {
bg: "#050914",
accent: "#F8C76A",
accent2: "#95B7FF",
card: "#101A38",
light: "#FFF5DE",
darkText: "#0B1020",
};

function Node({ label, active }: { label: string; active?: boolean }) {
return (
<View style={[styles.node, active ? styles.nodeActive : null]}>
<Text style={[styles.nodeText, active ? styles.nodeTextActive : null]}>{label}</Text>
</View>
);
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
return (
<View style={styles.metric}>
<Text style={styles.metricValue}>{value}</Text>
<Text style={styles.metricLabel}>{label}</Text>
<Text style={styles.metricHint}>{hint}</Text>
</View>
);
}

export default function TerrainOSScreen() {
return (
<SafeAreaView style={styles.safe}>
<StatusBar barStyle="light-content" />

<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />

<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
<Text style={styles.brand}>DELISHAFRICA® · {APP_LABEL}</Text>
<Text style={styles.screenTitle}>{SCREEN_TITLE}</Text>

<View style={styles.hero}>
<Text style={styles.kicker}>{KICKER}</Text>
<Text style={styles.headline}>{HEADLINE}</Text>
<Text style={styles.sub}>{SUBTITLE}</Text>

<View style={styles.routePanel}>
<View style={styles.routeLine} />
<View style={styles.routeNodes}>
{ROUTE_STEPS.map((item, index) => (
<Node key={item} label={item} active={index === 1} />
))}
</View>
</View>
</View>

<View style={styles.grid}>
<Metric label="ETA prédite" value="31 min" hint="Préparation + route" />
<Metric label="Confiance" value="92%" hint="Terrain stable" />
<Metric label="Rythme" value="Fluide" hint="Fenêtre maîtrisée" />
<Metric label="Signal" value="Live" hint="Sans stress" />
</View>

<View style={styles.lightCard}>
<Text style={styles.lightKicker}>{PROMISE}</Text>
<Text style={styles.lightTitle}>{PROMISE_TEXT}</Text>
<Text style={styles.lightText}>
Prochain palier : Google Routes côté backend, clé serveur protégée, puis ETA synchronisée entre Client, Merchant et Courier.
</Text>
</View>

<View style={styles.deepCard}>
<Text style={styles.deepKicker}>NEXT GEN</Text>
<Text style={styles.deepTitle}>Terrain OS n’est pas une carte.</Text>
<Text style={styles.deepText}>
C’est un cerveau opérationnel : il comprend la cuisine, le coursier, le client et le temps réel pour proposer la bonne décision au bon moment.
</Text>
</View>

<Pressable style={styles.back} onPress={() => router.back()}>
<Text style={styles.backText}>{CTA_LABEL}</Text>
</Pressable>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
safe: { flex: 1, backgroundColor: C.bg },
content: { paddingHorizontal: 18, paddingTop: 34, paddingBottom: 54 },

aquaVeil: {
position: "absolute",
top: -112,
right: -136,
width: 190,
height: 190,
borderRadius: 999,
backgroundColor: "rgba(120,245,255,0.018)",
borderWidth: 1,
borderColor: "rgba(230,255,250,0.040)",
transform: [{ scaleX: 1.3 }],
},
aquaRipple: {
position: "absolute",
top: 268,
left: -94,
width: 154,
height: 32,
borderRadius: 999,
borderWidth: 1,
borderColor: "rgba(230,255,250,0.040)",
backgroundColor: "rgba(120,245,255,0.012)",
transform: [{ rotate: "-17deg" }, { scaleX: 1.25 }],
},
aquaFoam: {
position: "absolute",
bottom: 108,
right: -78,
width: 122,
height: 122,
borderRadius: 999,
borderWidth: 1,
borderColor: "rgba(230,255,250,0.032)",
backgroundColor: "rgba(255,255,255,0.010)",
},

brand: {
color: C.accent,
fontSize: 18,
fontWeight: "900",
letterSpacing: 5.5,
},
screenTitle: {
color: "rgba(255,255,255,0.76)",
fontSize: 18,
fontWeight: "800",
marginTop: 7,
marginBottom: 22,
},

hero: {
borderRadius: 34,
padding: 24,
backgroundColor: C.card,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
kicker: {
color: C.accent2,
fontSize: 13,
fontWeight: "900",
letterSpacing: 4.5,
marginBottom: 14,
},
headline: {
color: "#FFFFFF",
fontSize: 37,
lineHeight: 42,
fontWeight: "900",
letterSpacing: -0.5,
},
sub: {
color: "rgba(255,255,255,0.74)",
fontSize: 17,
lineHeight: 26,
fontWeight: "700",
marginTop: 16,
},

routePanel: {
marginTop: 24,
borderRadius: 28,
minHeight: 160,
padding: 18,
backgroundColor: "rgba(255,255,255,0.055)",
overflow: "hidden",
},
routeLine: {
position: "absolute",
left: 38,
right: 38,
top: 79,
height: 3,
borderRadius: 999,
backgroundColor: "rgba(255,255,255,0.18)",
},
routeNodes: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
minHeight: 124,
},
node: {
minWidth: 62,
minHeight: 50,
borderRadius: 999,
paddingHorizontal: 10,
alignItems: "center",
justifyContent: "center",
backgroundColor: "rgba(255,255,255,0.12)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.14)",
},
nodeActive: {
backgroundColor: C.accent,
borderColor: C.accent,
transform: [{ scale: 1.08 }],
},
nodeText: {
color: "rgba(255,255,255,0.82)",
fontSize: 11,
fontWeight: "900",
textAlign: "center",
},
nodeTextActive: {
color: C.darkText,
},

grid: {
flexDirection: "row",
flexWrap: "wrap",
gap: 12,
marginTop: 18,
},
metric: {
width: "48%",
borderRadius: 24,
padding: 16,
minHeight: 116,
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
metricValue: {
color: "#FFFFFF",
fontSize: 25,
fontWeight: "900",
},
metricLabel: {
color: C.accent,
fontSize: 13,
fontWeight: "900",
marginTop: 8,
},
metricHint: {
color: "rgba(255,255,255,0.64)",
fontSize: 12,
fontWeight: "700",
lineHeight: 17,
marginTop: 6,
},

lightCard: {
marginTop: 18,
borderRadius: 34,
padding: 24,
backgroundColor: C.light,
},
lightKicker: {
color: "rgba(0,0,0,0.52)",
fontSize: 13,
fontWeight: "900",
letterSpacing: 4.5,
},
lightTitle: {
color: C.darkText,
fontSize: 29,
lineHeight: 35,
fontWeight: "900",
marginTop: 12,
},
lightText: {
color: "rgba(0,0,0,0.62)",
fontSize: 16,
lineHeight: 24,
fontWeight: "700",
marginTop: 12,
},

deepCard: {
marginTop: 18,
borderRadius: 30,
padding: 22,
backgroundColor: "rgba(255,255,255,0.06)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
deepKicker: {
color: C.accent,
fontSize: 13,
fontWeight: "900",
letterSpacing: 4.5,
},
deepTitle: {
color: "#FFFFFF",
fontSize: 28,
lineHeight: 34,
fontWeight: "900",
marginTop: 12,
},
deepText: {
color: "rgba(255,255,255,0.70)",
fontSize: 16,
lineHeight: 24,
fontWeight: "700",
marginTop: 10,
},

back: {
marginTop: 18,
borderRadius: 22,
paddingVertical: 16,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
backText: {
color: "#FFFFFF",
fontSize: 16,
fontWeight: "900",
},
});
