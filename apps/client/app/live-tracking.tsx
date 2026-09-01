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
import { getDATheme } from "../ui/da/theme";

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

const UI = getDATheme("client");

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
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: UI.radius.pill, backgroundColor: "rgba(88, 211, 255, 0.020)", borderWidth: 1, borderColor: "rgba(200, 242, 255, 0.050)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: UI.radius.pill, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 242, 255, 0.040)" },
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: UI.radius.pill, backgroundColor: "rgba(98, 202, 255, 0.020)", borderWidth: 1, borderColor: "rgba(220, 245, 255, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: UI.radius.pill, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(218, 246, 255, 0.038)" },
safe: {
flex: 1,
backgroundColor: UI.colors.bg0,
},
container: {
padding: 22,
paddingBottom: 44,
gap: UI.space.x4,
},
header: {
paddingTop: 0,
gap: 10,
},
kicker: {
color: UI.colors.accent2,
fontSize: UI.type.cap,
fontWeight: "900",
letterSpacing: 4,
},
title: {
color: UI.colors.text,
fontSize: 42,
lineHeight: 48,
fontWeight: "900",
},
subtitle: {
color: UI.colors.text2,
fontSize: 19,
lineHeight: 29,
fontWeight: "800",
},
// DA_V3C11H4_ZERO_SCROLL_PREMIUM_STYLES
compactSyncCard: {
backgroundColor: UI.colors.surface0,
borderRadius: 18,
paddingHorizontal: UI.space.x4,
paddingVertical: UI.space.x3,
marginBottom: 10,
borderWidth: 1,
borderColor: UI.colors.border,
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
borderRadius: UI.radius.pill,
backgroundColor: UI.colors.success,
},
compactSyncTitle: {
fontSize: 15,
fontWeight: "800",
color: UI.colors.text,
},
compactSyncSubtitle: {
fontSize: 11,
fontWeight: "600",
color: UI.colors.muted,
marginTop: 1,
},
compactMetricsText: {
fontSize: 12,
fontWeight: "700",
color: UI.colors.muted,
marginTop: UI.space.x2,
},
compactRefreshButton: {
minHeight: 34,
paddingHorizontal: UI.space.x3,
borderRadius: UI.radius.sm,
alignItems: "center",
justifyContent: "center",
backgroundColor: UI.colors.surface1,
},
compactRefreshText: {
fontSize: 12,
fontWeight: "800",
color: UI.colors.accent2,
},
compactOrderCard: {
backgroundColor: UI.colors.surface0,
borderRadius: 22,
padding: UI.space.x4,
marginBottom: 10,
borderWidth: 1,
borderColor: UI.colors.border,
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
color: UI.colors.text,
marginTop: 5,
},
compactOrderId: {
fontSize: 12,
fontWeight: "700",
color: UI.colors.muted,
marginTop: 2,
},
compactRestaurantRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginTop: UI.space.x3,
paddingTop: 10,
borderTopWidth: 1,
borderTopColor: UI.colors.border,
gap: UI.space.x4,
},
compactRestaurantLabel: {
fontSize: 11,
fontWeight: "800",
textTransform: "uppercase",
letterSpacing: 0.8,
color: UI.colors.muted,
},
compactRestaurantValue: {
flex: 1,
fontSize: UI.type.bodySm,
fontWeight: "800",
color: UI.colors.text,
textAlign: "right",
},
compactDetailsToggle: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginTop: 10,
paddingVertical: UI.space.x2,
},
compactDetailsToggleText: {
fontSize: UI.type.cap,
fontWeight: "800",
color: UI.colors.accent2,
},
compactDetailsArrow: {
fontSize: 15,
fontWeight: "900",
color: UI.colors.accent2,
},
compactDetailsPanel: {
marginTop: UI.space.x1,
paddingTop: 10,
borderTopWidth: 1,
borderTopColor: UI.colors.border,
gap: 9,
},
compactDetailRow: {
flexDirection: "row",
alignItems: "flex-start",
justifyContent: "space-between",
gap: UI.space.x4,
},
compactDetailLabel: {
fontSize: 11,
fontWeight: "800",
textTransform: "uppercase",
letterSpacing: 0.6,
color: UI.colors.muted,
},
compactDetailValue: {
flex: 1,
fontSize: UI.type.cap,
fontWeight: "700",
color: UI.colors.text2,
textAlign: "right",
},
compactStatusStrip: {
flexDirection: "row",
alignItems: "center",
gap: 9,
backgroundColor: UI.colors.surface1,
borderRadius: UI.radius.md,
paddingHorizontal: 14,
paddingVertical: 10,
marginBottom: 10,
borderWidth: 1,
borderColor: UI.colors.border,
},
compactStatusDot: {
width: 8,
height: 8,
borderRadius: UI.radius.pill,
backgroundColor: UI.colors.warn,
},
compactStatusText: {
flex: 1,
fontSize: UI.type.cap,
lineHeight: 18,
fontWeight: "700",
color: UI.colors.text2,
},

