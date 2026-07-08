import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

type MoodKey = "comfort" | "discovery" | "energy" | "family" | "spicy" | "light";

type Mood = {
key: MoodKey;
label: string;
title: string;
subtitle: string;
dish: string;
drink: string;
price: string;
eta: string;
story: string;
ritual: string;
tags: string[];
};

const MOODS: Mood[] = [
{
key: "comfort",
label: "Réconfort",
title: "Foutu banane sauce graine",
subtitle: "Une assiette profonde, douce et généreuse.",
dish: "Foutu banane sauce graine",
drink: "Bissap maison",
price: "27,80 €",
eta: "Préparation 20 min · livraison estimée 32 min",
story: "Texture douce, sauce intense, chaleur de maison. Un choix fait pour ralentir le temps.",
ritual: "À savourer quand la journée a besoin d’un vrai câlin culinaire.",
tags: ["Doux", "Profond", "Maison"],
},
{
key: "discovery",
label: "Découverte",
title: "Rice and Peace",
subtitle: "La signature qui ouvre le voyage.",
dish: "Rice and Peace",
drink: "Gingembre",
price: "26,80 €",
eta: "Préparation 20 min · livraison estimée 31 min",
story: "Riz coco, haricots, pilons de poulet et sauce chien : une assiette qui raconte un pont entre énergie et élégance.",
ritual: "Parfait pour découvrir Thieyp sans hésiter.",
tags: ["Signature", "Vivant", "Premium"],
},
{
key: "energy",
label: "Énergie",
title: "Yassa de poulet",
subtitle: "Citron, oignons, tension vive et fraîche.",
dish: "Yassa de poulet",
drink: "Gingembre",
price: "26,80 €",
eta: "Préparation 20 min · livraison estimée 30 min",
story: "Une assiette lumineuse, acide, directe. Le genre de plat qui réveille le corps et l’esprit.",
ritual: "Idéal avant une longue soirée ou après une journée trop lourde.",
tags: ["Frais", "Tonique", "Citronné"],
},
{
key: "family",
label: "Famille",
title: "Thiéboudieune rouge",
subtitle: "Le grand classique qui rassemble.",
dish: "Thiéboudieune rouge",
drink: "Baobab",
price: "26,80 €",
eta: "Préparation 20 min · livraison estimée 34 min",
story: "Riz cassé tomaté, poisson et légumes : une assiette de transmission, de table pleine, de souvenirs partagés.",
ritual: "À choisir quand le repas doit avoir une âme.",
tags: ["Classique", "Partage", "Sénégal"],
},
{
key: "spicy",
label: "Caractère",
title: "Mafé à la viande",
subtitle: "Une sauce ronde, dense, assumée.",
dish: "Mafé à la viande",
drink: "Bissap maison",
price: "34,80 €",
eta: "Préparation 20 min · livraison estimée 33 min",
story: "La profondeur de l’arachide, la force de la viande, la chaleur du riz blanc. Un plat qui prend sa place.",
ritual: "Pour les faims sérieuses et les envies franches.",
tags: ["Dense", "Généreux", "Puissant"],
},
{
key: "light",
label: "Léger",
title: "Attiéké au poisson",
subtitle: "Fraîcheur, poisson mariné et équilibre.",
dish: "Attiéké au poisson",
drink: "Baobab",
price: "26,80 €",
eta: "Préparation 20 min · livraison estimée 29 min",
story: "Semoule de manioc, poisson mariné et salade fraîche. Une option claire, solaire, facile à aimer.",
ritual: "Quand on veut voyager sans s’alourdir.",
tags: ["Frais", "Poisson", "Équilibre"],
},
];

export default function TasteOracleScreen() {
const [selectedKey, setSelectedKey] = useState<MoodKey>("discovery");

const selected = useMemo(
() => MOODS.find((mood) => mood.key === selectedKey) || MOODS[0],
[selectedKey]
);

return (
<ScrollView style={styles.screen} contentContainerStyle={styles.content}>
<View style={styles.hero}>
<Text style={styles.brand}>DELISHAFRICA®</Text>
<Text style={styles.kicker}>AFROTASTE ORACLE</Text>
<Text style={styles.title}>Quelle émotion veux-tu manger aujourd’hui ?</Text>
<Text style={styles.subtitle}>
Choisis une intention. DelishAfrica transforme le menu en expérience.
</Text>
</View>

<View style={styles.moodGrid}>
{MOODS.map((mood) => {
const active = mood.key === selected.key;
return (
<Pressable
key={mood.key}
onPress={() => setSelectedKey(mood.key)}
style={[styles.moodChip, active && styles.moodChipActive]}
>
<Text style={[styles.moodText, active && styles.moodTextActive]}>{mood.label}</Text>
</Pressable>
);
})}
</View>

<View style={styles.oracleCard}>
<View style={styles.oracleTop}>
<Text style={styles.oracleBadge}>RECOMMANDATION</Text>
<Text style={styles.oracleEta}>{selected.eta}</Text>
</View>

<Text style={styles.dish}>{selected.title}</Text>
<Text style={styles.dishSubtitle}>{selected.subtitle}</Text>

<View style={styles.comboBox}>
<View style={styles.comboLine}>
<Text style={styles.comboLabel}>Plat</Text>
<Text style={styles.comboValue}>{selected.dish}</Text>
</View>
<View style={styles.comboLine}>
<Text style={styles.comboLabel}>Accord</Text>
<Text style={styles.comboValue}>{selected.drink}</Text>
</View>
<View style={styles.comboLine}>
<Text style={styles.comboLabel}>Estimation</Text>
<Text style={styles.comboValue}>{selected.price}</Text>
</View>
</View>

<Text style={styles.story}>{selected.story}</Text>
<Text style={styles.ritual}>{selected.ritual}</Text>

<View style={styles.tags}>
{selected.tags.map((tag) => (
<Text key={tag} style={styles.tag}>
{tag}
</Text>
))}
</View>
</View>

<View style={styles.pulseCard}>
<Text style={styles.pulseTitle}>Signal DelishAfrica</Text>
<Text style={styles.pulseText}>
Cette première version prépare le futur moteur de recommandation intelligent,
sans toucher au paiement, au checkout, à l’API ni à la verticale.
</Text>
</View>

<Pressable style={styles.primaryButton} onPress={() => router.push("/menu" as any)}>
<Text style={styles.primaryButtonText}>Composer mon panier</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/" as any)}>
<Text style={styles.secondaryButtonText}>Retour accueil</Text>
</Pressable>
</ScrollView>
);
}

