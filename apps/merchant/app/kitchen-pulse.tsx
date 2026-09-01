import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
Pressable,
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { router } from "expo-router";

type OrderLike = {
id?: string;
orderId?: string;
publicId?: string;
status?: string;
restaurantName?: string;
merchantName?: string;
total?: number;
amount?: number;
createdAt?: string;
updatedAt?: string;
items?: Array<{ name?: string; title?: string; quantity?: number; qty?: number; price?: number }>;
};

const RAW_API =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me/api/v1";

function apiBase() {
const clean = String(RAW_API).replace(/\/+$/, "");
return clean.endsWith("/api/v1") ? clean : `${clean}/api/v1`;
}

const API_BASE_URL = apiBase();

function normalizeOrders(payload: any): OrderLike[] {
if (Array.isArray(payload)) return payload;
if (Array.isArray(payload?.orders)) return payload.orders;
if (Array.isArray(payload?.items)) return payload.items;
if (Array.isArray(payload?.data)) return payload.data;
return [];
}

function orderId(order: OrderLike) {
return order.orderId || order.publicId || order.id || "Commande";
}

function statusLabel(status?: string) {
switch (status) {
case "pending":
return "À accepter";
case "accepted":
return "En cuisine";
case "ready":
return "Prête";
case "picked_up":
return "En livraison";
case "delivered":
return "Livrée";
case "cancelled":
return "Annulée";
default:
return "À suivre";
}
}

function money(value?: number) {
const cents = typeof value === "number" ? value : 0;
const euros = cents > 100 ? cents / 100 : cents;
return new Intl.NumberFormat("fr-BE", {
style: "currency",
currency: "EUR",
minimumFractionDigits: 2,
}).format(euros);
}

function itemSummary(order: OrderLike) {
const items = Array.isArray(order.items) ? order.items : [];
if (!items.length) return "Commande cuisine";
return items
.slice(0, 2)
.map((item) => {
const qty = item.quantity ?? item.qty ?? 1;
const name = item.name || item.title || "Plat";
return `${qty}× ${name}`;
})
.join(" · ");
}

function pressureLabel(active: number, pending: number, ready: number) {
if (pending >= 4 || active >= 8) return "Pression élevée";
if (pending >= 2 || active >= 4 || ready >= 3) return "Service soutenu";
if (active > 0) return "Service fluide";
return "Cuisine calme";
}

function pressureScore(active: number, pending: number, ready: number) {
return Math.min(100, Math.round(active * 9 + pending * 14 + ready * 6));
}

export default function KitchenPulseScreen() {
const [orders, setOrders] = useState<OrderLike[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState("");

const load = useCallback(async () => {
setError("");
try {
const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({}),
});

const text = await response.text();
let json: any = {};
try {
json = text ? JSON.parse(text) : {};
} catch {
json = {};
}

if (!response.ok) {
throw new Error(`Service commandes indisponible (${response.status})`);
}

setOrders(normalizeOrders(json));
} catch (err: any) {
setError(err?.message || "Impossible de lire la file cuisine.");
} finally {
setLoading(false);
setRefreshing(false);
}
}, []);

useEffect(() => {
load();
}, [load]);

const stats = useMemo(() => {
const pending = orders.filter((o) => o.status === "pending").length;
const accepted = orders.filter((o) => o.status === "accepted").length;
const ready = orders.filter((o) => o.status === "ready").length;
const pickedUp = orders.filter((o) => o.status === "picked_up").length;
const delivered = orders.filter((o) => o.status === "delivered").length;
const active = orders.filter((o) =>
["pending", "accepted", "ready", "picked_up"].includes(String(o.status))
).length;
const score = pressureScore(active, pending, ready);

return {
total: orders.length,
active,
pending,
accepted,
ready,
pickedUp,
delivered,
score,
label: pressureLabel(active, pending, ready),
};
}, [orders]);

const priorityOrders = useMemo(() => {
const weight: Record<string, number> = {
pending: 1,
accepted: 2,
ready: 3,
picked_up: 4,
delivered: 9,
};

return [...orders]
.filter((o) => o.status !== "delivered" && o.status !== "cancelled")
.sort((a, b) => (weight[String(a.status)] || 8) - (weight[String(b.status)] || 8))
.slice(0, 5);
}, [orders]);

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.content}
refreshControl={
<RefreshControl refreshing={refreshing} onRefresh={() => {
setRefreshing(true);
load();
}} />
}
>
<View style={styles.hero}>
<Text style={styles.brand}>DELISHAFRICA® · MASTER CONTROL</Text>
<Text style={styles.kicker}>KITCHEN PULSE · LIVE</Text>
<Text style={styles.title}>Le rythme cuisine devient un signal exploitable.</Text>
<Text style={styles.subtitle}>
File active, pression de service et priorités cuisine sans action risquée.
</Text>
</View>

