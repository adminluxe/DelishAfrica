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
// DA_GALA_INTERACTION_OSMOSIS_V1 - shared actions inherit each app chroma while deep surfaces breathe more freely; no new timer, dependency or business mutation.
// DA_GALA_DEEP_OSMOSIS_V1 - deep navigation adopts the same emerald/amber living field as the hero surfaces; translucent cards preserve water continuity without changing business logic.
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
return order.restaurantName || order.merchantName || "Restaurant partenaire";
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

// DA_GALA_MERCHANT_OPS_HUMAN_STATE_V2 - supervision copy never renders raw auth/network keys.
function humanizeMerchantOpsState(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "Supervision momentanément indisponible. Réessayez dans un instant.";
  if (raw.includes("merchant_oidc_session_required") || raw.includes("Session restaurateur indisponible")) return "Identité Merchant requise pour ouvrir la supervision opérationnelle.";
  if (raw.includes("orders_auth_required") || /\b(401|403)\b/.test(raw)) return "Votre session Merchant doit être renouvelée pour continuer.";
  if (/network request failed|failed to fetch|networkerror/i.test(raw)) return "Connexion au service Merchant momentanément indisponible. Les dernières données locales restent préservées.";
  if (/^[a-z0-9._-]+$/i.test(raw)) return "Supervision momentanément indisponible. Réessayez dans un instant.";
  return raw;
}

