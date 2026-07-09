import React, { useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
TouchableOpacity,
View,
} from "react-native";
import { router } from "expo-router";

type OrderStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | string;

type DemoOrder = {
id?: string;
orderId?: string;
publicId?: string;
status?: OrderStatus;
restaurantName?: string;
merchantName?: string;
restaurant?: string;
customerName?: string;
client?: string;
deliveryAddress?: string;
customerAddress?: string;
amount?: number;
total?: number;
currency?: string;
createdAt?: string;
updatedAt?: string;
items?: Array<{
name?: string;
title?: string;
quantity?: number;
qty?: number;
amount?: number;
price?: number;
}>;
timeline?: Array<{
status?: string;
label?: string;
note?: string;
at?: string;
changedAt?: string;
}>;
};

const RAW_API =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me";

const API_BASE_URL = normalizeApiBase(RAW_API);

const STEPS = [
{
key: "pending",
label: "Commande envoyée",
detail: "Le restaurant reçoit votre commande.",
},
{
key: "accepted",
label: "En cuisine",
detail: "La préparation commence.",
},
{
key: "ready",
label: "Prête",
detail: "Le coursier peut récupérer.",
},
{
key: "picked_up",
label: "Coursier en route",
detail: "Votre commande arrive.",
},
{
key: "delivered",
label: "Livrée",
detail: "Bon appétit.",
},
];

function normalizeApiBase(raw: string) {
const clean = String(raw || "").trim().replace(/\/+$/, "");
if (!clean) return "https://api.delishafrica.me/api/v1";
if (clean.endsWith("/api/v1")) return clean;
if (clean.endsWith("/api")) return `${clean}/v1`;
return `${clean}/api/v1`;
}

function normalizeOrders(payload: any): DemoOrder[] {
if (Array.isArray(payload)) return payload;
if (Array.isArray(payload?.orders)) return payload.orders;
if (Array.isArray(payload?.items)) return payload.items;
if (Array.isArray(payload?.data)) return payload.data;
if (Array.isArray(payload?.result)) return payload.result;
return [];
}

function statusOf(order?: DemoOrder) {
return String(order?.status || "pending").toLowerCase();
}

function isActive(order?: DemoOrder) {
const s = statusOf(order);
return !!order && !["delivered", "completed", "cancelled", "canceled"].includes(s);
}

function statusIndex(status: string) {
const s = String(status || "pending").toLowerCase();
const index = STEPS.findIndex((step) => step.key === s);
return index < 0 ? 0 : index;
}

function statusLabel(order?: DemoOrder) {
const s = statusOf(order);
if (s === "pending") return "Envoyée";
if (s === "accepted") return "En cuisine";
if (s === "ready") return "Prête";
if (s === "picked_up") return "En route";
if (s === "delivered") return "Livrée";
return "Suivi";
}

function publicIdOf(order?: DemoOrder) {
return String(order?.publicId || order?.orderId || order?.id || "DA-LIVE");
}

function compactId(id: string) {
if (id.length <= 18) return id;
return `${id.slice(0, 10)}…${id.slice(-6)}`;
}

function restaurantOf(order?: DemoOrder) {
return String(order?.restaurantName || order?.merchantName || order?.restaurant || "Thieyp");
}

function clientOf(order?: DemoOrder) {
return String(order?.customerName || order?.client || "Client DelishAfrica®");
}

function addressOf(order?: DemoOrder) {
return String(order?.deliveryAddress || order?.customerAddress || "Adresse de livraison synchronisée");
}

function primaryItem(order?: DemoOrder) {
const item = Array.isArray(order?.items) ? order?.items?.[0] : undefined;
return String(item?.name || item?.title || "Commande DelishAfrica®");
}

function amountOf(order?: DemoOrder) {
const raw = typeof order?.total === "number" ? order.total : typeof order?.amount === "number" ? order.amount : 0;
if (!raw) return "—";
const euros = raw > 100 ? raw / 100 : raw;
return `${euros.toFixed(2).replace(".", ",")} €`;
}