syncCard: {
borderRadius: 30,
padding: UI.space.x5,
backgroundColor: UI.colors.surface0,
borderWidth: 1,
borderColor: UI.colors.border,
gap: 14,
},
cardKicker: {
color: UI.colors.accent2,
fontSize: UI.type.cap,
fontWeight: "900",
letterSpacing: 5,
textTransform: "uppercase",
},
syncTitle: {
color: UI.colors.text,
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
backgroundColor: UI.colors.surface1,
borderRadius: UI.radius.lg,
padding: 14,
},
metricValue: {
color: UI.colors.text,
fontSize: 33,
fontWeight: "900",
},
metricLabel: {
color: UI.colors.text2,
fontSize: 11,
fontWeight: "900",
letterSpacing: 0.4,
textTransform: "uppercase",
},
refreshButton: {
borderRadius: UI.radius.xl,
paddingVertical: 18,
alignItems: "center",
borderWidth: 2,
borderColor: UI.colors.accent2,
},
refreshButtonText: {
color: UI.colors.text,
fontSize: 18,
fontWeight: "900",
},
errorCard: {
borderRadius: 22,
padding: UI.space.x4,
backgroundColor: "rgba(255,120,120,0.12)",
borderWidth: 1,
borderColor: UI.colors.error,
},
errorTitle: {
color: UI.colors.error,
fontSize: 18,
fontWeight: "900",
},
errorText: {
color: UI.colors.error,
fontSize: UI.type.bodySm,
lineHeight: 20,
marginTop: 6,
fontWeight: "700",
},
heroCard: {
borderRadius: 30,
padding: UI.space.x5,
backgroundColor: UI.colors.surface0,
borderWidth: 1,
borderColor: UI.colors.border,
gap: 14,
},
rowBetween: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
gap: 10,
},
statusPill: {
color: UI.colors.text2,
borderRadius: UI.radius.pill,
overflow: "hidden",
paddingHorizontal: 14,
paddingVertical: UI.space.x2,
backgroundColor: UI.colors.surface1,
borderWidth: 1,
borderColor: UI.colors.border,
fontWeight: "900",
},
orderTitle: {
color: UI.colors.text,
fontSize: 30,
lineHeight: 36,
fontWeight: "900",
},
orderId: {
color: UI.colors.text2,
fontSize: UI.type.body,
fontWeight: "900",
},
infoBlock: {
backgroundColor: UI.colors.surface1,
borderRadius: 18,
padding: 14,
gap: 5,
},
infoLabel: {
color: UI.colors.text2,
fontSize: 12,
fontWeight: "900",
letterSpacing: 1.7,
textTransform: "uppercase",
},
infoText: {
color: UI.colors.text,
fontSize: 18,
lineHeight: 25,
fontWeight: "900",
},
etaCard: {
backgroundColor: UI.colors.surface1,
borderRadius: 30,
padding: 22,
gap: UI.space.x2,
},
etaValue: {
color: UI.colors.text,
fontSize: 52,
fontWeight: "900",
},
etaText: {
color: UI.colors.text2,
fontSize: 18,
lineHeight: 25,
fontWeight: "900",
},
etaSmall: {
color: UI.colors.muted,
fontSize: UI.type.cap,
fontWeight: "800",
},
timelineCard: {
borderRadius: 30,
padding: UI.space.x5,
backgroundColor: UI.colors.surface0,
borderWidth: 1,
borderColor: UI.colors.border,
},
blockTitle: {
color: UI.colors.text,
fontSize: 26,
fontWeight: "900",
},
blockSubtitle: {
color: UI.colors.text2,
fontSize: UI.type.body,
lineHeight: 23,
fontWeight: "800",
marginTop: 6,
marginBottom: UI.space.x3,
},
rail: {
marginTop: UI.space.x4,
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
borderRadius: UI.radius.pill,
alignItems: "center",
justifyContent: "center",
},
dotDone: {
backgroundColor: UI.colors.success,
},
dotIdle: {
backgroundColor: "transparent",
borderWidth: 2,
borderColor: UI.colors.border,
},
dotTextDone: {
color: UI.colors.bg0,
fontSize: 18,
fontWeight: "900",
},
dotTextIdle: {
color: UI.colors.text2,
fontSize: UI.type.bodySm,
fontWeight: "900",
},
railText: {
flex: 1,
backgroundColor: UI.colors.surface1,
borderRadius: 18,
padding: 14,
},
railLabel: {
color: UI.colors.text2,
fontSize: 19,
fontWeight: "900",
},
railLabelActive: {
color: UI.colors.text,
},
railDetail: {
color: UI.colors.text2,
fontSize: UI.type.bodySm,
lineHeight: 20,
marginTop: UI.space.x1,
fontWeight: "800",
},
emptyCard: {
borderRadius: 26,
padding: UI.space.x5,
backgroundColor: UI.colors.surface0,
borderWidth: 1,
borderColor: UI.colors.border,
},
emptyTitle: {
color: UI.colors.text,
fontSize: UI.type.h2,
fontWeight: "900",
},
emptyText: {
color: UI.colors.text2,
fontSize: UI.type.body,
lineHeight: 24,
fontWeight: "800",
marginTop: UI.space.x2,
},
// DA_V3C11H6_RECENT_ORDERS_COMPACT_STYLES
recentCardCompact: {
  borderRadius: UI.radius.xl,
  paddingHorizontal: UI.space.x4,
  paddingVertical: 14,
  backgroundColor: UI.colors.surface0,
  borderWidth: 1,
  borderColor: UI.colors.border,
},
recentTitleCompact: {
  color: UI.colors.text,
  fontSize: 22,
  lineHeight: 27,
  fontWeight: "900",
  marginBottom: 10,
},
recentButtonCompact: {
  minHeight: 50,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: UI.colors.surface1,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: UI.colors.border,
  paddingHorizontal: UI.space.x4,
},
recentButtonCompactText: {
  color: UI.colors.text,
  fontSize: UI.type.body,
  lineHeight: 20,
  fontWeight: "900",
  textAlign: "center",
},

