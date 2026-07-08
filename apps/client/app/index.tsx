import React, { useEffect, useState } from "react";
import {
ActivityIndicator,
Pressable,
RefreshControl,
ScrollView,
StatusBar,
StyleSheet,
Text,
View
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Partner = {
name?: string;
slug?: string;
address?: string;
rating?: number;
menu?: any[];
menuItems?: any[];
};

type Order = {
id?: string;
publicId?: string;
restaurantName?: string;
itemName?: string;
status?: string;
total?: number;
amount?: number;
items?: any[];
};

const API_ORIGIN = "https://api.delishafrica.me";
const API_V1 = "https://api.delishafrica.me/api/v1";

function priceLabel(order?: Order): string {
const raw = order && (order.total || order.amount) ? Number(order.total || order.amount) : 21.9;
const euros = Number.isInteger(raw) && raw >= 100 ? raw / 100 : raw;
return euros.toFixed(2).replace(".", ",") + " €";
}

function statusLabel(status?: string): string {
const s = String(status || "pending").toLowerCase();
if (s === "accepted") return "Acceptée";
if (s === "ready") return "Prête";
if (s === "picked_up") return "En route";
if (s === "delivered") return "Livrée";
return "Commande envoyée";
}

function statusKey(order?: Order): string {
return String(order?.status || "pending").toLowerCase();
}

function isActiveOrder(order?: Order): boolean {
const s = statusKey(order);
return !!order && s !== "delivered" && s !== "completed" && s !== "cancelled";
}

function orderTimestamp(order?: Order): number {
if (!order) return 0;
const anyOrder = order as any;
const candidates = [
anyOrder.updatedAt,
anyOrder.createdAt,
anyOrder.paidAt,
anyOrder.acceptedAt,
anyOrder.readyAt,
anyOrder.deliveredAt,
];
for (const value of candidates) {
const t = Date.parse(String(value || ""));
if (Number.isFinite(t)) return t;
}
const id = String(order.publicId || order.id || "");
const compact = id.replace(/[^0-9]/g, "");
return compact ? Number(compact.slice(-10)) : 0;
}

function pickLatestClientOrder(list: Order[]): Order | undefined {
const sorted = [...list].sort(function (a, b) {
const activeDelta = Number(isActiveOrder(b)) - Number(isActiveOrder(a));
if (activeDelta !== 0) return activeDelta;
return orderTimestamp(b) - orderTimestamp(a);
});
return sorted[0];
}

function orderItemSummary(order?: Order): string {
if (!order) return "Rice and Peace";
const items = Array.isArray(order.items) ? order.items : [];
if (items.length > 0) {
return items
.map(function (item: any) {
const qty = Number(item.quantity || item.qty || 1);
const name = String(item.name || item.label || item.title || item.itemName || "Article");
return qty > 1 ? qty + "× " + name : name;
})
.join(" · ");
}
return order.itemName || "Rice and Peace";
}

export default function ClientHomeScreen() {
const insets = useSafeAreaInsets();
const [partners, setPartners] = useState<Partner[]>([]);
const [orders, setOrders] = useState<Order[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

async function loadData() {
setLoading(true);
setError("");

try {
const partnersRes = await fetch(API_ORIGIN + "/api/partners?t=" + Date.now());
const partnersJson = await partnersRes.json();
setPartners(Array.isArray(partnersJson) ? partnersJson : []);

const ordersRes = await fetch(API_V1 + "/orders/demo/list", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({})
});
const ordersJson = await ordersRes.json();
setOrders(Array.isArray(ordersJson.orders) ? ordersJson.orders : []);
} catch (err: any) {
setError(err && err.message ? err.message : "Connexion temporairement indisponible.");
} finally {
setLoading(false);
}
}

useEffect(function () {
loadData();
}, []);

const thieyp = partners.find(function (p) { return p.slug === "thieyp"; }) || partners[0];
const menuItems = thieyp && (thieyp.menu || thieyp.menuItems) ? (thieyp.menu || thieyp.menuItems) : [];
const activeOrder = pickLatestClientOrder(orders);

return (
<ScrollView
style={styles.screen}
contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 10, 46) }]}
refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
showsVerticalScrollIndicator={false}
>
<StatusBar barStyle="light-content" />
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />

<View style={styles.header}>
<View>
<Text style={styles.brand}>DELISHAFRICA®</Text>
<Text style={styles.role}>Expérience Client</Text>
</View>
<View style={styles.live}>
<Text style={styles.liveText}>LIVE</Text>
</View>
</View>

