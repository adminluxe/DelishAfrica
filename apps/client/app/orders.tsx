// DA_GALA_TACTILE_GRAVITY_ANCHOR_LADDER_V1 - heavy actions stay bottom-grounded while lighter controls progressively recenter their press pivot; resting surfaces and business behavior remain frozen.
// DA_GALA_TACTILE_ANCHOR_GROUNDED_CONTACT_V1 - pressed deformation is grounded to the bottom contact edge; resting surfaces and business behavior remain frozen.
// DA_GALA_TACTILE_MASS_ANISOTROPIC_COMPRESSION_V1 - area-equivalent directional compression on the validated contact plane; resting visuals and business behavior remain frozen.
// DA_GALA_TACTILE_DEPTH_CONTACT_PLANE_V1 - directional pressed-depth added to the validated three-tier press grammar; resting visuals and business behavior remain frozen.
// DA_GALA_TACTILE_CADENCE_HIERARCHICAL_PRESS_GRAMMAR_V1 - three-weight press cadence on known Client Orders + Merchant Ops interactions; resting visuals and business behavior stay frozen.
// DA_GALA_TACTILE_SILENCE_SOFT_COMPRESSION_R1_HF1_V1 - live-tree-aware primary-action discovery + quiet pressed response; resting surfaces and business behavior stay frozen.
// DA_GALA_FRAMELESS_RHYTHM_ONE_SURFACE_V1 - final framing reduction: anchors stay fixed while residual outlines dissolve into one continuous field.
// DA_GALA_NEGATIVE_SPACE_SIGNAL_FIRST_V1 - final optical quieting: information leads, support surfaces recede; Courier and shared materials remain frozen.
// DA_GALA_UNIFIED_CADENCE_R1_V1 - exact-tree convergence: Client + Merchant refine toward Courier benchmark; shared materials and Courier stay frozen.
// DA_GALA_SILENT_CHROME_V1 - global subtraction pass: visual chrome recedes, decision anchors and operational signals stay intact; static styles only.
// DA_GALA_VELVET_CONTRAST_V1 - focal gravity: dark secondary planes recede while human-decision anchors remain luminous; static styles only.
// DA_GALA_SELECTIVE_FOCUS_V1 - selective optical focus: primary actions stay crisp while secondary material dissolves; static styles only.
// DA_GALA_QUIET_LUXURY_V1 - zero-cost optical rhythm polish: softer hierarchy, quieter edges, fewer decorative signals; static styles only.
// DA_GALA_EDGELESS_CONTINUITY_V1 - last-mile surface polish dissolves legacy spectral leaks and reduces card-edge fatigue; presentation only.
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
style={({ pressed }) => [styles.actionCard, isGold ? styles.actionCardGold : null, pressed && (isGold ? styles.daPressPrimary : styles.daPressSecondary)]}
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

<Pressable style={({ pressed }) => [styles.backButton, pressed && styles.daPressMicro]} onPress={() => router.back()}>
<Text style={styles.backText}>Retour</Text>
</Pressable>

<Text style={styles.footer}>Commandes · suivi live · notifications · expérience premium.</Text>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
safe: { flex: 1, backgroundColor: "transparent" },
content: { padding: 20, paddingTop: 34, paddingBottom: 52 },
aquaVeil: {
position: "absolute",
top: -90,
right: -130,
width: 190,
height: 190,
borderRadius: 999,
backgroundColor: "rgba(111, 223, 218, 0.009)",
borderWidth: 1,
borderColor: "rgba(111, 223, 218, 0.022)",
},
aquaGlow: {
position: "absolute",
top: 260,
left: -96,
width: 150,
height: 150,
borderRadius: 999,
backgroundColor: "rgba(245, 190, 107, 0.016)",
borderWidth: 1,
borderColor: "rgba(245, 190, 107, 0.036)",
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
backgroundColor: "rgba(7, 49, 41, 0.66)",
borderWidth: 1,
borderColor: "rgba(111,223,218,0.060)",
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
backgroundColor: "rgba(255,240,194,0.885)",
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
padding: 18,
backgroundColor: "rgba(10,66,55,0.455)",
borderWidth: 0.22,
borderColor: "rgba(111,223,218,0.028)",
},
actionCardGold: {
backgroundColor: "rgba(245,190,107,0.885)",
borderColor: "rgba(245,190,107,0.24)",
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
backgroundColor: "rgba(7,49,41,0.56)",
borderWidth: 0.28,
borderColor: "rgba(111,223,218,0.050)",
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

  daPressPrimary: {
    opacity: 0.92,
    transformOrigin: "center bottom",
    transform: [{ scaleX: 0.990 }, { scaleY: 0.982 }, { translateY: 1 }],
  },
  daPressSecondary: {
    opacity: 0.96,
    transformOrigin: "center 75%",
    transform: [{ scaleX: 0.994 }, { scaleY: 0.990 }, { translateY: 0.55 }],
  },
  daPressMicro: {
    opacity: 0.975,
    transformOrigin: "center center",
    transform: [{ scaleX: 0.997 }, { scaleY: 0.995 }, { translateY: 0.25 }],
  }
});