function sortByFreshness(a: DemoOrder, b: DemoOrder) {
const ad = Date.parse(String(a.updatedAt || a.createdAt || ""));
const bd = Date.parse(String(b.updatedAt || b.createdAt || ""));
if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad;
if (Number.isFinite(bd)) return 1;
if (Number.isFinite(ad)) return -1;
return 0;
}

function pickBestOrder(orders: DemoOrder[]) {
const active = orders.filter(isActive).sort((a, b) => {
const ap = priority(statusOf(a));
const bp = priority(statusOf(b));
if (ap !== bp) return ap - bp;
return sortByFreshness(a, b);
});

if (active[0]) return active[0];

return orders.slice().sort(sortByFreshness)[0];
}

function priority(status: string) {
if (status === "picked_up") return 1;
if (status === "ready") return 2;
if (status === "accepted") return 3;
if (status === "pending") return 4;
if (status === "delivered") return 5;
return 99;
}

function etaFor(order?: DemoOrder) {
const s = statusOf(order);
if (s === "pending") return "35 min";
if (s === "accepted") return "28 min";
if (s === "ready") return "18 min";
if (s === "picked_up") return "12 min";
if (s === "delivered") return "Livrée";
return "—";
}

function etaDetail(order?: DemoOrder) {
const s = statusOf(order);
if (s === "pending") return "Le restaurant doit accepter.";
if (s === "accepted") return "La cuisine prépare votre commande.";
if (s === "ready") return "Un coursier peut récupérer chez Thieyp.";
if (s === "picked_up") return "Le coursier est en route vers vous.";
if (s === "delivered") return "Commande terminée.";
return "Suivi en cours.";
}

async function loadOrders() {
const res = await fetch(`${API_BASE_URL}/orders/demo/list`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({}),
});

const text = await res.text();
const payload = text ? JSON.parse(text) : null;

if (!res.ok) {
throw new Error(`Suivi indisponible (${res.status})`);
}

return normalizeOrders(payload);
}

function ProgressRail({ order }: { order?: DemoOrder }) {
const current = statusIndex(statusOf(order));

return (
<View style={styles.rail}>
{STEPS.map((step, index) => {
const done = index <= current;
const active = index === current;

return (
<View key={step.key} style={styles.railItem}>
<View style={[styles.dot, done ? styles.dotDone : styles.dotIdle]}>
<Text style={done ? styles.dotTextDone : styles.dotTextIdle}>{done ? "✓" : `${index + 1}`}</Text>
</View>
<View style={styles.railText}>
<Text style={[styles.railLabel, active && styles.railLabelActive]}>{step.label}</Text>
<Text style={styles.railDetail}>{step.detail}</Text>
</View>
</View>
);
})}
</View>
);
}

export default function ClientLiveTrackingScreen() {
const [orders, setOrders] = useState<DemoOrder[]>([]);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState<string | null>(null);

const selectedOrder = useMemo(() => {
if (selectedId) {
const found = orders.find((order) => publicIdOf(order) === selectedId || order.id === selectedId || order.orderId === selectedId);
if (found) return found;
}
return pickBestOrder(orders);
}, [orders, selectedId]);

const activeCount = orders.filter(isActive).length;
const deliveredCount = orders.filter((order) => statusOf(order) === "delivered").length;

async function refresh() {
setError(null);
setRefreshing(true);

try {
const next = await loadOrders();
setOrders(next);
if (!selectedId) {
const best = pickBestOrder(next);
if (best) setSelectedId(publicIdOf(best));
}
} catch (err) {
const message = err instanceof Error ? err.message : "Suivi momentanément indisponible.";
setError(message);
} finally {
setLoading(false);
setRefreshing(false);
}
}

useEffect(() => {
refresh();
}, []);

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.container}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
>
<View style={styles.header}>
<Text style={styles.kicker}>DELISHAFRICA® · CLIENT</Text>
<Text style={styles.title}>Suivi principal</Text>
<Text style={styles.subtitle}>
Votre commande, la cuisine et le coursier dans une lecture simple et rassurante.
</Text>
</View>