<View style={styles.hero}>
<Text style={styles.kicker}>AFRO PREMIUM DELIVERY</Text>
<Text style={styles.title}>Explorez. Commandez. Voyagez.</Text>
<Text style={styles.subtitle}>
Le goût de l’Afrique, livré avec élégance.
</Text>

<View style={styles.buttonRow}>
<Pressable style={styles.goldButton} onPress={() => router.push("/restaurants" as any)}>
<Text style={styles.goldButtonText}>Voir les restaurants</Text>
</Pressable>

<Pressable style={styles.darkButton} onPress={() => router.push("/menu" as any)}>
<Text style={styles.darkButtonText}>Menu Thieyp</Text>
</Pressable>
</View>
</View>

{error ? (
<View style={styles.errorBox}>
<Text style={styles.errorText}>{error}</Text>
</View>
) : null}

<Pressable style={styles.partnerCard} onPress={() => router.push("/menu" as any)}>
<Text style={styles.partnerKicker}>PARTENAIRE EN LUMIÈRE</Text>
<Text style={styles.partnerTitle}>{thieyp && thieyp.name ? thieyp.name : "Thieyp"}</Text>
<Text style={styles.partnerText}>
{thieyp && thieyp.address ? thieyp.address : "Rue Longue Vie 46, 1050 Ixelles"}
</Text>
<Text style={styles.partnerText}>
Rice and Peace · Attiéké · Yassa · Mafé · Bissap · Gingembre · Baobab
</Text>

<View style={styles.metaRow}>
<View style={styles.metaBox}>
<Text style={styles.metaValue}>{menuItems.length || 13}</Text>
<Text style={styles.metaLabel}>items menu</Text>
</View>
<View style={styles.metaBox}>
<Text style={styles.metaValue}>{thieyp && thieyp.rating ? thieyp.rating : "4.8"}</Text>
<Text style={styles.metaLabel}>note</Text>
</View>
</View>
</Pressable>

<View style={styles.actionRow}>
<Pressable style={styles.actionGold} onPress={() => router.push("/menu" as any)}>
<Text style={styles.actionSmallDark}>COMMANDE</Text>
<Text style={styles.actionTitleDark}>Commander Thieyp</Text>
<Text style={styles.actionTextDark}>Menu Thieyp, panier, paiement sécurisé.</Text>
</Pressable>

<Pressable style={styles.actionDark} onPress={() => router.push("/order-tracking" as any)}>
<Text style={styles.actionSmallGold}>SUIVI</Text>
<Text style={styles.actionTitleLight}>Suivre ma commande</Text>
<Text style={styles.actionTextLight}>Client → Merchant → Courier → Livré.</Text>
</Pressable>
<Pressable
style={{
marginTop: 6,
borderRadius: 26,
paddingVertical: 19,
paddingHorizontal: 18,
backgroundColor: "#EAF3FF",
borderWidth: 1,
borderColor: "rgba(125,180,255,0.72)",
marginBottom: 20,
}}
onPress={() => router.push("/live-tracking" as any)}
>
<Text
style={{
color: "#07101E",
fontSize: 25,
fontWeight: "900",
textAlign: "center",
}}
>
Suivi intelligent
</Text>
<Text
style={{
color: "rgba(7,16,30,0.70)",
fontSize: 15,
fontWeight: "800",
textAlign: "center",
marginTop: 6,
lineHeight: 21,
}}
>
ETA, cuisine, coursier et étapes.
</Text>
</Pressable>



<Pressable
style={{
marginTop: 6,
borderRadius: 26,
paddingVertical: 19,
paddingHorizontal: 18,
backgroundColor: "#101A38",
borderWidth: 1,
borderColor: "rgba(255,209,102,0.38)",
marginBottom: 12,
}}
onPress={() => router.push("/live-story" as any)}
>
<Text
style={{
color: "#FFD166",
fontSize: 12,
fontWeight: "900",
letterSpacing: 3,
marginBottom: 8,
}}
>
LIVE STORY
</Text>
<Text
style={{
color: "#FFFFFF",
fontSize: 26,
fontWeight: "900",
lineHeight: 31,
}}
>
Histoire de ma commande
</Text>
<Text
style={{
color: "rgba(255,255,255,0.72)",
fontSize: 15,
fontWeight: "800",
lineHeight: 22,
marginTop: 8,
}}
>
Cuisine, coursier et livraison racontés en temps réel.
</Text>
</Pressable><Pressable style={styles.actionGold} onPress={() => router.push("/taste-oracle" as any)}>
<Text style={styles.actionSmallDark}>MAGIE</Text>
<Text style={styles.actionTitleDark}>AfroTaste Oracle</Text>
<Text style={styles.actionTextDark}>Une émotion, une assiette, une expérience DelishAfrica.</Text>
</Pressable>

