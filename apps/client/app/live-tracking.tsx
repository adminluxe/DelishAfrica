import { daOrdersFetch } from "../utils/daOrdersApi";
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

import { MotionHero } from "../components/motion/MotionHero";
import { MotionScene } from "../components/motion/MotionScene";
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
if (s === "ready") return `Un coursier peut récupérer chez ${restaurantOf(order)}.`;
if (s === "picked_up") return "Le coursier est en route vers vous.";
if (s === "delivered") return "Commande terminée.";
return "Suivi en cours.";
}

async function loadOrders() {
const res = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
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

  // DA_V3C11H2_FINAL_FOCUS_POLISH_V1B
  const [showDeliverySteps, setShowDeliverySteps] = useState(false);
  const [showRecentOrders, setShowRecentOrders] = useState(false);

  // DA_V3C11H4_ZERO_SCROLL_PREMIUM
  const [showOrderDetails, setShowOrderDetails] = useState(false);

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
{/* DA_P2C2_MOTION_SCENE_ENGINE_RUNTIME_V2_V1 */}
<MotionScene />
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

<View style={styles.compactSyncCard}>
<View style={styles.compactSyncTopRow}>
<View style={styles.compactSyncIdentity}>
<View style={styles.compactSyncDot} />
<View style={{ flex: 1 }}>
<Text style={styles.compactSyncTitle}>Service synchronisé</Text>
<Text style={styles.compactSyncSubtitle}>DelishAfrica® sécurisé</Text>
</View>
</View>

<TouchableOpacity
activeOpacity={0.82}
style={styles.compactRefreshButton}
onPress={refresh}
>
{refreshing && !loading ? (
<ActivityIndicator size="small" />
) : (
<Text style={styles.compactRefreshText}>
{loading ? "Lecture…" : "Actualiser"}
</Text>
)}
</TouchableOpacity>
</View>

<Text style={styles.compactMetricsText}>
{orders.length} commandes · {activeCount} active{activeCount > 1 ? "s" : ""} · {deliveredCount} livrée{deliveredCount > 1 ? "s" : ""}
</Text>
</View>



{error ? (
<View style={styles.errorCard}>
<Text style={styles.errorTitle}>Suivi momentanément indisponible</Text>
<Text style={styles.errorText}>{error}</Text>
</View>
) : null}

{selectedOrder ? (
<>
<View style={styles.compactOrderCard}>
<View style={styles.rowBetween}>
<View style={{ flex: 1, paddingRight: 12 }}>
<Text style={styles.cardKicker}>Commande active</Text>
<Text style={styles.compactOrderTitle}>{primaryItem(selectedOrder)}</Text>
<Text style={styles.compactOrderId}>{publicIdOf(selectedOrder)}</Text>
</View>
<Text style={styles.statusPill}>{statusLabel(selectedOrder)}</Text>
</View>

<View style={styles.compactRestaurantRow}>
<Text style={styles.compactRestaurantLabel}>Restaurant</Text>
<Text style={styles.compactRestaurantValue}>{restaurantOf(selectedOrder)}</Text>
</View>

<TouchableOpacity
activeOpacity={0.84}
style={styles.compactDetailsToggle}
onPress={() => setShowOrderDetails((value) => !value)}
>
<Text style={styles.compactDetailsToggleText}>
{showOrderDetails ? "Masquer les détails" : "Voir les détails"}
</Text>
<Text style={styles.compactDetailsArrow}>{showOrderDetails ? "↑" : "↓"}</Text>
</TouchableOpacity>

{showOrderDetails ? (
<View style={styles.compactDetailsPanel}>
<View style={styles.compactDetailRow}>
<Text style={styles.compactDetailLabel}>Client</Text>
<Text style={styles.compactDetailValue}>{clientOf(selectedOrder)}</Text>
</View>
<View style={styles.compactDetailRow}>
<Text style={styles.compactDetailLabel}>Adresse</Text>
<Text style={styles.compactDetailValue}>{addressOf(selectedOrder)}</Text>
</View>
<View style={styles.compactDetailRow}>
<Text style={styles.compactDetailLabel}>Total</Text>
<Text style={styles.compactDetailValue}>{amountOf(selectedOrder)}</Text>
</View>
</View>
) : null}
</View>

<View style={styles.compactStatusStrip}>
<View style={styles.compactStatusDot} />
<Text style={styles.compactStatusText}>{etaDetail(selectedOrder)}</Text>
</View>

<View style={styles.timelineCard}>
<Text style={styles.blockTitle}>Parcours de livraison</Text>
              {/* DA_V3C11H_LIVE_HERO */}
              {isActive(selectedOrder) ? (
                <MotionHero
                  eta={etaFor(selectedOrder)}
                  status={String(selectedOrder?.status || "")}
                  onPress={() => {
                    const id = publicIdOf(selectedOrder);
                    router.push({
                      pathname: "/maps-live-lab",
                      params: { orderId: id, publicId: id },
                    } as never);
                  }}
                />
              ) : null}

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.secondaryButton}
                onPress={() => setShowDeliverySteps((value) => !value)}
              >
                <Text style={styles.secondaryButtonText}>
                  {showDeliverySteps ? "Masquer les étapes" : "Voir les étapes de livraison"}
                </Text>
              </TouchableOpacity>

              {showDeliverySteps ? <ProgressRail order={selectedOrder} /> : null}
</View>
</>
) : (
<View style={styles.emptyCard}>
<Text style={styles.emptyTitle}>Aucune commande à suivre</Text>
<Text style={styles.emptyText}>Vos prochaines commandes DelishAfrica apparaîtront ici.</Text>
</View>
)}