<View style={styles.syncCard}>
<Text style={styles.cardKicker}>Connexion sécurisée</Text>
<Text style={styles.syncTitle}>Service DelishAfrica® synchronisé</Text>

<View style={styles.metricsRow}>
<View style={styles.metric}>
<Text style={styles.metricValue}>{orders.length}</Text>
<Text style={styles.metricLabel}>commandes</Text>
</View>
<View style={styles.metric}>
<Text style={styles.metricValue}>{activeCount}</Text>
<Text style={styles.metricLabel}>actives</Text>
</View>
<View style={styles.metric}>
<Text style={styles.metricValue}>{deliveredCount}</Text>
<Text style={styles.metricLabel}>livrées</Text>
</View>
</View>
</View>

<TouchableOpacity activeOpacity={0.86} style={styles.refreshButton} onPress={refresh}>
{refreshing && !loading ? (
<ActivityIndicator />
) : (
<Text style={styles.refreshButtonText}>{loading ? "Lecture du suivi…" : "Actualiser le suivi"}</Text>
)}
</TouchableOpacity>

{error ? (
<View style={styles.errorCard}>
<Text style={styles.errorTitle}>Suivi momentanément indisponible</Text>
<Text style={styles.errorText}>{error}</Text>
</View>
) : null}

{selectedOrder ? (
<>
<View style={styles.heroCard}>
<View style={styles.rowBetween}>
<Text style={styles.cardKicker}>Votre commande</Text>
<Text style={styles.statusPill}>{statusLabel(selectedOrder)}</Text>
</View>

<Text style={styles.orderTitle}>{primaryItem(selectedOrder)}</Text>
<Text style={styles.orderId}>{publicIdOf(selectedOrder)}</Text>

<View style={styles.infoBlock}>
<Text style={styles.infoLabel}>Restaurant</Text>
<Text style={styles.infoText}>{restaurantOf(selectedOrder)}</Text>
</View>

<View style={styles.infoBlock}>
<Text style={styles.infoLabel}>Client</Text>
<Text style={styles.infoText}>{clientOf(selectedOrder)}</Text>
</View>

<View style={styles.infoBlock}>
<Text style={styles.infoLabel}>Adresse</Text>
<Text style={styles.infoText}>{addressOf(selectedOrder)}</Text>
</View>

<View style={styles.infoBlock}>
<Text style={styles.infoLabel}>Total</Text>
<Text style={styles.infoText}>{amountOf(selectedOrder)}</Text>
</View>
</View>

<View style={styles.etaCard}>
<Text style={styles.cardKicker}>Statut livraison</Text>
<Text style={styles.etaValue}>{etaFor(selectedOrder)}</Text>
<Text style={styles.etaText}>{etaDetail(selectedOrder)}</Text>
<Text style={styles.etaSmall}>Estimation sécurisée · aucun suivi en arrière-plan.</Text>
</View>

<View style={styles.timelineCard}>
<Text style={styles.blockTitle}>Parcours de livraison</Text>
<ProgressRail order={selectedOrder} />
</View>
</>
) : (
<View style={styles.emptyCard}>
<Text style={styles.emptyTitle}>Aucune commande à suivre</Text>
<Text style={styles.emptyText}>Vos prochaines commandes DelishAfrica apparaîtront ici.</Text>
</View>
)}

<View style={styles.recentCard}>
<Text style={styles.blockTitle}>Commandes récentes</Text>
<Text style={styles.blockSubtitle}>Touchez une commande pour afficher son suivi principal.</Text>

{orders.slice(0, 5).map((order) => {
const id = publicIdOf(order);
const selected = publicIdOf(selectedOrder) === id;

return (
<TouchableOpacity
key={id}
activeOpacity={0.85}
style={[styles.orderRow, selected && styles.orderRowActive]}
onPress={() => setSelectedId(id)}
>
<View style={{ flex: 1 }}>
<Text style={styles.orderRowId}>{compactId(id)}</Text>
<Text style={styles.orderRowStatus}>{statusLabel(order)} · {restaurantOf(order)}</Text>
</View>
<Text style={styles.orderRowArrow}>{selected ? "✓" : "→"}</Text>
</TouchableOpacity>
);
})}
</View>