<Pressable style={styles.actionDark} onPress={() => router.push("/notifications" as any)}>
<Text style={styles.actionTitleLight}>Mes alertes</Text>
<Text style={styles.actionTextLight}>Paiement, cuisine, livraison.</Text>
</Pressable>

<Pressable style={styles.actionDark} onPress={() => router.push("/delivery-intelligence" as any)}>
<Text style={styles.actionTitleLight}>This is DelishAfrica®</Text>
<Text style={styles.actionTextLight}>Paiement, cuisine, coursier et suivi live dans un même élan.</Text>
</Pressable>

</View>

<View style={styles.orderCard}>
<Text style={styles.orderKicker}>
{activeOrder ? (isActiveOrder(activeOrder) ? "COMMANDE ACTIVE" : "DERNIÈRE COMMANDE") : "PRÊT POUR LA PREMIÈRE COMMANDE"}
</Text>
<Text style={styles.orderTitle}>
{activeOrder && (activeOrder.publicId || activeOrder.id) ? (activeOrder.publicId || activeOrder.id) : "Rice and Peace"}
</Text>
<Text style={styles.orderText}>
{activeOrder ? ((activeOrder.restaurantName || "Thieyp") + " · " + priceLabel(activeOrder)) : "Commandez Thieyp et suivez chaque étape jusqu’à la livraison."}
</Text>
<Text style={styles.orderText}>
{orderItemSummary(activeOrder)}
</Text>
<View style={styles.statusPill}>
<Text style={styles.statusText}>{statusLabel(activeOrder && activeOrder.status ? activeOrder.status : undefined)}</Text>
</View>
</View>

 {loading ? (
<View style={styles.loading}>
<ActivityIndicator />
<Text style={styles.loadingText}>Synchronisation DelishAfrica...</Text>
</View>
) : null}

