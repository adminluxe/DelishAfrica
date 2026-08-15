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

type OrderStatus =
| "pending"
| "accepted"
| "ready"
| "picked_up"
| "delivered"
| "cancelled"
| string;

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
payment?: {
provider?: string;
mode?: string;
status?: string;
paymentIntentId?: string;
paidAt?: string;
};
};

const RAW_API =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me/api/v1";

function normalizeApiBase(value: string): string {
const clean = String(value || "").replace(/\/+$/, "");
if (clean.endsWith("/api/v1")) return clean;
if (clean === "https://api.delishafrica.me") return `${clean}/api/v1`;
return clean;
}

const API_BASE_URL = normalizeApiBase(RAW_API);

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

function restaurantName(order: DemoOrder): string {
return order.restaurantName || order.merchantName || "Thieyp";
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

function timeLabel(value?: string): string {
if (!value) return "—";
const d = new Date(value);
if (Number.isNaN(d.getTime())) return "—";
return d.toLocaleTimeString("fr-BE", {
hour: "2-digit",
minute: "2-digit",
});
}

function statusLabel(status: string): string {
if (status === "pending") return "À accepter";
if (status === "accepted") return "En cuisine";
if (status === "ready") return "Prête";
if (status === "picked_up") return "En route";
if (status === "delivered") return "Livrée";
if (status === "cancelled") return "Annulée";
return status;
}

function statusSeverity(status: string): "watch" | "ok" | "done" | "neutral" {
if (status === "pending") return "watch";
if (status === "accepted") return "watch";
if (status === "ready") return "ok";
if (status === "picked_up") return "ok";
if (status === "delivered") return "done";
return "neutral";
}

async function postJson(path: string, body: Record<string, unknown> = {}) {
const res = await daOrdersFetch(`${API_BASE_URL}${path}`, {
method: "POST",
headers: {
"Content-Type": "application/json",
Accept: "application/json",
},
body: JSON.stringify(body),
});

const text = await res.text();
let json: any = null;

try {
json = text ? JSON.parse(text) : null;
} catch {
throw new Error(`Réponse non JSON (${res.status}): ${text.slice(0, 240)}`);
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

export default function OpsDashboardLiteScreen() {
const [orders, setOrders] = useState<DemoOrder[]>([]);
const [refreshing, setRefreshing] = useState(false);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState("Chargement supervision...");
const [selectedStatus, setSelectedStatus] = useState<string>("all");

const load = useCallback(async () => {
setRefreshing(true);
try {
const payload = await postJson("/orders/demo/list", {});
const list = extractOrders(payload);
setOrders(list);
setMessage(`${list.length} commande(s) synchronisée(s).`);
} catch (error: any) {
setMessage(`Erreur supervision : ${error?.message || String(error)}`);
} finally {
setRefreshing(false);
setLoading(false);
}
}, []);

useEffect(() => {
load();
}, [load]);

const stats = useMemo(() => {
const pending = orders.filter((o) => statusOf(o) === "pending");
const accepted = orders.filter((o) => statusOf(o) === "accepted");
const ready = orders.filter((o) => statusOf(o) === "ready");
const picked = orders.filter((o) => statusOf(o) === "picked_up");
const delivered = orders.filter((o) => statusOf(o) === "delivered");
const active = pending.length + accepted.length + ready.length + picked.length;
const paid = orders.filter((o) => String(o.payment?.status || "").toLowerCase() === "paid");

return {
total: orders.length,
active,
paid: paid.length,
pending: pending.length,
accepted: accepted.length,
ready: ready.length,
picked: picked.length,
delivered: delivered.length,
attention: pending.length + ready.length,
};
}, [orders]);

const filteredOrders = useMemo(() => {
const sorted = [...orders].sort((a, b) => {
const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
return tb - ta;
});

if (selectedStatus === "all") return sorted;
if (selectedStatus === "active") {
return sorted.filter((o) =>
["pending", "accepted", "ready", "picked_up"].includes(statusOf(o))
);
}
return sorted.filter((o) => statusOf(o) === selectedStatus);
}, [orders, selectedStatus]);

const blockerText = useMemo(() => {
if (stats.pending > 0) {
return `${stats.pending} commande(s) attendent une acceptation restaurant.`;
}
if (stats.ready > 0) {
return `${stats.ready} commande prête attend le coursier.`;
}
if (stats.picked > 0) {
return `${stats.picked} mission(s) sont en route.`;
}
return "Aucun blocage opérationnel visible.";
}, [stats.pending, stats.ready, stats.picked]);

function FilterButton({
id,
label,
count,
}: {
id: string;
label: string;
count: number;
}) {
const active = selectedStatus === id;
return (
<Pressable
style={[styles.filterButton, active && styles.filterButtonActive]}
onPress={() => setSelectedStatus(id)}
>
<Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{label}</Text>
<Text style={[styles.filterCount, active && styles.filterLabelActive]}>{count}</Text>
</Pressable>
);
}

function Metric({
label,
value,
tone = "default",
}: {
label: string;
value: number;
tone?: "default" | "watch" | "ok" | "done";
}) {
return (
<View style={[styles.metric, styles[`metric_${tone}` as keyof typeof styles]]}>
<Text style={styles.metricValue}>{value}</Text>
<Text style={styles.metricLabel}>{label}</Text>
</View>
);
}

function OrderRow({ order }: { order: DemoOrder }) {
const st = statusOf(order);
const severity = statusSeverity(st);

return (
<View style={styles.orderRow}>
<View style={styles.orderTop}>
<View style={{ flex: 1 }}>
<Text style={styles.orderId}>{orderId(order)}</Text>
<Text style={styles.orderMeta}>
{restaurantName(order)} → {customerName(order)}
</Text>
</View>

<View style={[styles.statusPill, styles[`status_${severity}` as keyof typeof styles]]}>
<Text style={styles.statusText}>{statusLabel(st)}</Text>
</View>
</View>

<View style={styles.orderGrid}>
<View style={styles.infoBox}>
<Text style={styles.infoKicker}>Panier</Text>
<Text style={styles.infoValue}>{firstItem(order)}</Text>
</View>
<View style={styles.infoBox}>
<Text style={styles.infoKicker}>Total</Text>
<Text style={styles.infoValue}>{amountLabel(order)}</Text>
</View>
</View>

<View style={styles.orderGrid}>
<View style={styles.infoBox}>
<Text style={styles.infoKicker}>Créée</Text>
<Text style={styles.infoValue}>{timeLabel(order.createdAt)}</Text>
</View>
<View style={styles.infoBox}>
<Text style={styles.infoKicker}>Mise à jour</Text>
<Text style={styles.infoValue}>{timeLabel(order.updatedAt)}</Text>
</View>
</View>

{order.deliveryAddress ? (
<Text style={styles.address}>📍 {order.deliveryAddress}</Text>
) : null}
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
<View style={styles.header}>
<Text style={styles.brand}>DELISHAFRICA® · OPS</Text>
<Text style={styles.title}>Pilotage live</Text>
<Text style={styles.subtitle}>
Commandes, blocages et mouvements de service.
</Text>
</View>

<View style={styles.hero}>
<View style={styles.heroTop}>
<Text style={styles.heroKicker}>PILOTAGE SERVICE</Text>
<Text style={styles.live}>LIVE</Text>
</View>

<Text style={styles.heroTitle}>
{stats.active > 0 ? `${stats.active} opérations en cours` : "Service calme"}
</Text>
<Text style={styles.heroText}>{blockerText}</Text>

<View style={styles.metrics}>
<Metric label="Total" value={stats.total} />
<Metric label="Actif" value={stats.active} tone="watch" />
<Metric label="Payé" value={stats.paid} tone="ok" />
</View>

<View style={styles.metrics}>
<Metric label="News" value={stats.pending} tone="watch" />
<Metric label="Prêt" value={stats.ready} tone="ok" />
<Metric label="Livré" value={stats.delivered} tone="done" />
</View>
</View>

<Pressable style={styles.refreshButton} onPress={load}>
{refreshing || loading ? (
<ActivityIndicator />
) : (
<Text style={styles.refreshText}>Rafraîchir la supervision</Text>
)}
</Pressable>

<Text style={styles.message}>{message}</Text>

<View style={styles.filters}>
<FilterButton id="all" label="Tout" count={stats.total} />
<FilterButton id="active" label="Actif" count={stats.active} />
<FilterButton id="pending" label="News" count={stats.pending} />
<FilterButton id="ready" label="Prêt" count={stats.ready} />
<FilterButton id="picked_up" label="Route" count={stats.picked} />
<FilterButton id="delivered" label="Livré" count={stats.delivered} />
</View>

<View style={styles.sectionHead}>
<Text style={styles.sectionTitle}>Flux commandes</Text>
<Text style={styles.sectionSubtitle}>
{filteredOrders.length} résultats dans le filtre actif.
</Text>
</View>

{filteredOrders.length ? (
filteredOrders.map((order) => <OrderRow key={orderId(order)} order={order} />)
) : (
<View style={styles.emptyCard}>
<Text style={styles.emptyEmoji}>🧭</Text>
<Text style={styles.emptyTitle}>Aucune commande ici</Text>
<Text style={styles.emptyText}>
Change de filtre ou crée une commande depuis l’app Client.
</Text>
</View>
)}

<View style={styles.debtCard}>
<Text style={styles.debtKicker}>Qualité de service</Text>
<Text style={styles.debtText}>
Commandes, informations partenaire et passation coursier restent lisibles pendant le service.
</Text>
</View>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/orders" as any)}>
<Text style={styles.secondaryButtonText}>Retour cockpit cuisine</Text>
</Pressable>

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
safe: { flex: 1, backgroundColor: "#070A12" },
page: { padding: 18, paddingBottom: 84 },
header: { marginBottom: 22 },
brand: {
color: "#8AB9FF",
fontSize: 20,
fontWeight: "900",
letterSpacing: 7,
marginBottom: 10,
},
title: {
color: "#FFFFFF",
fontSize: 38,
lineHeight: 48,
fontWeight: "900",
},
subtitle: {
color: "#B8C2D6",
fontSize: 17,
lineHeight: 26,
marginTop: 12,
fontWeight: "600",
},
hero: {
backgroundColor: "#111A2C",
borderColor: "rgba(138,185,255,0.34)",
borderWidth: 1,
borderRadius: 34,
padding: 22,
marginBottom: 18,
},
heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
heroKicker: {
color: "#8AB9FF",
fontSize: 14,
fontWeight: "900",
letterSpacing: 1.2,
},
live: {
color: "#8AB9FF",
borderColor: "rgba(138,185,255,0.55)",
borderWidth: 1,
borderRadius: 999,
paddingHorizontal: 15,
paddingVertical: 8,
fontSize: 13,
fontWeight: "900",
letterSpacing: 1.2,
},
heroTitle: {
color: "#FFFFFF",
fontSize: 32,
lineHeight: 38,
fontWeight: "900",
marginTop: 24,
},
heroText: {
color: "#C8D1E4",
fontSize: 17,
lineHeight: 26,
fontWeight: "700",
marginTop: 10,
},
metrics: {
flexDirection: "row",
gap: 10,
marginTop: 16,
},
metric: {
flex: 1,
backgroundColor: "rgba(255,255,255,0.06)",
borderColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderRadius: 20,
padding: 14,
},
metric_default: {},
metric_watch: { borderColor: "rgba(255,200,110,0.30)" },
metric_ok: { borderColor: "rgba(112,255,168,0.28)" },
metric_done: { opacity: 0.82 },
metricValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
metricLabel: {
color: "#AEB9CE",
fontSize: 12,
lineHeight: 16,
marginTop: 6,
fontWeight: "900",
textTransform: "uppercase",
 flexShrink: 1,
letterSpacing: 1.8,
},
refreshButton: {
borderColor: "#8AB9FF",
borderWidth: 2,
borderRadius: 22,
paddingVertical: 18,
alignItems: "center",
marginBottom: 14,
},
refreshText: {
color: "#FFFFFF",
fontSize: 18,
fontWeight: "900",
},
message: {
color: "#8AB9FF",
fontSize: 14,
lineHeight: 20,
fontWeight: "800",
marginBottom: 16,
},
filters: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
marginBottom: 24,
},
filterButton: {
backgroundColor: "#111A2C",
borderColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderRadius: 18,
paddingHorizontal: 14,
paddingVertical: 12,
minWidth: 96,
},
filterButtonActive: {
backgroundColor: "#8AB9FF",
borderColor: "#8AB9FF",
},
filterLabel: {
color: "#B8C2D6",
fontSize: 12,
fontWeight: "900",
letterSpacing: 1.8,
textTransform: "uppercase",
 flexShrink: 1,
},
filterCount: {
color: "#FFFFFF",
fontSize: 24,
fontWeight: "900",
marginTop: 4,
},
filterLabelActive: {
color: "#07101E",
},
sectionHead: {
marginTop: 2,
marginBottom: 14,
},
sectionTitle: {
color: "#FFFFFF",
fontSize: 32,
fontWeight: "900",
},
sectionSubtitle: {
color: "#9AA5BA",
fontSize: 16,
fontWeight: "700",
marginTop: 5,
},
orderRow: {
backgroundColor: "#111A2C",
borderColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderRadius: 26,
padding: 18,
marginBottom: 14,
},
orderTop: {
flexDirection: "row",
gap: 12,
justifyContent: "space-between",
alignItems: "flex-start",
},
orderId: {
color: "#FFFFFF",
fontSize: 27,
lineHeight: 33,
fontWeight: "900",
},
orderMeta: {
color: "#B8C2D6",
fontSize: 16,
lineHeight: 23,
fontWeight: "800",
marginTop: 6,
},
statusPill: {
borderRadius: 999,
paddingHorizontal: 13,
paddingVertical: 9,
},
status_watch: {
backgroundColor: "#3B2811",
},
status_ok: {
backgroundColor: "#0A3A21",
},
status_done: {
backgroundColor: "#1E293D",
},
status_neutral: {
backgroundColor: "#1C2434",
},
statusText: {
color: "#FFFFFF",
fontSize: 13,
fontWeight: "900",
},
orderGrid: {
flexDirection: "row",
gap: 10,
marginTop: 14,
},
infoBox: {
flex: 1,
backgroundColor: "rgba(255,255,255,0.05)",
borderRadius: 18,
padding: 14,
},
infoKicker: {
color: "#8AB9FF",
fontSize: 12,
fontWeight: "900",
letterSpacing: 1.2,
textTransform: "uppercase",
 flexShrink: 1,
marginBottom: 8,
},
infoValue: {
color: "#FFFFFF",
fontSize: 16,
lineHeight: 22,
fontWeight: "800",
},
address: {
color: "#AEB9CE",
fontSize: 15,
lineHeight: 23,
fontWeight: "700",
marginTop: 14,
},
emptyCard: {
backgroundColor: "#111A2C",
borderColor: "rgba(255,255,255,0.10)",
borderWidth: 1,
borderRadius: 26,
padding: 26,
alignItems: "center",
marginBottom: 18,
},
emptyEmoji: {
fontSize: 30,
marginBottom: 10,
},
emptyTitle: {
color: "#FFFFFF",
fontSize: 26,
fontWeight: "900",
textAlign: "center",
},
emptyText: {
color: "#AEB9CE",
fontSize: 16,
lineHeight: 24,
textAlign: "center",
marginTop: 10,
fontWeight: "700",
},
debtCard: {
backgroundColor: "#211A12",
borderColor: "rgba(255,200,110,0.26)",
borderWidth: 1,
borderRadius: 24,
padding: 18,
marginTop: 8,
marginBottom: 16,
},
debtKicker: {
color: "#FFC86E",
fontSize: 13,
fontWeight: "900",
letterSpacing: 1.2,
marginBottom: 10,
},
debtText: {
color: "#E4D1B2",
fontSize: 15,
lineHeight: 23,
fontWeight: "700",
},
secondaryButton: {
backgroundColor: "#111A2C",
borderColor: "rgba(255,255,255,0.14)",
borderWidth: 1,
borderRadius: 22,
paddingVertical: 18,
alignItems: "center",
marginBottom: 14,
},
secondaryButtonText: {
color: "#FFFFFF",
fontSize: 18,
fontWeight: "900",
},
backButton: {
alignItems: "center",
paddingVertical: 20,
},
backText: {
color: "#8AB9FF",
fontSize: 18,
fontWeight: "900",
},
});