recentCard: {
borderRadius: 30,
padding: UI.space.x5,
backgroundColor: UI.colors.surface0,
borderWidth: 1,
borderColor: UI.colors.border,
},
orderRow: {
flexDirection: "row",
alignItems: "center",
backgroundColor: UI.colors.surface1,
borderRadius: UI.radius.lg,
padding: UI.space.x4,
marginTop: UI.space.x3,
borderWidth: 1,
borderColor: "transparent",
},
orderRowActive: {
borderColor: UI.colors.accent2,
backgroundColor: UI.colors.bg1,
},
orderRowId: {
color: UI.colors.text,
fontSize: 18,
fontWeight: "900",
},
orderRowStatus: {
color: UI.colors.text2,
fontSize: UI.type.bodySm,
fontWeight: "800",
marginTop: 3,
},
orderRowArrow: {
color: UI.colors.accent2,
fontSize: 28,
fontWeight: "900",
},

  liveHeroCard: {
    marginTop: 18,
    marginBottom: 22,
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: UI.colors.accent,
    backgroundColor: UI.colors.surface0,
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
    gap: UI.space.x2,
    paddingHorizontal: 13,
    paddingVertical: UI.space.x2,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.surface1,
    borderWidth: 1,
    borderColor: UI.colors.success,
  },
  liveHeroDot: {
    width: 9,
    height: 9,
    borderRadius: UI.radius.pill,
    backgroundColor: UI.colors.success,
  },
  liveHeroBadgeText: {
    color: UI.colors.success,
    fontSize: UI.type.cap,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  liveHeroEta: {
    color: UI.colors.accent,
    fontSize: 18,
    fontWeight: "900",
  },
  liveHeroTitle: {
    marginTop: UI.space.x5,
    color: UI.colors.text,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  liveHeroSubtitle: {
    marginTop: 10,
    color: UI.colors.text2,
    fontSize: UI.type.body,
    lineHeight: 23,
    fontWeight: "600",
  },
  liveHeroButton: {
    marginTop: UI.space.x5,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: UI.radius.lg,
    backgroundColor: UI.colors.accent,
    borderWidth: 1,
    borderColor: UI.colors.accent,
  },
  liveHeroButtonText: {
    color: UI.colors.surface0,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

secondaryButton: {
backgroundColor: UI.colors.surface1,
borderRadius: 22,
paddingVertical: UI.space.x4,
alignItems: "center",
borderWidth: 1,
borderColor: UI.colors.border,
},
secondaryButtonText: {
color: UI.colors.text,
fontSize: 17,
fontWeight: "900",
},
ghostButton: {
paddingVertical: UI.space.x3,
alignItems: "center",
},
ghostButtonText: {
color: UI.colors.accent2,
fontSize: 17,
fontWeight: "900",
},
footer: {
color: UI.colors.muted,
textAlign: "center",
fontSize: UI.type.cap,
lineHeight: 20,
fontWeight: "800",
},
});