{/* DA_V3C11H6_RECENT_ORDERS_COMPACT */}
<View style={styles.recentCardCompact}>
          <Text style={styles.recentTitleCompact}>Commandes récentes ({orders.length})</Text>
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.recentButtonCompact}
            onPress={() => setShowRecentOrders((value) => !value)}
          >
            <Text style={styles.recentButtonCompactText}>
              {showRecentOrders ? "Masquer les commandes récentes" : "Voir mes commandes récentes"}
            </Text>
          </TouchableOpacity>

          {showRecentOrders ? (
            <>
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
            </>
          ) : null}
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
// DA_V3C11H4_ZERO_SCROLL_PREMIUM_STYLES
compactSyncCard: {
backgroundColor: "rgba(255,255,255,0.92)",
borderRadius: 18,
paddingHorizontal: 16,
paddingVertical: 12,
marginBottom: 10,
borderWidth: 1,
borderColor: "rgba(17,73,55,0.10)",
},
compactSyncTopRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 10,
},
compactSyncIdentity: {
flex: 1,
flexDirection: "row",
alignItems: "center",
gap: 10,
},
compactSyncDot: {
width: 9,
height: 9,
borderRadius: 999,
backgroundColor: "#2FCF83",
},
compactSyncTitle: {
fontSize: 15,
fontWeight: "800",
color: "#123D31",
},
compactSyncSubtitle: {
fontSize: 11,
fontWeight: "600",
color: "#6D7F78",
marginTop: 1,
},
compactMetricsText: {
fontSize: 12,
fontWeight: "700",
color: "#556B63",
marginTop: 8,
},
compactRefreshButton: {
minHeight: 34,
paddingHorizontal: 12,
borderRadius: 12,
alignItems: "center",
justifyContent: "center",
backgroundColor: "#EEF5F1",
},
compactRefreshText: {
fontSize: 12,
fontWeight: "800",
color: "#165A46",
},
compactOrderCard: {
backgroundColor: "#FFFFFF",
borderRadius: 22,
padding: 16,
marginBottom: 10,
borderWidth: 1,
borderColor: "rgba(17,73,55,0.10)",
shadowColor: "#09261D",
shadowOpacity: 0.06,
shadowRadius: 12,
shadowOffset: { width: 0, height: 6 },
elevation: 2,
},
compactOrderTitle: {
fontSize: 23,
lineHeight: 28,
fontWeight: "900",
color: "#163B31",
marginTop: 5,
},
compactOrderId: {
fontSize: 12,
fontWeight: "700",
color: "#7B8B85",
marginTop: 2,
},
compactRestaurantRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginTop: 12,
paddingTop: 10,
borderTopWidth: 1,
borderTopColor: "rgba(17,73,55,0.08)",
gap: 16,
},
compactRestaurantLabel: {
fontSize: 11,
fontWeight: "800",
textTransform: "uppercase",
letterSpacing: 0.8,
color: "#87968F",
},
compactRestaurantValue: {
flex: 1,
fontSize: 14,
fontWeight: "800",
color: "#183E33",
textAlign: "right",
},
compactDetailsToggle: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginTop: 10,
paddingVertical: 8,
},
compactDetailsToggleText: {
fontSize: 13,
fontWeight: "800",
color: "#176247",
},
compactDetailsArrow: {
fontSize: 15,
fontWeight: "900",
color: "#176247",
},
compactDetailsPanel: {
marginTop: 4,
paddingTop: 10,
borderTopWidth: 1,
borderTopColor: "rgba(17,73,55,0.08)",
gap: 9,
},
compactDetailRow: {
flexDirection: "row",
alignItems: "flex-start",
justifyContent: "space-between",
gap: 16,
},
compactDetailLabel: {
fontSize: 11,
fontWeight: "800",
textTransform: "uppercase",
letterSpacing: 0.6,
color: "#8A9892",
},
compactDetailValue: {
flex: 1,
fontSize: 13,
fontWeight: "700",
color: "#334F46",
textAlign: "right",
},
compactStatusStrip: {
flexDirection: "row",
alignItems: "center",
gap: 9,
backgroundColor: "rgba(255,255,255,0.82)",
borderRadius: 16,
paddingHorizontal: 14,
paddingVertical: 10,
marginBottom: 10,
borderWidth: 1,
borderColor: "rgba(17,73,55,0.08)",
},
compactStatusDot: {
width: 8,
height: 8,
borderRadius: 999,
backgroundColor: "#F1A12E",
},
compactStatusText: {
flex: 1,
fontSize: 13,
lineHeight: 18,
fontWeight: "700",
color: "#4B625A",
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
// DA_V3C11H6_RECENT_ORDERS_COMPACT_STYLES
recentCardCompact: {
  borderRadius: 24,
  paddingHorizontal: 16,
  paddingVertical: 14,
  backgroundColor: "#101D33",
  borderWidth: 1,
  borderColor: "rgba(125,180,255,0.24)",
},
recentTitleCompact: {
  color: "#FFFFFF",
  fontSize: 22,
  lineHeight: 27,
  fontWeight: "900",
  marginBottom: 10,
},
recentButtonCompact: {
  minHeight: 50,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(255,255,255,0.06)",
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
  paddingHorizontal: 16,
},
recentButtonCompactText: {
  color: "#FFFFFF",
  fontSize: 16,
  lineHeight: 20,
  fontWeight: "900",
  textAlign: "center",
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

  liveHeroCard: {
    marginTop: 18,
    marginBottom: 22,
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#D6A84F",
    backgroundColor: "#071A18",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  liveHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  liveHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(47, 213, 137, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(47, 213, 137, 0.42)",
  },
  liveHeroDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#2FD589",
  },
  liveHeroBadgeText: {
    color: "#7FF0B9",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  liveHeroEta: {
    color: "#F7C66A",
    fontSize: 18,
    fontWeight: "900",
  },
  liveHeroTitle: {
    marginTop: 20,
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  liveHeroSubtitle: {
    marginTop: 10,
    color: "#C9D7D4",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },
  liveHeroButton: {
    marginTop: 20,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#F7C66A",
    borderWidth: 1,
    borderColor: "#FFE0A2",
  },
  liveHeroButtonText: {
    color: "#071A18",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
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