<Pressable
onPress={() => router.push("/terrain-os" as any)}
accessibilityRole="button"
style={{
marginTop: 18,
marginBottom: 4,
borderRadius: 30,
padding: 22,
minHeight: 152,
backgroundColor: "#101A38",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.13)",
overflow: "hidden",
}}
>
<View
pointerEvents="none"
style={{
position: "absolute",
top: -44,
right: -52,
width: 126,
height: 126,
borderRadius: 999,
backgroundColor: "rgba(120,245,255,0.025)",
borderWidth: 1,
borderColor: "rgba(230,255,250,0.055)",
}}
/>
<View
pointerEvents="none"
style={{
position: "absolute",
bottom: 18,
left: -42,
width: 118,
height: 26,
borderRadius: 999,
backgroundColor: "rgba(255,255,255,0.018)",
borderWidth: 1,
borderColor: "rgba(230,255,250,0.045)",
transform: [{ rotate: "-12deg" }],
}}
/>
<Text
style={{
color: "#F8C76A",
fontSize: 12,
fontWeight: "900",
letterSpacing: 5,
}}
>
TERRAIN OS
</Text>
<Text
style={{
color: "#FFFFFF",
fontSize: 28,
lineHeight: 33,
fontWeight: "900",
marginTop: 10,
}}
>
Live terrain augmenté
</Text>
<Text
style={{
color: "rgba(255,255,255,0.76)",
fontSize: 15,
lineHeight: 22,
fontWeight: "700",
marginTop: 8,
}}
>
Carte, ETA, cuisine et livraison dans un seul cerveau client.
</Text>
<View
style={{
alignSelf: "flex-start",
marginTop: 16,
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 10,
backgroundColor: "#F8C76A",
}}
>
<Text
style={{
color: "#080B13",
fontSize: 14,
fontWeight: "900",
}}
>
Ouvrir Terrain OS →
</Text>
</View>
</Pressable>
</ScrollView>
);
}

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(98, 202, 255, 0.020)", borderWidth: 1, borderColor: "rgba(220, 245, 255, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(218, 246, 255, 0.038)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(88, 211, 255, 0.020)", borderWidth: 1, borderColor: "rgba(200, 242, 255, 0.050)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 242, 255, 0.040)" },
screen: { flex: 1, backgroundColor: "#050915" },
content: { padding: 20, paddingTop: 54, paddingBottom: 48 },
header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
brand: { color: "#F5BE6B", fontSize: 18, fontWeight: "900", letterSpacing: 5 },
role: { color: "rgba(255,255,255,0.72)", fontSize: 14, marginTop: 4 },
live: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(245,190,107,0.45)" },
liveText: { color: "#F5BE6B", fontWeight: "900", fontSize: 12 },
hero: { borderRadius: 28, padding: 21, backgroundColor: "#101A38", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", marginBottom: 16 },
kicker: { color: "#F5BE6B", fontSize: 12, fontWeight: "900", letterSpacing: 3, marginBottom: 12 },
title: { color: "#FFF", fontSize: 34, fontWeight: "900", lineHeight: 38, marginBottom: 12 },
subtitle: { color: "rgba(255,255,255,0.76)", fontSize: 16, lineHeight: 23, marginBottom: 18 },
buttonRow: { flexDirection: "row" },
goldButton: { flex: 1.15, backgroundColor: "#F5BE6B", borderRadius: 18, paddingVertical: 15, alignItems: "center", marginRight: 10 },
goldButtonText: { color: "#111", fontWeight: "900", fontSize: 14 },
darkButton: { flex: 1, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 18, paddingVertical: 15, alignItems: "center" },
darkButtonText: { color: "#FFF", fontWeight: "900", fontSize: 14 },
errorBox: { borderRadius: 18, backgroundColor: "rgba(255,90,90,0.12)", padding: 14, marginBottom: 14 },
errorText: { color: "#FFB6B6", fontWeight: "800" },
partnerCard: { borderRadius: 28, padding: 20, backgroundColor: "#FFF5DE", marginBottom: 16 },
partnerKicker: { color: "#7A4A00", fontSize: 12, fontWeight: "900", letterSpacing: 2.5, marginBottom: 8 },
partnerTitle: { color: "#151515", fontSize: 30, fontWeight: "900", marginBottom: 8 },
partnerText: { color: "rgba(0,0,0,0.68)", fontSize: 15, lineHeight: 21, marginTop: 4 },
metaRow: { flexDirection: "row", marginTop: 16 },
metaBox: { backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 18, padding: 12, minWidth: 92, marginRight: 10 },
metaValue: { color: "#151515", fontSize: 20, fontWeight: "900" },
metaLabel: { color: "rgba(0,0,0,0.55)", fontSize: 12, fontWeight: "800", marginTop: 2 },
actionRow: { marginBottom: 16 },
actionGold: { borderRadius: 24, padding: 20, backgroundColor: "#F5BE6B", marginBottom: 12 },
actionDark: { borderRadius: 24, padding: 20, backgroundColor: "#121A34", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", marginBottom: 12 },
actionSmallDark: { color: "rgba(0,0,0,0.55)", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
actionSmallGold: { color: "#F5BE6B", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
actionTitleDark: { color: "#111", fontSize: 23, fontWeight: "900", marginTop: 8, lineHeight: 28 },
actionTitleLight: { color: "#FFF", fontSize: 23, fontWeight: "900", marginTop: 8, lineHeight: 28 },
actionTextDark: { color: "rgba(0,0,0,0.62)", fontSize: 15, lineHeight: 22, marginTop: 8 },
actionTextLight: { color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 22, marginTop: 8 },
orderCard: { borderRadius: 26, padding: 20, backgroundColor: "rgba(255,255,255,0.94)", marginBottom: 16 },
orderKicker: { color: "#6B4B00", fontSize: 11, fontWeight: "900", letterSpacing: 2.5, marginBottom: 8 },
orderTitle: { color: "#101010", fontSize: 25, fontWeight: "900", marginBottom: 8 },
orderText: { color: "rgba(0,0,0,0.68)", fontSize: 14, lineHeight: 20 },
statusPill: { alignSelf: "flex-start", backgroundColor: "#F5BE6B", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
statusText: { color: "#111", fontWeight: "900", fontSize: 12 },
discovery: { borderRadius: 26, padding: 20, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
discoveryTitle: { color: "#FFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },
discoveryText: { color: "rgba(255,255,255,0.72)", fontSize: 15, lineHeight: 22 },
discoveryButton: { flex: 1, borderRadius: 16, paddingVertical: 13, alignItems: "center", backgroundColor: "rgba(255,255,255,0.10)", marginRight: 8 },
discoveryButtonText: { color: "#FFF", fontWeight: "900" },
loading: { marginTop: 18, alignItems: "center" },
loadingText: { color: "rgba(255,255,255,0.65)", marginTop: 8 }
});