export default function OpsDashboardLiteScreen() {
const [orders, setOrders] = useState<DemoOrder[]>([]);
const [refreshing, setRefreshing] = useState(false);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState("Chargement supervision...");
const [selectedStatus, setSelectedStatus] = useState<string>("all");
const [sessionRequired, setSessionRequired] = useState(false);

const load = useCallback(async () => {
setRefreshing(true);
try {
const payload = await postJson("/orders/demo/list", {});
const list = extractOrders(payload);
setOrders(list);
setSessionRequired(false);
setMessage(`${list.length} commande(s) synchronisée(s).`);
} catch (error: any) {
const reason = String(error?.message || error || '');
const needsSession = reason.includes('merchant_oidc_session_required') || reason.includes('Session restaurateur indisponible');
setSessionRequired(needsSession);
setMessage(needsSession ? 'Connexion Merchant requise · aucune session simulée.' : humanizeMerchantOpsState(reason));
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
style={({ pressed }) => [styles.filterButton, active && styles.filterButtonActive, pressed && styles.daPressMicro]}
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
<Text style={styles.brand}>DELISHAFRICA® · MASTER CONTROL</Text>
<Text style={styles.title}>Control room</Text>
<Text style={styles.subtitle}>
Décider vite, voir loin : flux, pression cuisine et remise au même endroit.
</Text>
</View>

<View style={styles.futureRail}>
<View style={styles.futureSignal} />
<View style={{ flex: 1 }}>
<Text style={styles.futureRailKicker}>SERVICE INTELLIGENCE</Text>
<Text style={styles.futureRailText}>
{sessionRequired
? "Compte Merchant à connecter · Master Control reste protégé"
: stats.active > 0
? `${stats.active} opérations surveillées en temps réel`
: "Système prêt · aucun signal prioritaire"}
</Text>
</View>
<Text style={styles.futureRailMeta}>{sessionRequired ? "À CONNECTER" : refreshing || loading ? "SYNC" : "LIVE"}</Text>
</View>

<View style={styles.hero}>
<View style={styles.heroTop}>
<Text style={styles.heroKicker}>SERVICE INTELLIGENCE</Text>
<Text style={styles.live}>SYSTEM LIVE</Text>
</View>

<Text style={styles.heroTitle}>
{sessionRequired ? "Identité Merchant requise" : stats.active > 0 ? `${stats.active} opérations en cours` : "Service calme"}
</Text>
<Text style={styles.heroText}>{sessionRequired ? "Connectez votre compte Merchant pour ouvrir les flux opérationnels. Les actions restent protégées jusqu’à validation de la session." : blockerText}</Text>

<View style={styles.metrics}>
<Metric label="Total" value={stats.total} />
<Metric label="Actif" value={stats.active} tone="watch" />
<Metric label="Payé" value={stats.paid} tone="ok" />
</View>

<View style={styles.metrics}>
<Metric label="Nouvelles" value={stats.pending} tone="watch" />
<Metric label="Prêt" value={stats.ready} tone="ok" />
<Metric label="Livré" value={stats.delivered} tone="done" />
</View>
</View>

<Pressable style={({ pressed }) => [styles.refreshButton, pressed && styles.daPressSecondary]} onPress={sessionRequired ? () => router.push("/auth-session" as any) : load}>
{refreshing || loading ? (
<ActivityIndicator />
) : (
<Text style={styles.refreshText}>{sessionRequired ? "Connecter le compte Merchant" : "Synchroniser le control room"}</Text>
)}
</Pressable>

<Text style={styles.message}>{message}</Text>

<View style={styles.filters}>
<FilterButton id="all" label="Tout" count={stats.total} />
<FilterButton id="active" label="Actif" count={stats.active} />
<FilterButton id="pending" label="Nouvelles" count={stats.pending} />
<FilterButton id="ready" label="Prêt" count={stats.ready} />
<FilterButton id="picked_up" label="Route" count={stats.picked} />
<FilterButton id="delivered" label="Livré" count={stats.delivered} />
</View>

<View style={styles.sectionHead}>
<Text style={styles.sectionTitle}>Flux opérationnel</Text>
<Text style={styles.sectionSubtitle}>
{filteredOrders.length} résultats dans le filtre actif.
</Text>
</View>

{filteredOrders.length ? (
filteredOrders.map((order) => <OrderRow key={orderId(order)} order={order} />)
) : (
<View style={styles.emptyCard}>
<Text style={styles.emptyEmoji}>🧭</Text>
<Text style={styles.emptyTitle}>{sessionRequired ? "Compte Merchant non connecté" : "Aucune commande ici"}</Text>
<Text style={styles.emptyText}>
{sessionRequired ? "Une connexion réelle suffit pour restaurer la supervision, les commandes et le contexte cuisine." : "Change de filtre ou crée une commande depuis l’app Client."}
</Text>
</View>
)}

<View style={styles.debtCard}>
<Text style={styles.debtKicker}>Continuité opérationnelle</Text>
<Text style={styles.debtText}>
Le control room privilégie la prochaine décision utile et conserve le contexte entre cuisine, remise et livraison.
</Text>
</View>

<Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.daPressPrimary]} onPress={() => router.push("/orders" as any)}>
<Text style={styles.secondaryButtonText}>Retour cockpit cuisine</Text>
</Pressable>

<Pressable style={({ pressed }) => [styles.backButton, pressed && styles.daPressMicro]} onPress={() => router.replace("/")}>
<Text style={styles.backText}>Retour espace partenaire</Text>
</Pressable>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(105, 216, 193, 0.006)", borderWidth: 0.5, borderColor: "rgba(105, 216, 193, 0.017)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 246, 230, 0.006)", borderWidth: 0.5, borderColor: "rgba(255, 255, 255, 0.018)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(233, 166, 75, 0.005)", borderWidth: 0.5, borderColor: "rgba(233, 166, 75, 0.015)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.006)", borderWidth: 0.5, borderColor: "rgba(225, 255, 248, 0.018)" },
safe: { flex: 1, backgroundColor: "transparent" },
page: { padding: 18, paddingBottom: 84 },
header: { marginBottom: 22 },
brand: {
color: "#E9A64B",
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
color: "rgba(220,203,184,0.78)",
fontSize: 17,
lineHeight: 26,
marginTop: 12,
fontWeight: "600",
},
hero: {
backgroundColor: "rgba(44,29,18,0.63)",
borderColor: "rgba(233,166,75,0.070)",
borderWidth: 1,
borderRadius: 34,
padding: 22,
marginBottom: 18,
},
heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
heroKicker: {
color: "#E9A64B",
fontSize: 14,
fontWeight: "900",
letterSpacing: 1.2,
},
live: {
color: "#E9A64B",
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
color: "rgba(222,204,184,0.82)",
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
borderColor: "rgba(255,255,255,0.008)",
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
color: "rgba(196,177,158,0.76)",
fontSize: 12,
lineHeight: 16,
marginTop: 6,
fontWeight: "900",
textTransform: "uppercase",
 flexShrink: 1,
letterSpacing: 1.8,
},
refreshButton: {
borderColor: "#E9A64B",
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
color: "#E9A64B",
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
backgroundColor: "rgba(48,32,20,0.53)",
borderColor: "rgba(255,255,255,0.008)",
borderWidth: 1,
borderRadius: 18,
paddingHorizontal: 14,
paddingVertical: 12,
minWidth: 96,
},
filterButtonActive: {
backgroundColor: "#E9A64B",
borderColor: "#E9A64B",
},
filterLabel: {
color: "rgba(220,203,184,0.78)",
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
color: "#211307",
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
color: "rgba(181,164,146,0.70)",
fontSize: 16,
fontWeight: "700",
marginTop: 5,
},
orderRow: {
backgroundColor: "rgba(48,32,20,0.53)",
borderColor: "rgba(255,255,255,0.008)",
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
color: "rgba(220,203,184,0.78)",
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
backgroundColor: "rgba(51,42,32,0.78)",
},
status_neutral: {
backgroundColor: "rgba(48,38,30,0.78)",
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
color: "#E9A64B",
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
color: "rgba(196,177,158,0.76)",
fontSize: 15,
lineHeight: 23,
fontWeight: "700",
marginTop: 14,
},
emptyCard: {
backgroundColor: "rgba(48,32,20,0.53)",
borderColor: "rgba(255,255,255,0.008)",
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
color: "rgba(196,177,158,0.76)",
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
backgroundColor: "rgba(48,32,20,0.53)",
borderColor: "rgba(255,255,255,0.014)",
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
color: "#E9A64B",
fontSize: 18,
fontWeight: "900",
},
futureRail: {
minHeight: 76,
flexDirection: "row",
alignItems: "center",
gap: 12,
paddingHorizontal: 16,
paddingVertical: 14,
marginBottom: 16,
borderRadius: 22,
backgroundColor: "rgba(31,22,15,0.575)",
borderWidth: 1,
borderColor: "rgba(105,216,193,0.034)",
},
futureSignal: {
width: 11,
height: 11,
borderRadius: 99,
backgroundColor: "#76EFDF",
shadowColor: "#76EFDF",
shadowOpacity: 0.7,
shadowRadius: 12,
},
futureRailKicker: { color: "#76EFDF", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
futureRailText: { color: "rgba(235,250,255,0.76)", fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 4 },
futureRailMeta: { color: "#FFD27A", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },

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