const styles = StyleSheet.create({
screen: {
flex: 1,
backgroundColor: "#050817",
},
content: {
paddingTop: 68,
paddingHorizontal: 18,
paddingBottom: 34,
},
hero: {
borderRadius: 32,
padding: 24,
backgroundColor: "#0A1026",
borderWidth: 1,
borderColor: "rgba(255, 209, 102, 0.22)",
},
brand: {
color: "#FFD166",
fontSize: 13,
fontWeight: "900",
letterSpacing: 2.5,
},
kicker: {
color: "#8EA7FF",
fontSize: 12,
fontWeight: "900",
letterSpacing: 2,
marginTop: 14,
},
title: {
color: "#FFF8E8",
fontSize: 34,
lineHeight: 38,
fontWeight: "900",
marginTop: 10,
},
subtitle: {
color: "#B7BEDA",
fontSize: 16,
lineHeight: 23,
fontWeight: "700",
marginTop: 12,
},
moodGrid: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
marginTop: 18,
},
moodChip: {
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 12,
backgroundColor: "rgba(255,255,255,0.07)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
moodChipActive: {
backgroundColor: "#FFD166",
borderColor: "#FFD166",
},
moodText: {
color: "#D9DEF5",
fontSize: 14,
fontWeight: "900",
},
moodTextActive: {
color: "#10131F",
},
oracleCard: {
marginTop: 18,
borderRadius: 34,
padding: 24,
backgroundColor: "#FFF4D7",
},
oracleTop: {
gap: 8,
marginBottom: 16,
},
oracleBadge: {
color: "#5B3B00",
fontSize: 12,
fontWeight: "900",
letterSpacing: 2,
},
oracleEta: {
color: "#8B6A19",
fontSize: 13,
fontWeight: "800",
},
dish: {
color: "#11131A",
fontSize: 31,
lineHeight: 35,
fontWeight: "900",
},
dishSubtitle: {
color: "#5B4630",
fontSize: 16,
lineHeight: 22,
fontWeight: "800",
marginTop: 8,
},
comboBox: {
marginTop: 20,
borderRadius: 24,
padding: 16,
backgroundColor: "rgba(17,19,26,0.08)",
gap: 12,
},
comboLine: {
flexDirection: "row",
justifyContent: "space-between",
gap: 14,
},
comboLabel: {
color: "#71551E",
fontSize: 13,
fontWeight: "900",
textTransform: "uppercase",
letterSpacing: 1.3,
},
comboValue: {
color: "#11131A",
fontSize: 15,
fontWeight: "900",
flex: 1,
textAlign: "right",
},
story: {
color: "#21180C",
fontSize: 17,
lineHeight: 25,
fontWeight: "800",
marginTop: 20,
},
ritual: {
color: "#6C4D1A",
fontSize: 15,
lineHeight: 22,
fontWeight: "800",
marginTop: 12,
},
tags: {
flexDirection: "row",
flexWrap: "wrap",
gap: 8,
marginTop: 18,
},
tag: {
color: "#FFF7DF",
backgroundColor: "#11131A",
borderRadius: 999,
paddingHorizontal: 13,
paddingVertical: 8,
fontSize: 12,
fontWeight: "900",
},
pulseCard: {
marginTop: 18,
borderRadius: 26,
padding: 18,
backgroundColor: "rgba(142,167,255,0.12)",
borderWidth: 1,
borderColor: "rgba(142,167,255,0.22)",
},
pulseTitle: {
color: "#DCE5FF",
fontSize: 17,
fontWeight: "900",
},
pulseText: {
color: "#AEB9DD",
fontSize: 14,
lineHeight: 21,
fontWeight: "700",
marginTop: 8,
},
primaryButton: {
marginTop: 18,
borderRadius: 24,
paddingVertical: 18,
alignItems: "center",
backgroundColor: "#FFD166",
},
primaryButtonText: {
color: "#10131F",
fontSize: 17,
fontWeight: "900",
},
secondaryButton: {
marginTop: 12,
borderRadius: 24,
paddingVertical: 16,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
},
secondaryButtonText: {
color: "#FFF8E8",
fontSize: 15,
fontWeight: "900",
},
});
