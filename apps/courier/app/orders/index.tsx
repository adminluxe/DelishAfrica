import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
Alert,
Pressable,
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { router } from "expo-router";

type OrderStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | string;

type DemoOrder = {
id?: string;
orderId?: string;
status?: OrderStatus;
customerName?: string;
clientName?: string;
customer?: {
name?: string;
address?: string;
city?: string;
phone?: string;
instructions?: string;
};
restaurantName?: string;
merchantName?: string;
items?: any[];
total?: number;
amount?: number;
deliveryAddress?: string;
deliveryInstructions?: string;
};

const RAW_API =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me/api/v1";

function apiBase(value: string): string {
const clean = String(value || "").replace(/\/+$/, "");
if (clean.endsWith("/api/v1")) return clean;
if (clean === "https://api.delishafrica.me") return `${clean}/api/v1`;
return clean;
}

const API_BASE_URL = apiBase(RAW_API);

function orderId(order: DemoOrder): string {
return String(order.orderId || order.id || "DA-MISSION");
}

function statusOf(order: DemoOrder): string {
return String(order.status || "ready").toLowerCase();
}

function customerName(order: DemoOrder): string {
return order.customer?.name || order.customerName || order.clientName || "Client DelishAfrica®";
}

function restaurantName(order: DemoOrder): string {
return order.restaurantName || order.merchantName || "Thieyp";
}

function addressOf(order: DemoOrder): string {
return order.deliveryAddress || order.customer?.address || "Adresse de livraison à compléter";
}

function firstItem(order: DemoOrder): string {
const item = Array.isArray(order.items) ? order.items[0] : null;
if (!item) return "1× Thieboudienne royal";
const qty = item.quantity || item.qty || 1;
const name = item.name || item.title || "Plat signature";
return `${qty}× ${name}`;
}

async function postJson(path: string, body: Record<string, unknown> = {}) {
const res = await fetch(`${API_BASE_URL}${path}`, {
method: "POST",
headers: { "Content-Type": "application/json", Accept: "application/json" },
body: JSON.stringify(body),
});

const text = await res.text();
let json: any = null;

try {
json = text ? JSON.parse(text) : null;
} catch {
throw new Error(`Réponse non JSON (${res.status}): ${text.slice(0, 220)}`);
}

if (!res.ok) {
throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
}

return json;
}

function extractOrders(payload: any): DemoOrder[] {
if (Array.isArray(payload)) return payload;
if (Array.isArray(payload?.orders)) return payload.orders;
if (Array.isArray(payload?.data)) return payload.data;
if (Array.isArray(payload?.items)) return payload.items;
if (payload?.order) return [payload.order];
return [];
}

export default function CourierOrdersPremiumV1() {
const [orders, setOrders] = useState<DemoOrder[]>([]);
const [refreshing, setRefreshing] = useState(false);
const [busyId, setBusyId] = useState<string | null>(null);
const [message, setMessage] = useState("Terrain prêt.");

const load = useCallback(async () => {
setRefreshing(true);
try {
const payload = await postJson("/orders/demo/list", {});
const list = extractOrders(payload);
setOrders(list);
setMessage(`${list.length} mission(s) synchronisée(s).`);
} catch (error: any) {
setMessage(`Erreur sync : ${error?.message || String(error)}`);
} finally {
setRefreshing(false);
}
}, []);

useEffect(() => {
load();
}, [load]);

const buckets = useMemo(() => {
const ready = orders.filter((o) => statusOf(o) === "ready");
const picked = orders.filter((o) => statusOf(o) === "picked_up");
const upcoming = orders.filter((o) => ["pending", "accepted"].includes(statusOf(o)));
const history = orders.filter((o) => statusOf(o) === "delivered");
return { ready, picked, upcoming, history };
}, [orders]);

const priority = buckets.ready[0] || buckets.picked[0] || null;

async function updateStatus(order: DemoOrder, status: "picked_up" | "delivered") {
const id = orderId(order);
setBusyId(id);
setMessage(status === "picked_up" ? "Récupération au restaurant..." : "Confirmation livraison...");
try {
await postJson("/orders/demo/status", { orderId: id, id, status });
await load();
setMessage(status === "picked_up" ? "Mission récupérée." : "Livraison confirmée.");
} catch (error: any) {
Alert.alert("Action impossible", error?.message || String(error));
setMessage(`Erreur : ${error?.message || String(error)}`);
} finally {
setBusyId(null);
}
}

function actionFor(order: DemoOrder) {
const st = statusOf(order);
if (st === "ready") return { label: "Récupérer", next: "picked_up" as const };
if (st === "picked_up") return { label: "Livrer", next: "delivered" as const };
return null;
}

function MissionCard({ order, priorityCard = false }: { order: DemoOrder; priorityCard?: boolean }) {
const id = orderId(order);
const st = statusOf(order);
const action = actionFor(order);
const busy = busyId === id;

return (
<View style={[styles.missionCard, priorityCard && styles.priorityCard]}>
<View style={styles.missionTop}>
<View style={{ flex: 1 }}>
<Text style={priorityCard ? styles.priorityKicker : styles.missionKicker}>
{priorityCard ? "MISSION PRIORITAIRE" : st === "delivered" ? "HISTORIQUE" : "MISSION"}
</Text>
<Text style={priorityCard ? styles.priorityId : styles.missionId}>{id}</Text>
</View>
<View style={styles.statusPill}>
<Text style={styles.statusText}>
{st === "ready"
? "À récupérer"
: st === "picked_up"
? "En route"
: st === "delivered"
? "Livrée"
: "À venir"}
</Text>
</View>
</View>

<Text style={priorityCard ? styles.priorityRestaurant : styles.restaurant}>
{restaurantName(order)}
</Text>
<Text style={styles.client}>Client : {customerName(order)}</Text>
<Text style={styles.address}>📍 {addressOf(order)}</Text>

{priorityCard ? (
<View style={styles.stepBox}>
<Text style={styles.stepKicker}>{st === "picked_up" ? "ÉTAPE 2" : "ÉTAPE 1"}</Text>
<Text style={styles.stepTitle}>
{st === "picked_up" ? "Le client t’attend." : "Le restaurant t’attend."}
</Text>
</View>
) : null}

<Text style={styles.item}>{firstItem(order)}</Text>

{action ? (
<Pressable
disabled={busy}
style={[styles.actionButton, busy && styles.disabledButton]}
onPress={() => updateStatus(order, action.next)}
>
{busy ? <ActivityIndicator /> : <Text style={styles.actionText}>{action.label}</Text>}
</Pressable>
) : null}
</View>
);
}

function Section({
title,
subtitle,
count,
children,
}: {
title: string;
subtitle: string;
count: number;
children: React.ReactNode;
}) {
return (
<View style={styles.section}>
<View style={styles.sectionHead}>
<View>
<Text style={styles.sectionTitle}>{title}</Text>
<Text style={styles.sectionSubtitle}>{subtitle}</Text>
</View>
<View style={styles.countBubble}>
<Text style={styles.countText}>{count}</Text>
</View>
</View>
{children}
</View>
);
}

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.page}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
>
<View style={styles.hero}>
<View style={styles.heroTop}>
<Text style={styles.brand}>DELISHAFRICA®</Text>
<Text style={styles.live}>TERRAIN</Text>
</View>
<Text style={styles.title}>Mission Cockpit</Text>
<Text style={styles.subtitle}>
Une mission claire, un geste rapide, une livraison maîtrisée.
</Text>