<View style={styles.pulseCard}>
<View style={styles.pulseTop}>
<View>
<Text style={styles.pulseLabel}>Pression service</Text>
<Text style={styles.pulseTitle}>{stats.label}</Text>
</View>
<View style={styles.scoreBadge}>
<Text style={styles.scoreNumber}>{stats.score}</Text>
<Text style={styles.scoreText}>pulse</Text>
</View>
</View>

<View style={styles.barTrack}>
<View style={[styles.barFill, { width: `${Math.max(8, stats.score)}%` }]} />
</View>

<Text style={styles.pulseHint}>
Lecture cuisine basée sur les commandes existantes. Aucun statut n’est modifié ici.
</Text>
</View>

<View style={styles.statsGrid}>
<View style={styles.statCard}>
<Text style={styles.statNumber}>{stats.pending}</Text>
<Text style={styles.statLabel}>À accepter</Text>
</View>
<View style={styles.statCard}>
<Text style={styles.statNumber}>{stats.accepted}</Text>
<Text style={styles.statLabel}>En cuisine</Text>
</View>
<View style={styles.statCard}>
<Text style={styles.statNumber}>{stats.ready}</Text>
<Text style={styles.statLabel}>Prêtes</Text>
</View>
<View style={styles.statCard}>
<Text style={styles.statNumber}>{stats.active}</Text>
<Text style={styles.statLabel}>Actives</Text>
</View>
</View>

<View style={styles.actions}>
<Pressable style={styles.primaryButton} onPress={() => router.push("/orders")}>
<Text style={styles.primaryButtonText}>Ouvrir les commandes</Text>
</Pressable>
<Pressable style={styles.secondaryButton} onPress={() => router.push("/kitchen-oracle")}>
<Text style={styles.secondaryButtonText}>Voir Kitchen Oracle</Text>
</Pressable>
</View>

<View style={styles.queueCard}>
<View style={styles.sectionHeader}>
<View>
<Text style={styles.sectionKicker}>Priorités cuisine</Text>
<Text style={styles.sectionTitle}>
{priorityOrders.length ? `${priorityOrders.length} commande(s) à surveiller` : "Aucune pression immédiate"}
</Text>
</View>
{loading ? <ActivityIndicator color="#F7B267" /> : null}
</View>

{error ? (
<View style={styles.notice}>
<Text style={styles.noticeTitle}>Lecture indisponible</Text>
<Text style={styles.noticeText}>{error}</Text>
</View>
) : null}

{!loading && !priorityOrders.length && !error ? (
<View style={styles.notice}>
<Text style={styles.noticeTitle}>Cuisine sous contrôle</Text>
<Text style={styles.noticeText}>
Aucune commande active prioritaire pour le moment.
</Text>
</View>
) : null}

{priorityOrders.map((order) => (
<View key={orderId(order)} style={styles.orderRow}>
<View style={styles.orderMain}>
<Text style={styles.orderId}>{orderId(order)}</Text>
<Text style={styles.orderItems}>{itemSummary(order)}</Text>
<Text style={styles.orderMeta}>
{order.restaurantName || order.merchantName || "Restaurant partenaire"} · {money(order.total ?? order.amount)}
</Text>
</View>
<View style={styles.statusBadge}>
<Text style={styles.statusText}>{statusLabel(order.status)}</Text>
</View>
</View>
))}
</View>

<Pressable style={styles.refreshButton} onPress={load}>
<Text style={styles.refreshButtonText}>Rafraîchir le pulse</Text>
</Pressable>