<TouchableOpacity activeOpacity={0.86} style={styles.ghostButton} onPress={() => router.back()}>
<Text style={styles.ghostButtonText}>Retour</Text>
</TouchableOpacity>

<Text style={styles.footer}>
Suivi estimatif · paiement sécurisé inclus.
</Text>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(88, 211, 255, 0.020)", borderWidth: 1, borderColor: "rgba(200, 242, 255, 0.050)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 242, 255, 0.040)" },
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(98, 202, 255, 0.020)", borderWidth: 1, borderColor: "rgba(220, 245, 255, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(218, 246, 255, 0.038)" },
safe: {
flex: 1,
backgroundColor: "#07101E",
},
container: {
padding: 22,
paddingBottom: 44,
gap: 16,
},
header: {
paddingTop: 0,
gap: 10,
},
kicker: {
color: "#7DB4FF",
fontSize: 13,
fontWeight: "900",
letterSpacing: 4,
},
title: {
color: "#FFFFFF",
fontSize: 42,
lineHeight: 48,
fontWeight: "900",
},
subtitle: {
color: "#B9C8E3",
fontSize: 19,
lineHeight: 29,
fontWeight: "800",
},
syncCard: {
borderRadius: 30,
padding: 20,
backgroundColor: "#101D33",
borderWidth: 1,
borderColor: "rgba(125,180,255,0.26)",
gap: 14,
},
cardKicker: {
color: "#7DB4FF",
fontSize: 13,
fontWeight: "900",
letterSpacing: 5,
textTransform: "uppercase",
},
syncTitle: {
color: "#FFFFFF",
fontSize: 19,
lineHeight: 24,
fontWeight: "900",
},
metricsRow: {
flexDirection: "row",
gap: 10,
},
metric: {
flex: 1,
backgroundColor: "#172844",
borderRadius: 20,
padding: 14,
},
metricValue: {
color: "#FFFFFF",
fontSize: 33,
fontWeight: "900",
},
metricLabel: {
color: "#B9C8E3",
fontSize: 11,
fontWeight: "900",
letterSpacing: 0.4,
textTransform: "uppercase",
},
refreshButton: {
borderRadius: 24,
paddingVertical: 18,
alignItems: "center",
borderWidth: 2,
borderColor: "#7DB4FF",
},
refreshButtonText: {
color: "#FFFFFF",
fontSize: 18,
fontWeight: "900",
},
errorCard: {
borderRadius: 22,
padding: 16,
backgroundColor: "rgba(255,120,120,0.12)",
borderWidth: 1,
borderColor: "rgba(255,120,120,0.32)",
},
errorTitle: {
color: "#FFD6D6",
fontSize: 18,
fontWeight: "900",
},
errorText: {
color: "#FFD6D6",
fontSize: 14,
lineHeight: 20,
marginTop: 6,
fontWeight: "700",
},
heroCard: {
borderRadius: 30,
padding: 20,
backgroundColor: "#101D33",
borderWidth: 1,
borderColor: "rgba(125,180,255,0.26)",
gap: 14,
},
rowBetween: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
},
statusPill: {
color: "#D9E8FF",
borderRadius: 999,
overflow: "hidden",
paddingHorizontal: 14,
paddingVertical: 8,
backgroundColor: "rgba(125,180,255,0.20)",
borderWidth: 1,
borderColor: "rgba(125,180,255,0.50)",
fontWeight: "900",
},
orderTitle: {
color: "#FFFFFF",
fontSize: 30,
lineHeight: 36,
fontWeight: "900",
},
orderId: {
color: "#B9C8E3",
fontSize: 16,
fontWeight: "900",
},
infoBlock: {
backgroundColor: "#172844",
borderRadius: 18,
padding: 14,
gap: 5,
},
infoLabel: {
color: "#B9C8E3",
fontSize: 12,
fontWeight: "900",
letterSpacing: 1.7,
textTransform: "uppercase",
},
infoText: {
color: "#FFFFFF",
fontSize: 18,
lineHeight: 25,
fontWeight: "900",
},
etaCard: {
backgroundColor: "#EAF3FF",
borderRadius: 30,
padding: 22,
gap: 8,
},
etaValue: {
color: "#07101E",
fontSize: 52,
fontWeight: "900",
},
etaText: {
color: "#263C5E",
fontSize: 18,
lineHeight: 25,
fontWeight: "900",
},
etaSmall: {
color: "#526680",
fontSize: 13,
fontWeight: "800",
},
timelineCard: {
borderRadius: 30,
padding: 20,
backgroundColor: "#101D33",
borderWidth: 1,
borderColor: "rgba(125,180,255,0.24)",
},
blockTitle: {
color: "#FFFFFF",
fontSize: 26,
fontWeight: "900",
},
blockSubtitle: {
color: "#B9C8E3",
fontSize: 16,
lineHeight: 23,
fontWeight: "800",
marginTop: 6,
marginBottom: 12,
},
rail: {
marginTop: 16,
gap: 14,
},
railItem: {
flexDirection: "row",
gap: 14,
alignItems: "center",
},
dot: {
width: 42,
height: 42,
borderRadius: 999,
alignItems: "center",
justifyContent: "center",
},
dotDone: {
backgroundColor: "#34D780",
},
dotIdle: {
backgroundColor: "transparent",
borderWidth: 2,
borderColor: "rgba(185,200,227,0.26)",
},
dotTextDone: {
color: "#06111F",
fontSize: 18,
fontWeight: "900",
},
dotTextIdle: {
color: "#B9C8E3",
fontSize: 14,
fontWeight: "900",
},
railText: {
flex: 1,
backgroundColor: "#172844",
borderRadius: 18,
padding: 14,
},
railLabel: {
color: "#B9C8E3",
fontSize: 19,
fontWeight: "900",
},
railLabelActive: {
color: "#FFFFFF",
},
railDetail: {
color: "#B9C8E3",
fontSize: 14,
lineHeight: 20,
marginTop: 4,
fontWeight: "800",
},
emptyCard: {
borderRadius: 26,
padding: 20,
backgroundColor: "#101D33",
borderWidth: 1,
borderColor: "rgba(125,180,255,0.24)",
},
emptyTitle: {
color: "#FFFFFF",
fontSize: 24,
fontWeight: "900",
},
emptyText: {
color: "#B9C8E3",
fontSize: 16,
lineHeight: 24,
fontWeight: "800",
marginTop: 8,
},
recentCard: {
borderRadius: 30,
padding: 20,
backgroundColor: "#101D33",
borderWidth: 1,
borderColor: "rgba(125,180,255,0.24)",
},
orderRow: {
flexDirection: "row",
alignItems: "center",
backgroundColor: "#172844",
borderRadius: 20,
padding: 16,
marginTop: 12,
borderWidth: 1,
borderColor: "transparent",
},
orderRowActive: {
borderColor: "#7DB4FF",
backgroundColor: "#1A3155",
},
orderRowId: {
color: "#FFFFFF",
fontSize: 18,
fontWeight: "900",
},
orderRowStatus: {
color: "#B9C8E3",
fontSize: 14,
fontWeight: "800",
marginTop: 3,
},
orderRowArrow: {
color: "#7DB4FF",
fontSize: 28,
fontWeight: "900",
},
secondaryButton: {
backgroundColor: "rgba(255,255,255,0.06)",
borderRadius: 22,
paddingVertical: 16,
alignItems: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
secondaryButtonText: {
color: "#FFFFFF",
fontSize: 17,
fontWeight: "900",
},
ghostButton: {
paddingVertical: 12,
alignItems: "center",
},
ghostButtonText: {
color: "#7DB4FF",
fontSize: 17,
fontWeight: "900",
},
footer: {
color: "#7F91AE",
textAlign: "center",
fontSize: 13,
lineHeight: 20,
fontWeight: "800",
},
});
