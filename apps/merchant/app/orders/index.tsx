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
phone?: string;
email?: string;
address?: string;
city?: string;
instructions?: string;
};
restaurantName?: string;
merchantName?: string;
items?: any[];
total?: number;
amount?: number;
currency?: string;
createdAt?: string;
updatedAt?: string;
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
return String(order.orderId || order.id || "DA-ORDER");
}

function statusOf(order: DemoOrder): string {
return String(order.status || "pending").toLowerCase();
}

function customerName(order: DemoOrder): string {
return (
order.customer?.name ||
order.customerName ||
order.clientName ||
"Client DelishAfrica"
);
}

function amountLabel(order: DemoOrder): string {
const raw = Number(order.total ?? order.amount ?? 0);
const euros = raw > 100 ? raw / 100 : raw;
return `${euros.toFixed(2).replace(".", ",")} €`;
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

export default function MerchantOrdersPremiumV1() {
const [orders, setOrders] = useState<DemoOrder[]>([]);
const [refreshing, setRefreshing] = useState(false);
const [busyId, setBusyId] = useState<string | null>(null);
const [message, setMessage] = useState("Cockpit cuisine prêt.");

const load = useCallback(async () => {
setRefreshing(true);
try {
const payload = await postJson("/orders/demo/list", {});
const list = extractOrders(payload);
setOrders(list);
setMessage(`${list.length} commande(s) à jour.`);
} catch (error: any) {
setMessage(`Erreur de synchronisation : ${error?.message || String(error)}`);
} finally {
setRefreshing(false);
}
}, []);

useEffect(() => {
load();
}, [load]);

const buckets = useMemo(() => {
const pending = orders.filter((o) => statusOf(o) === "pending");
const accepted = orders.filter((o) => statusOf(o) === "accepted");
const ready = orders.filter((o) => statusOf(o) === "ready");
const history = orders.filter((o) =>
["picked_up", "delivered", "cancelled", "done"].includes(statusOf(o))
);

return {
pending,
accepted,
ready,
history,
activeCount: pending.length + accepted.length + ready.length,
};
}, [orders]);

async function updateStatus(order: DemoOrder, status: "accepted" | "ready") {
const id = orderId(order);
setBusyId(id);
setMessage(status === "accepted" ? "Acceptation en cours..." : "Passage en prête...");
try {
await postJson("/orders/demo/status", { orderId: id, id, status });
await load();
setMessage(status === "accepted" ? "Commande acceptée." : "Commande prête pour le coursier.");
} catch (error: any) {
Alert.alert("Action impossible", error?.message || String(error));
setMessage(`Erreur : ${error?.message || String(error)}`);
} finally {
setBusyId(null);
}
}

function OrderCard({
order,
action,
label,
tone,
}: {
order: DemoOrder;
action?: () => void;
label: string;
tone: "pending" | "accepted" | "ready" | "history";
}) {
const id = orderId(order);
const busy = busyId === id;
const pillToneStyle =
 tone === "pending" ? styles.pill_pending :
 tone === "accepted" ? styles.pill_accepted :
 tone === "ready" ? styles.pill_ready :
 styles.pill_history;

return (
<View style={[styles.orderCard, tone === "history" && styles.historyCard]}>
<View style={styles.orderTop}>
<View style={styles.orderTitleWrap}>
<Text style={styles.orderId}>{id}</Text>
<Text style={styles.customer}>{customerName(order)}</Text>
</View>
<View style={[styles.statusPill, pillToneStyle]}>
<Text style={styles.statusPillKicker}>{label}</Text>
<Text style={styles.statusPillText}>
{tone === "pending"
? "À accepter"
: tone === "accepted"
? "Cuisine"
: tone === "ready"
? "Prête"
: "Livrée"}
</Text>
</View>
</View>

<Text style={styles.item}>{firstItem(order)}</Text>
<Text style={styles.meta}>Thieyp · {amountLabel(order)}</Text>

{order.deliveryAddress ? (
<Text style={styles.address}>📍 {order.deliveryAddress}</Text>
) : null}

{action ? (
<Pressable
style={[styles.actionButton, busy && styles.disabledButton]}
disabled={busy}
onPress={action}
>
{busy ? <ActivityIndicator /> : <Text style={styles.actionText}>
{tone === "pending" ? "Accepter la commande" : "Marquer prête"}
</Text>}
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
<Text style={styles.brand}>DELISHAFRICA</Text>
<Text style={styles.live}>LIVE</Text>
</View>
<Text style={styles.title}>Cockpit cuisine</Text>
<Text style={styles.subtitle}>
Accepter, préparer, remettre au coursier. Chaque étape reste claire pour la brigade.
</Text>

<View style={styles.stats}>
<View style={styles.statBox}>
<Text style={styles.statValue}>{buckets.activeCount}</Text>
<Text style={styles.statLabel}>Actives</Text>
</View>
<View style={styles.statBox}>
<Text style={styles.statValue}>{buckets.pending.length}</Text>
<Text style={styles.statLabel}>Nouvelles</Text>
</View>
<View style={styles.statBox}>
<Text style={styles.statValue}>{buckets.ready.length}</Text>
<Text style={styles.statLabel}>Prêtes</Text>
</View>
</View>
</View>

<Text style={styles.sync}>{message}</Text>

<Section title="À accepter" subtitle="Nouvelles commandes à confirmer" count={buckets.pending.length}>
{buckets.pending.length ? (
buckets.pending.map((order) => (
<OrderCard
key={orderId(order)}
order={order}
label="Nouveau"
tone="pending"
action={() => updateStatus(order, "accepted")}
/>
))
) : (
<Text style={styles.empty}>Aucune nouvelle commande.</Text>
)}
</Section>

<Section title="En préparation" subtitle="Commandes validées par la cuisine" count={buckets.accepted.length}>
{buckets.accepted.length ? (
buckets.accepted.map((order) => (
<OrderCard
key={orderId(order)}
order={order}
label="En cuisine"
tone="accepted"
action={() => updateStatus(order, "ready")}
/>
))
) : (
<Text style={styles.empty}>Aucune commande en préparation.</Text>
)}
</Section>

<Section title="Prêtes" subtitle="En attente du coursier" count={buckets.ready.length}>
{buckets.ready.length ? (
buckets.ready.map((order) => (
<OrderCard
key={orderId(order)}
order={order}
label="Prêt coursier"
tone="ready"
/>
))
) : (
<Text style={styles.empty}>Aucune commande prête.</Text>
)}
</Section>

<Section title="Historique" subtitle="Commandes parties ou clôturées" count={buckets.history.length}>
{buckets.history.length ? (
buckets.history.map((order) => (
<OrderCard
key={orderId(order)}
order={order}
label="Terminé"
tone="history"
/>
))
) : (
<Text style={styles.empty}>Aucun historique récent.</Text>
)}
</Section>

<Pressable style={styles.backButton} onPress={() => router.replace("/")}>
<Text style={styles.backText}>Retour espace partenaire</Text>
</Pressable>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(120, 245, 255, 0.020)", borderWidth: 1, borderColor: "rgba(230, 255, 250, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 246, 230, 0.014)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.038)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(120, 245, 255, 0.018)", borderWidth: 1, borderColor: "rgba(214, 255, 248, 0.046)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(225, 255, 248, 0.040)" },
safe: { flex: 1, backgroundColor: "#130906" },
page: { padding: 18, paddingBottom: 84 },
hero: {
backgroundColor: "#32140D",
borderColor: "rgba(255,143,55,0.42)",
borderWidth: 1,
borderRadius: 34,
padding: 24,
marginBottom: 18,
},
heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
brand: { color: "#FFC173", fontSize: 18, fontWeight: "900", letterSpacing: 6 },
live: {
color: "#FFC173",
borderColor: "rgba(255,143,55,0.65)",
borderWidth: 1,
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 8,
fontSize: 14,
fontWeight: "900",
letterSpacing: 3,
},
title: { color: "#FFF9F1", fontSize: 38, lineHeight: 44, fontWeight: "900", marginTop: 18 },
subtitle: { color: "#D9C7BA", fontSize: 16, lineHeight: 24, fontWeight: "600", marginTop: 10 },
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
statLabel: { color: "#CBB8AC", fontSize: 14, marginTop: 6, fontWeight: "700" },
sync: { color: "#FFC173", fontSize: 14, lineHeight: 20, fontWeight: "800", marginBottom: 18 },
section: { marginTop: 18 },
sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
sectionTitle: { color: "#FFF9F1", fontSize: 32, fontWeight: "900" },
sectionSubtitle: { color: "#A79891", fontSize: 17, marginTop: 4, fontWeight: "700" },
countBubble: {
width: 48,
height: 48,
borderRadius: 24,
backgroundColor: "#3A2A17",
borderColor: "rgba(255,193,115,0.45)",
borderWidth: 1,
alignItems: "center",
justifyContent: "center",
},
countText: { color: "#FFD08A", fontSize: 18, fontWeight: "900" },
orderCard: {
backgroundColor: "#FFF7ED",
borderRadius: 28,
padding: 20,
marginBottom: 14,
},
historyCard: { opacity: 0.76 },
orderTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
orderTitleWrap: { flex: 1 },
orderId: { color: "#2A0D07", fontSize: 28, fontWeight: "900" },
customer: { color: "#8B766D", fontSize: 17, fontWeight: "900", marginTop: 4 },
statusPill: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, alignItems: "flex-end" },
pill_pending: { backgroundColor: "#3A120B" },
pill_accepted: { backgroundColor: "#7B3B18" },
pill_ready: { backgroundColor: "#3B2711" },
pill_history: { backgroundColor: "#2C110A" },
statusPillKicker: { color: "#FFD08A", fontSize: 12, fontWeight: "900", letterSpacing: 3, textTransform: "uppercase" },
statusPillText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 3 },
item: { color: "#2A0D07", fontSize: 20, fontWeight: "900", marginTop: 20 },
meta: { color: "#8B766D", fontSize: 18, fontWeight: "900", marginTop: 12 },
address: { color: "#5E4B43", fontSize: 15, lineHeight: 22, fontWeight: "800", marginTop: 12 },
actionButton: { backgroundColor: "#DF6B30", borderRadius: 20, paddingVertical: 15, alignItems: "center", marginTop: 22 },
disabledButton: { opacity: 0.55 },
actionText: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
empty: { color: "#8E7B72", fontSize: 17, lineHeight: 26, fontWeight: "700", marginBottom: 8 },
backButton: { alignItems: "center", paddingVertical: 24 },
backText: { color: "#FFC173", fontSize: 17, fontWeight: "900" },
});