<View style={styles.stats}>
<View style={styles.statBox}>
<Text style={styles.statValue}>{buckets.ready.length}</Text>
<Text style={styles.statLabel}>À récupérer</Text>
</View>
<View style={styles.statBox}>
<Text style={styles.statValue}>{buckets.picked.length}</Text>
<Text style={styles.statLabel}>En route</Text>
</View>
<View style={styles.statBox}>
<Text style={styles.statValue}>{buckets.history.length}</Text>
<Text style={styles.statLabel}>Terminées</Text>
</View>
</View>
</View>

<Text style={styles.sync}>{message}</Text>

{priority ? (
<MissionCard order={priority} priorityCard />
) : (
<View style={styles.emptyHero}>
<Text style={styles.emptyEmoji}>🛵</Text>
<Text style={styles.emptyTitle}>Aucune mission active</Text>
<Text style={styles.emptyText}>
Reste prêt. Les commandes marquées prêtes par les restaurants apparaîtront ici.
</Text>
</View>
)}

<Section title="Missions prêtes" subtitle="À récupérer au restaurant" count={buckets.ready.length}>
{buckets.ready.length > 1 ? (
buckets.ready.slice(1).map((order) => <MissionCard key={orderId(order)} order={order} />)
) : buckets.ready.length === 1 && priority === buckets.ready[0] ? (
<Text style={styles.empty}>Mission prioritaire affichée ci-dessus.</Text>
) : (
<Text style={styles.empty}>Aucune autre mission prête.</Text>
)}
</Section>

<Section title="En route" subtitle="Missions déjà récupérées" count={buckets.picked.length}>
{buckets.picked.length && priority !== buckets.picked[0] ? (
buckets.picked.map((order) => <MissionCard key={orderId(order)} order={order} />)
) : buckets.picked.length === 1 && priority === buckets.picked[0] ? (
<Text style={styles.empty}>Mission prioritaire affichée ci-dessus.</Text>
) : (
<Text style={styles.empty}>Aucune autre mission en route.</Text>
)}
</Section>

<Section title="À venir" subtitle="Encore en préparation côté restaurant" count={buckets.upcoming.length}>
{buckets.upcoming.length ? (
buckets.upcoming.map((order) => <MissionCard key={orderId(order)} order={order} />)
) : (
<Text style={styles.empty}>Aucune mission en attente.</Text>
)}
</Section>

<Section title="Historique" subtitle="Livraisons terminées" count={buckets.history.length}>
{buckets.history.length ? (
buckets.history.map((order) => <MissionCard key={orderId(order)} order={order} />)
) : (
<Text style={styles.empty}>Aucune livraison terminée récemment.</Text>
)}
</Section>

