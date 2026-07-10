import React from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

type OrderAction = {
kicker: string;
title: string;
text: string;
route: string;
tone?: "gold" | "dark";
};

const ACTIONS: OrderAction[] = [
{
kicker: "LIVE",
title: "Suivi principal",
text: "Voir la commande active, son statut et l’avancée jusqu’à la livraison.",
route: "/live-tracking",
tone: "gold",
},
{
kicker: "DÉTAIL",
title: "Suivi détaillé",
text: "Retrouver la timeline complète et les informations utiles de la commande.",
route: "/order-tracking",
},
{
kicker: "ALERTES",
title: "Notifications",
text: "Suivre les signaux importants : paiement, cuisine, coursier et livraison.",
route: "/notifications",
},
{
kicker: "COMMANDER",
title: "Restaurants",
text: "Découvrir les partenaires DelishAfrica® et préparer une nouvelle commande.",
route: "/restaurants",
},
];

function ActionCard({ action }: { action: OrderAction }) {
const isGold = action.tone === "gold";

return (
<Pressable
style={[styles.actionCard, isGold ? styles.actionCardGold : null]}
onPress={() => router.push(action.route as any)}
>
<Text style={[styles.actionKicker, isGold ? styles.actionKickerDark : null]}>{action.kicker}</Text>
<Text style={[styles.actionTitle, isGold ? styles.actionTitleDark : null]}>{action.title}</Text>
<Text style={[styles.actionText, isGold ? styles.actionTextDark : null]}>{action.text}</Text>
</Pressable>
);
}

export default function ClientOrdersScreen() {
return (
<SafeAreaView style={styles.safe}>
<StatusBar barStyle="light-content" />
<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaGlow} />

<View style={styles.header}>
<Text style={styles.brand}>DELISHAFRICA®</Text>
<Text style={styles.role}>Expérience Client</Text>
</View>

<View style={styles.hero}>
<Text style={styles.kicker}>MES COMMANDES</Text>
<Text style={styles.title}>Suivez vos commandes avec clarté.</Text>
<Text style={styles.subtitle}>
Retrouvez le suivi live, les détails de livraison et les notifications importantes depuis un seul espace.
</Text>
</View>

<View style={styles.statusCard}>
<Text style={styles.statusKicker}>CENTRE DE SUIVI</Text>
<Text style={styles.statusTitle}>Tout reste synchronisé.</Text>
<Text style={styles.statusText}>
Votre commande, le restaurant et le coursier avancent dans le même fil DelishAfrica®.
</Text>
</View>

<View style={styles.grid}>
{ACTIONS.map((action) => (
<ActionCard key={action.route} action={action} />
))}
</View>

<Pressable style={styles.backButton} onPress={() => router.back()}>
<Text style={styles.backText}>Retour</Text>
</Pressable>

<Text style={styles.footer}>Commandes · suivi live · notifications · expérience premium.</Text>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
safe: { flex: 1, backgroundColor: "#050914" },
content: { padding: 20, paddingTop: 34, paddingBottom: 52 },
aquaVeil: {
position: "absolute",
top: -90,
right: -130,
width: 190,
height: 190,
borderRadius: 999,
backgroundColor: "rgba(105, 220, 255, 0.022)",
borderWidth: 1,
borderColor: "rgba(220, 245, 255, 0.050)",
},
aquaGlow: {
position: "absolute",
top: 260,
left: -96,
width: 150,
height: 150,
borderRadius: 999,
backgroundColor: "rgba(245, 190, 107, 0.030)",
borderWidth: 1,
borderColor: "rgba(245, 190, 107, 0.070)",
},
header: {
marginBottom: 18,
},
brand: {
color: "#F5BE6B",
fontSize: 17,
fontWeight: "900",
letterSpacing: 4,
},
role: {
color: "rgba(255,255,255,0.70)",
fontSize: 13,
marginTop: 5,
fontWeight: "700",
},
hero: {
borderRadius: 32,
padding: 24,
backgroundColor: "rgba(15, 23, 42, 0.92)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 16,
},
kicker: {
color: "#F5BE6B",
fontSize: 12,
fontWeight: "900",
letterSpacing: 1.7,
marginBottom: 10,
},
title: {
color: "#FFF9EA",
fontSize: 34,
lineHeight: 38,
fontWeight: "900",
marginBottom: 10,
},
subtitle: {
color: "rgba(255,249,234,0.76)",
fontSize: 15,
lineHeight: 22,
fontWeight: "700",
},
statusCard: {
borderRadius: 28,
padding: 22,
backgroundColor: "#FFF0C2",
marginBottom: 16,
},
statusKicker: {
color: "#6D5421",
fontSize: 11,
fontWeight: "900",
letterSpacing: 1.5,
marginBottom: 8,
},
statusTitle: {
color: "#171106",
fontSize: 25,
fontWeight: "900",
marginBottom: 8,
},
statusText: {
color: "#3B2A12",
fontSize: 15,
lineHeight: 22,
fontWeight: "800",
},
grid: { gap: 12 },
actionCard: {
borderRadius: 24,
padding: 19,
backgroundColor: "rgba(255,255,255,0.070)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.11)",
},
actionCardGold: {
backgroundColor: "#F5BE6B",
borderColor: "rgba(255,255,255,0.18)",
},
actionKicker: {
color: "#F5BE6B",
fontSize: 11,
fontWeight: "900",
letterSpacing: 1.5,
marginBottom: 7,
},
actionKickerDark: { color: "#4B3410" },
actionTitle: {
color: "#FFF9EA",
fontSize: 21,
fontWeight: "900",
marginBottom: 7,
},
actionTitleDark: { color: "#120C04" },
actionText: {
color: "rgba(255,255,255,0.72)",
fontSize: 14,
lineHeight: 20,
fontWeight: "700",
},
actionTextDark: { color: "#3B2A12" },
backButton: {
marginTop: 18,
borderRadius: 20,
paddingVertical: 15,
alignItems: "center",
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
},
backText: {
color: "#FFF9EA",
fontSize: 15,
fontWeight: "900",
},
footer: {
marginTop: 18,
color: "rgba(255,255,255,0.46)",
textAlign: "center",
fontSize: 12,
fontWeight: "800",
},
});