<Text style={styles.footer}>
Kitchen Pulse · pression, priorité, cadence · aucune action automatique.
</Text>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(120, 245, 255, 0.018)", borderWidth: 1, borderColor: "rgba(214, 255, 248, 0.046)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(225, 255, 248, 0.040)" },
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(120, 245, 255, 0.020)", borderWidth: 1, borderColor: "rgba(230, 255, 250, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 246, 230, 0.014)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.038)" },
safe: {
flex: 1,
backgroundColor: "#170B06",
},
content: {
padding: 18,
paddingTop: 28,
paddingBottom: 40,
},
hero: {
borderRadius: 30,
padding: 22,
backgroundColor: "#2A1308",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.22)",
marginBottom: 16,
},
brand: {
color: "#F7B267",
fontSize: 12,
fontWeight: "900",
letterSpacing: 2.2,
marginBottom: 14,
},
kicker: {
color: "rgba(255,248,239,0.64)",
fontSize: 11,
fontWeight: "900",
letterSpacing: 2.4,
marginBottom: 8,
},
title: {
color: "#FFF8EF",
fontSize: 31,
lineHeight: 36,
fontWeight: "900",
marginBottom: 12,
},
subtitle: {
color: "rgba(255,248,239,0.74)",
fontSize: 15,
lineHeight: 22,
fontWeight: "700",
},
pulseCard: {
borderRadius: 28,
padding: 20,
backgroundColor: "#32180D",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.22)",
marginBottom: 14,
},
pulseTop: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
gap: 14,
marginBottom: 14,
},
pulseLabel: {
color: "rgba(255,248,239,0.56)",
fontSize: 12,
fontWeight: "900",
letterSpacing: 1.2,
marginBottom: 6,
textTransform: "uppercase",
},
pulseTitle: {
color: "#FFF8EF",
fontSize: 24,
fontWeight: "900",
},
scoreBadge: {
minWidth: 74,
borderRadius: 22,
paddingVertical: 10,
paddingHorizontal: 12,
backgroundColor: "rgba(247,178,103,0.16)",
alignItems: "center",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.28)",
},
scoreNumber: {
color: "#F7B267",
fontSize: 24,
fontWeight: "900",
},
scoreText: {
color: "rgba(255,248,239,0.62)",
fontSize: 10,
fontWeight: "900",
letterSpacing: 1.4,
textTransform: "uppercase",
},
barTrack: {
height: 9,
borderRadius: 99,
overflow: "hidden",
backgroundColor: "rgba(255,248,239,0.10)",
marginBottom: 12,
},
barFill: {
height: "100%",
borderRadius: 99,
backgroundColor: "#F7B267",
},
pulseHint: {
color: "rgba(255,248,239,0.58)",
fontSize: 12,
lineHeight: 18,
fontWeight: "700",
},
statsGrid: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
marginBottom: 14,
},
statCard: {
width: "48%",
borderRadius: 22,
padding: 16,
backgroundColor: "rgba(255,248,239,0.07)",
borderWidth: 1,
borderColor: "rgba(255,248,239,0.10)",
},
statNumber: {
color: "#FFF8EF",
fontSize: 26,
fontWeight: "900",
marginBottom: 4,
},
statLabel: {
color: "rgba(255,248,239,0.62)",
fontSize: 12,
fontWeight: "800",
},
actions: {
gap: 10,
marginBottom: 14,
},
primaryButton: {
borderRadius: 22,
paddingVertical: 16,
paddingHorizontal: 18,
alignItems: "center",
backgroundColor: "#F7B267",
},
primaryButtonText: {
color: "#1A0B05",
fontSize: 15,
fontWeight: "900",
},
secondaryButton: {
borderRadius: 22,
paddingVertical: 15,
paddingHorizontal: 18,
alignItems: "center",
backgroundColor: "rgba(255,248,239,0.08)",
borderWidth: 1,
borderColor: "rgba(255,248,239,0.12)",
},
secondaryButtonText: {
color: "#FFF8EF",
fontSize: 14,
fontWeight: "900",
},
queueCard: {
borderRadius: 28,
padding: 18,
backgroundColor: "#241007",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.16)",
},
sectionHeader: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
gap: 12,
marginBottom: 14,
},
sectionKicker: {
color: "#F7B267",
fontSize: 11,
fontWeight: "900",
letterSpacing: 2,
textTransform: "uppercase",
marginBottom: 6,
},
sectionTitle: {
color: "#FFF8EF",
fontSize: 20,
fontWeight: "900",
},
notice: {
borderRadius: 20,
padding: 16,
backgroundColor: "rgba(255,248,239,0.06)",
borderWidth: 1,
borderColor: "rgba(255,248,239,0.10)",
},
noticeTitle: {
color: "#FFF8EF",
fontSize: 15,
fontWeight: "900",
marginBottom: 6,
},
noticeText: {
color: "rgba(255,248,239,0.62)",
fontSize: 13,
lineHeight: 19,
fontWeight: "700",
},
orderRow: {
borderRadius: 20,
padding: 14,
backgroundColor: "rgba(255,248,239,0.06)",
borderWidth: 1,
borderColor: "rgba(255,248,239,0.10)",
marginBottom: 10,
flexDirection: "row",
alignItems: "center",
gap: 12,
},
orderMain: {
flex: 1,
},
orderId: {
color: "#FFF8EF",
fontSize: 15,
fontWeight: "900",
marginBottom: 4,
},
orderItems: {
color: "rgba(255,248,239,0.76)",
fontSize: 13,
lineHeight: 18,
fontWeight: "800",
marginBottom: 4,
},
orderMeta: {
color: "rgba(255,248,239,0.50)",
fontSize: 12,
fontWeight: "700",
},
statusBadge: {
borderRadius: 99,
paddingVertical: 8,
paddingHorizontal: 10,
backgroundColor: "rgba(247,178,103,0.14)",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.22)",
},
statusText: {
color: "#F7B267",
fontSize: 11,
fontWeight: "900",
},
refreshButton: {
marginTop: 14,
borderRadius: 22,
paddingVertical: 15,
alignItems: "center",
backgroundColor: "rgba(247,178,103,0.10)",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.18)",
},
refreshButtonText: {
color: "#F7B267",
fontSize: 14,
fontWeight: "900",
},
footer: {
color: "rgba(255,248,239,0.42)",
fontSize: 11,
lineHeight: 16,
textAlign: "center",
fontWeight: "700",
marginTop: 18,
},
});