<Pressable style={styles.backButton} onPress={() => router.replace("/")}>
<Text style={styles.backText}>Retour terrain</Text>
</Pressable>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(220, 255, 240, 0.052)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(212, 255, 236, 0.014)", borderWidth: 1, borderColor: "rgba(224, 255, 241, 0.040)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(200, 255, 232, 0.052)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 255, 238, 0.042)" },
safe: { flex: 1, backgroundColor: "#00160D" },
page: { padding: 18, paddingBottom: 84 },
hero: {
backgroundColor: "#062B18",
borderColor: "rgba(89,232,145,0.34)",
borderWidth: 1,
borderRadius: 34,
padding: 24,
marginBottom: 18,
},
heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
brand: { color: "#A5F7BD", fontSize: 18, fontWeight: "900", letterSpacing: 6 },
live: {
color: "#A5F7BD",
borderColor: "rgba(89,232,145,0.55)",
borderWidth: 1,
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 8,
fontSize: 14,
fontWeight: "900",
letterSpacing: 3,
},
title: { color: "#F4FFF7", fontSize: 38, lineHeight: 44, fontWeight: "900", marginTop: 18 },
subtitle: { color: "#BDD3C5", fontSize: 16, lineHeight: 24, fontWeight: "600", marginTop: 10 },
stats: { flexDirection: "row", gap: 10, marginTop: 20 },
statBox: {
flex: 1,
backgroundColor: "rgba(255,255,255,0.07)",
borderColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderRadius: 20,
padding: 15,
},
statValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
statLabel: { color: "#A8BDAF", fontSize: 13, marginTop: 6, fontWeight: "700" },
sync: { color: "#A5F7BD", fontSize: 14, lineHeight: 20, fontWeight: "800", marginBottom: 18 },
priorityCard: { backgroundColor: "#F0FFF4" },
missionCard: {
backgroundColor: "#10261A",
borderColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderRadius: 28,
padding: 20,
marginBottom: 14,
},
missionTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
priorityKicker: { color: "#748278", fontSize: 14, fontWeight: "900", letterSpacing: 4 },
missionKicker: { color: "#94D9A9", fontSize: 13, fontWeight: "900", letterSpacing: 4 },
priorityId: { color: "#00160D", fontSize: 32, fontWeight: "900", marginTop: 8 },
missionId: { color: "#F4FFF7", fontSize: 28, fontWeight: "900", marginTop: 8 },
statusPill: {
backgroundColor: "#07351E",
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 10,
},
statusText: { color: "#B9FFD0", fontSize: 15, fontWeight: "900" },
priorityRestaurant: { color: "#00160D", fontSize: 24, fontWeight: "900", marginTop: 26 },
restaurant: { color: "#F4FFF7", fontSize: 22, fontWeight: "900", marginTop: 18 },
client: { color: "#6B7E72", fontSize: 18, lineHeight: 26, fontWeight: "900", marginTop: 6 },
address: { color: "#596D61", fontSize: 17, lineHeight: 26, fontWeight: "800", marginTop: 12 },
stepBox: {
backgroundColor: "rgba(0,22,13,0.08)",
borderColor: "rgba(0,22,13,0.12)",
borderWidth: 1,
borderRadius: 22,
padding: 18,
marginTop: 20,
},
stepKicker: { color: "#00160D", fontSize: 14, fontWeight: "900", letterSpacing: 3 },
stepTitle: { color: "#00160D", fontSize: 24, fontWeight: "900", marginTop: 8 },
item: { color: "#6B7E72", fontSize: 18, fontWeight: "900", marginTop: 20 },
actionButton: { backgroundColor: "#11964E", borderRadius: 20, paddingVertical: 15, alignItems: "center", marginTop: 22 },
disabledButton: { opacity: 0.55 },
actionText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
section: { marginTop: 20 },
sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
sectionTitle: { color: "#F4FFF7", fontSize: 32, fontWeight: "900" },
sectionSubtitle: { color: "#87998D", fontSize: 17, marginTop: 4, fontWeight: "700" },
countBubble: {
width: 48,
height: 48,
borderRadius: 24,
backgroundColor: "#07351E",
borderColor: "rgba(89,232,145,0.45)",
borderWidth: 1,
alignItems: "center",
justifyContent: "center",
},
countText: { color: "#B9FFD0", fontSize: 18, fontWeight: "900" },
emptyHero: {
backgroundColor: "#10261A",
borderColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderRadius: 28,
padding: 26,
alignItems: "center",
marginBottom: 18,
},
emptyEmoji: { fontSize: 34, marginBottom: 10 },
emptyTitle: { color: "#F4FFF7", fontSize: 28, fontWeight: "900", textAlign: "center" },
emptyText: { color: "#9DAFA3", fontSize: 18, lineHeight: 28, textAlign: "center", marginTop: 10 },
empty: { color: "#87998D", fontSize: 17, lineHeight: 26, fontWeight: "700", marginBottom: 8 },
backButton: { alignItems: "center", paddingVertical: 24 },
backText: { color: "#A5F7BD", fontSize: 17, fontWeight: "900" },
});
