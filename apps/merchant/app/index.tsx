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

const RAW_API =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
? RAW_API.replace(/\/$/, "")
: `${RAW_API.replace(/\/$/, "")}/api/v1`;

type OrderStatus =
| "pending"
| "accepted"
| "ready"
| "picked_up"
| "delivered"
| "cancelled"
| "canceled"
| string;

type Order = {
id?: string;
orderId?: string;
publicId?: string;
status?: OrderStatus;
restaurant?: string;
restaurantName?: string;
total?: number;
amount?: number;
createdAt?: string;
updatedAt?: string;
items?: Array<{
name?: string;
quantity?: number;
price?: number;
}>;
};

type AlertTone = "gold" | "blue" | "green" | "muted";

type InAppAlert = {
id: string;
title: string;
body: string;
tone: AlertTone;
priority: number;
};

function go(path: string) {
router.push(path as any);
}

function orderId(order: Order) {
return order.publicId || order.orderId || order.id || "Commande";
}

function money(value: unknown) {
const raw = typeof value === "number" ? value : Number(value || 0);

if (!Number.isFinite(raw)) return "-";

const euros = Math.abs(raw) >= 100 ? raw / 100 : raw;

return euros.toLocaleString("fr-BE", {
minimumFractionDigits: 2,
maximumFractionDigits: 2,
}) + " €";
}

function normalizeStatus(status?: OrderStatus) {
return String(status || "pending").toLowerCase();
}

function statusLabel(status?: OrderStatus) {
const s = normalizeStatus(status);
if (s === "pending") return "À accepter";
if (s === "accepted") return "En préparation";
if (s === "ready") return "Prête";
if (s === "picked_up") return "En livraison";
if (s === "delivered") return "Livrée";
if (s === "cancelled" || s === "canceled") return "Annulée";
return s;
}

function itemSummary(order: Order) {
const items = Array.isArray(order.items) ? order.items : [];
if (!items.length) return "Commande Thieyp";
return items
.slice(0, 2)
.map((item) => {
const qty = Number(item.quantity || 1);
return `${qty}× ${item.name || "Plat"}`;
})
.join(" · ");
}

function orderTime(order: Order) {
const raw = order.updatedAt || order.createdAt;
if (!raw) return "À l’instant";
const d = new Date(raw);
if (Number.isNaN(d.getTime())) return "À l’instant";
return d.toLocaleTimeString("fr-BE", {
hour: "2-digit",
minute: "2-digit",
});
}

function buildAlerts(orders: Order[]): InAppAlert[] {
const pending = orders.filter((o) => normalizeStatus(o.status) === "pending");
const accepted = orders.filter((o) => normalizeStatus(o.status) === "accepted");
const ready = orders.filter((o) => normalizeStatus(o.status) === "ready");
const picked = orders.filter((o) => normalizeStatus(o.status) === "picked_up");

const alerts: InAppAlert[] = [];

if (pending.length) {
const top = pending[0];
alerts.push({
id: `pending-${orderId(top)}`,
title: `${pending.length} commande${pending.length > 1 ? "s" : ""} à accepter`,
body: `${orderId(top)} · ${itemSummary(top)} · ${money(top.total ?? top.amount)}`,
tone: "gold",
priority: 1,
});
}

if (accepted.length) {
const top = accepted[0];
alerts.push({
id: `accepted-${orderId(top)}`,
title: `${accepted.length} préparation${accepted.length > 1 ? "s" : ""} en cours`,
body: `${orderId(top)} attend le passage en “Prête”.`,
tone: "blue",
priority: 2,
});
}

if (ready.length) {
const top = ready[0];
alerts.push({
id: `ready-${orderId(top)}`,
title: `${ready.length} commande${ready.length > 1 ? "s" : ""} prête${ready.length > 1 ? "s" : ""}`,
body: `${orderId(top)} peut être récupérée par le coursier.`,
tone: "green",
priority: 3,
});
}

if (picked.length) {
const top = picked[0];
alerts.push({
id: `picked-${orderId(top)}`,
title: "Livraison en cours",
body: `${orderId(top)} est entre les mains du coursier.`,
tone: "muted",
priority: 4,
});
}

if (!alerts.length) {
alerts.push({
id: "calm",
title: "Cuisine prête au service",
body: "Service calme. La cuisine reste prête à recevoir les prochaines commandes.",
tone: "muted",
priority: 9,
});
}

return alerts.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

async function fetchOrders(): Promise<Order[]> {
const res = await fetch(`${API_BASE_URL}/orders/demo/list`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({}),
});

const json = await res.json().catch(() => ({}));

if (!res.ok) {
throw new Error(json?.message || `HTTP ${res.status}`);
}

const candidates =
json?.orders ||
json?.data?.orders ||
json?.items ||
json?.data ||
[];

return Array.isArray(candidates) ? candidates : [];
}

export default function MerchantHome() {
const [orders, setOrders] = useState<Order[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState<string | null>(null);
const [lastSync, setLastSync] = useState<string>("—");

const load = useCallback(async () => {
try {
setError(null);
const next = await fetchOrders();
setOrders(next);
setLastSync(
new Date().toLocaleTimeString("fr-BE", {
hour: "2-digit",
minute: "2-digit",
})
);
} catch (e: any) {
setError(e?.message || "Synchronisation momentanément indisponible");
} finally {
setLoading(false);
setRefreshing(false);
}
}, []);

useEffect(() => {
load();
const timer = setInterval(load, 15000);
return () => clearInterval(timer);
}, [load]);

const stats = useMemo(() => {
const active = orders.filter((o) =>
["pending", "accepted", "ready", "picked_up"].includes(normalizeStatus(o.status))
);
return {
total: orders.length,
active: active.length,
pending: orders.filter((o) => normalizeStatus(o.status) === "pending").length,
accepted: orders.filter((o) => normalizeStatus(o.status) === "accepted").length,
ready: orders.filter((o) => normalizeStatus(o.status) === "ready").length,
delivered: orders.filter((o) => normalizeStatus(o.status) === "delivered").length,
};
}, [orders]);

const alerts = useMemo(() => buildAlerts(orders), [orders]);
const urgentCount = alerts.filter((a) => a.tone !== "muted").length;
const activeOrders = useMemo(
() =>
orders
.filter((o) =>
["pending", "accepted", "ready", "picked_up"].includes(normalizeStatus(o.status))
)
.slice(0, 5),
[orders]
);

const onRefresh = useCallback(() => {
setRefreshing(true);
load();
}, [load]);

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.content}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
>
<View style={styles.hero}>
<View style={styles.heroTop}>
<View>
<Text style={styles.brand}>DELISHAFRICA® · MERCHANT</Text>
<Text style={styles.title}>Cockpit cuisine</Text>
</View>

<View style={styles.livePill}>
<View style={styles.liveDot} />
<Text style={styles.liveText}>LIVE</Text>
</View>
</View>

<Text style={styles.subtitle}>
Les alertes internes suivent les commandes en temps réel, sans notification native ni rebuild.
</Text>

<View style={styles.syncRow}>
<Text style={styles.syncText}>Dernière synchro : {lastSync}</Text>
<Text style={styles.apiText}>API sécurisée</Text>
</View>
</View>

<View style={styles.notificationCard}>
<View style={styles.notificationHeader}>
<View>
<Text style={styles.sectionKicker}>Notifications internes</Text>
<Text style={styles.sectionTitle}>Centre d’alertes</Text>
</View>

<View style={styles.badge}>
<Text style={styles.badgeText}>{urgentCount}</Text>
</View>
</View>

{loading ? (
<View style={styles.loadingBox}>
<ActivityIndicator />
<Text style={styles.loadingText}>Lecture des commandes…</Text>
</View>
) : error ? (
<View style={styles.errorBox}>
<Text style={styles.errorTitle}>Connexion à vérifier</Text>
<Text style={styles.errorText}>{error}</Text>
<Pressable style={styles.secondaryButton} onPress={load}>
<Text style={styles.secondaryButtonText}>Réessayer</Text>
</Pressable>
</View>
) : (
<View style={styles.alertList}>
{alerts.map((alert) => (
<View key={alert.id} style={[styles.alertRow, styles[`tone_${alert.tone}`]]}>
<View style={styles.alertIcon}>
<Text style={styles.alertIconText}>
{alert.tone === "gold"
? "!"
: alert.tone === "blue"
? "•"
: alert.tone === "green"
? "✓"
: "i"}
</Text>
</View>
<View style={styles.alertBody}>
<Text style={styles.alertTitle}>{alert.title}</Text>
<Text style={styles.alertText}>{alert.body}</Text>
</View>
</View>
))}
</View>
)}
</View>

<View style={styles.partnerSpaceCard}>
<View style={styles.notificationHeader}>
<View>
<Text style={styles.sectionKicker}>Espace partenaire</Text>
<Text style={styles.sectionTitle}>Compte restaurateur</Text>
</View>
<Text style={styles.totalText}>Lite</Text>
</View>

<Text style={styles.partnerSpaceText}>
Session, informations restaurant, profil partenaire et suivi opérationnel.
</Text>

<View style={styles.quickGrid}>
<Pressable style={styles.quickButton} onPress={() => go("/auth-session")}>
<Text style={styles.quickButtonTitle}>Session</Text>
<Text style={styles.quickButtonText}>Connexion</Text>
</Pressable>

<Pressable style={styles.quickButton} onPress={() => go("/partner-space")}>
<Text style={styles.quickButtonTitle}>Partenaire</Text>
<Text style={styles.quickButtonText}>Infos</Text>
</Pressable>

<Pressable style={styles.quickButton} onPress={() => go("/merchant-space")}>
<Text style={styles.quickButtonTitle}>Restaurant</Text>
<Text style={styles.quickButtonText}>Espace</Text>
</Pressable>

<Pressable style={styles.quickButton} onPress={() => go("/merchant-profile")}>
<Text style={styles.quickButtonTitle}>Profil</Text>
<Text style={styles.quickButtonText}>Compte</Text>
</Pressable>

<Pressable style={styles.quickButtonWide} onPress={() => go("/ops-dashboard")}>
<Text style={styles.quickButtonTitle}>Ops Lite</Text>
<Text style={styles.quickButtonText}>Suivi activité</Text>
</Pressable>
</View>
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
<Text style={styles.statNumber}>{stats.delivered}</Text>
<Text style={styles.statLabel}>Livrées</Text>
</View>
</View>

<View style={styles.actions}>
<Pressable style={styles.primaryButton} onPress={() => go("/orders")}>
<Text style={styles.primaryButtonText}>Ouvrir les commandes</Text>
</Pressable>

<Pressable
onPress={() => go("/kitchen-oracle")}
style={{
borderRadius: 24,
padding: 20,
backgroundColor: "#32180D",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.20)",
width: "100%",
alignSelf: "stretch",
marginTop: 0,
marginBottom: 18
 }}
>
<Text style={{ color: "#F7B267", fontSize: 11, fontWeight: "900", letterSpacing: 2.4, marginBottom: 8 }}>
ORACLE CUISINE
</Text>
<Text style={{ color: "#FFF8EF", fontSize: 26, fontWeight: "900", marginBottom: 8 }}>
Kitchen Oracle
</Text>
<Text style={{ color: "rgba(255,248,239,0.72)", fontSize: 15, lineHeight: 22, fontWeight: "700" }}>
Priorités cuisine, pression de service et coordination coursier.
</Text>
</Pressable>
<Pressable
onPress={() => go("/kitchen-pulse")}
style={{
borderRadius: 24,
padding: 20,
backgroundColor: "#3A1C0F",
borderWidth: 1,
borderColor: "rgba(247,178,103,0.24)",
width: "100%",
alignSelf: "stretch",
marginTop: -6,
marginBottom: 18
}}
>
<Text style={{ color: "#F7B267", fontSize: 11, fontWeight: "900", letterSpacing: 2.4, marginBottom: 8 }}>
KITCHEN PULSE
</Text>
<Text style={{ color: "#FFF8EF", fontSize: 26, fontWeight: "900", marginBottom: 8 }}>
Pulse cuisine
</Text>
<Text style={{ color: "rgba(255,248,239,0.72)", fontSize: 15, lineHeight: 22, fontWeight: "700" }}>
Pression de service, file active et priorités en lecture seule.
</Text>
</Pressable>


</View>

<View style={styles.ordersCard}>
<View style={styles.notificationHeader}>
<View>
<Text style={styles.sectionKicker}>File active</Text>
<Text style={styles.sectionTitle}>
{stats.active} commande{stats.active > 1 ? "s" : ""} en cours
</Text>
</View>
<Text style={styles.totalText}>{stats.total} total</Text>
</View>

{activeOrders.length ? (
activeOrders.map((order) => (
<View key={orderId(order)} style={styles.orderRow}>
<View style={styles.orderMain}>
<Text style={styles.orderId}>{orderId(order)}</Text>
<Text style={styles.orderItems}>{itemSummary(order)}</Text>
<Text style={styles.orderMeta}>
{orderTime(order)} · {money(order.total ?? order.amount)}
</Text>
</View>
<View style={styles.statusPill}>
<Text style={styles.statusText}>{statusLabel(order.status)}</Text>
</View>
</View>
))
) : (
<View style={styles.emptyBox}>
<Text style={styles.emptyTitle}>Aucune commande active</Text>
<Text style={styles.emptyText}>
Le cockpit reste prêt dès qu’une nouvelle commande arrive.
</Text>
</View>
)}
</View>

<Text style={styles.footer}>
Alertes internes · suivi restaurateur · sans dépendance native
</Text>

<Pressable
onPress={() => go("/terrain-os")}
accessibilityRole="button"
style={{
marginTop: 18,
marginBottom: 4,
borderRadius: 30,
padding: 22,
minHeight: 152,
backgroundColor: "#35170E",
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
color: "#F7B267",
fontSize: 12,
fontWeight: "900",
letterSpacing: 5,
}}
>
TERRAIN OS
</Text>
<Text
style={{
color: "#FFF8EF",
fontSize: 28,
lineHeight: 33,
fontWeight: "900",
marginTop: 10,
}}
>
Cuisine + route synchronisées
</Text>
<Text
style={{
color: "rgba(255,248,239,0.76)",
fontSize: 15,
lineHeight: 22,
fontWeight: "700",
marginTop: 8,
}}
>
Fenêtre coursier, pression service et timing cuisine dans un cockpit.
</Text>
<View
style={{
alignSelf: "flex-start",
marginTop: 16,
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 10,
backgroundColor: "#F7B267",
}}
>
<Text
style={{
color: "#160805",
fontSize: 14,
fontWeight: "900",
}}
>
Ouvrir Terrain OS →
</Text>
</View>
</Pressable>

      <Pressable
        onPress={() => router.push("/delishafrica-signature" as any)}
        style={{
          marginTop: 18,
          borderRadius: 28,
          padding: 20,
          borderWidth: 1,
          borderColor: "rgba(245,190,107,0.36)",
          backgroundColor: "rgba(8,18,15,0.86)",
        }}
      >
        <Text style={{ color: "#F5BE6B", fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }}>DELISHAFRICA® SIGNATURE</Text>
        <Text style={{ marginTop: 8, color: "#FFF9EA", fontSize: 21, fontWeight: "900" }}>Kitchen Intelligence</Text>
        <Text style={{ marginTop: 6, color: "rgba(255,249,234,0.68)", fontSize: 13, lineHeight: 19 }}>Priorites, clarté cuisine et prochaine meilleure action.</Text>
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
safe: {
flex: 1,
backgroundColor: "#140B07",
},
content: {
padding: 18,
paddingBottom: 44,
},
hero: {
borderRadius: 28,
padding: 20,
backgroundColor: "#2A130B",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
marginBottom: 16,
},
heroTop: {
flexDirection: "row",
justifyContent: "space-between",
gap: 12,
alignItems: "flex-start",
},
brand: {
color: "#F7B267",
fontSize: 12,
letterSpacing: 1.3,
fontWeight: "800",
},
title: {
color: "#FFF8EF",
fontSize: 32,
fontWeight: "900",
marginTop: 6,
},
subtitle: {
color: "rgba(255,248,239,0.78)",
fontSize: 15,
lineHeight: 22,
marginTop: 14,
},
livePill: {
flexDirection: "row",
alignItems: "center",
gap: 7,
paddingHorizontal: 11,
paddingVertical: 8,
borderRadius: 999,
backgroundColor: "rgba(48, 209, 88, 0.14)",
},
liveDot: {
width: 8,
height: 8,
borderRadius: 99,
backgroundColor: "#30D158",
},
liveText: {
color: "#B8FFD0",
fontSize: 11,
fontWeight: "900",
},
syncRow: {
flexDirection: "row",
justifyContent: "space-between",
gap: 12,
marginTop: 18,
},
syncText: {
color: "rgba(255,248,239,0.62)",
fontSize: 12,
},
apiText: {
color: "#F7B267",
fontSize: 12,
fontWeight: "800",
},
notificationCard: {
borderRadius: 26,
padding: 18,
backgroundColor: "#FFF8EF",
marginBottom: 14,
},
notificationHeader: {
flexDirection: "row",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
marginBottom: 14,
},
sectionKicker: {
color: "#B8602E",
fontSize: 12,
fontWeight: "900",
letterSpacing: 0.9,
textTransform: "uppercase",
},
sectionTitle: {
color: "#24120B",
fontSize: 22,
fontWeight: "900",
marginTop: 2,
},
badge: {
minWidth: 38,
height: 38,
borderRadius: 999,
alignItems: "center",
justifyContent: "center",
backgroundColor: "#24120B",
},
badgeText: {
color: "#FFF8EF",
fontWeight: "900",
fontSize: 16,
},
alertList: {
gap: 10,
},
alertRow: {
flexDirection: "row",
gap: 12,
borderRadius: 20,
padding: 14,
borderWidth: 1,
},
tone_gold: {
backgroundColor: "#FFF1D6",
borderColor: "#F4B350",
},
tone_blue: {
backgroundColor: "#EEF5FF",
borderColor: "#9DC4FF",
},
tone_green: {
backgroundColor: "#ECFFF2",
borderColor: "#8BE3A7",
},
tone_muted: {
backgroundColor: "#F3EFE8",
borderColor: "#E4D7C8",
},
alertIcon: {
width: 32,
height: 32,
borderRadius: 999,
alignItems: "center",
justifyContent: "center",
backgroundColor: "#24120B",
},
alertIconText: {
color: "#FFF8EF",
fontSize: 16,
fontWeight: "900",
},
alertBody: {
flex: 1,
},
alertTitle: {
color: "#24120B",
fontSize: 15,
fontWeight: "900",
},
alertText: {
color: "rgba(36,18,11,0.72)",
fontSize: 13,
lineHeight: 18,
marginTop: 3,
},
loadingBox: {
alignItems: "center",
justifyContent: "center",
paddingVertical: 22,
gap: 10,
},
loadingText: {
color: "rgba(36,18,11,0.70)",
fontWeight: "700",
},
errorBox: {
borderRadius: 18,
padding: 16,
backgroundColor: "#FFF1F0",
borderWidth: 1,
borderColor: "#FFB4AB",
},
errorTitle: {
color: "#7A1B10",
fontWeight: "900",
fontSize: 16,
},
errorText: {
color: "#7A1B10",
marginTop: 6,
marginBottom: 12,
},
partnerSpaceCard: {
borderRadius: 26,
padding: 18,
backgroundColor: "#FFF8EF",
marginBottom: 14,
},
partnerSpaceText: {
color: "rgba(36,18,11,0.68)",
fontSize: 14,
lineHeight: 20,
marginBottom: 14,
},
quickGrid: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
},
quickButton: {
width: "48%",
minHeight: 68,
borderRadius: 18,
padding: 14,
backgroundColor: "#F3EFE8",
borderWidth: 1,
borderColor: "rgba(36,18,11,0.12)",
justifyContent: "center",
},
quickButtonWide: {
width: "100%",
minHeight: 64,
borderRadius: 18,
padding: 14,
backgroundColor: "#F3EFE8",
borderWidth: 1,
borderColor: "rgba(36,18,11,0.12)",
justifyContent: "center",
},
quickButtonTitle: {
color: "#24120B",
fontSize: 16,
fontWeight: "900",
},
quickButtonText: {
color: "rgba(36,18,11,0.60)",
fontSize: 12,
fontWeight: "800",
marginTop: 5,
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
backgroundColor: "rgba(255,248,239,0.10)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
statNumber: {
color: "#FFF8EF",
fontSize: 27,
fontWeight: "900",
},
statLabel: {
color: "rgba(255,248,239,0.70)",
marginTop: 4,
fontWeight: "700",
},
actions: {
gap: 12,
marginBottom: 14,
},
primaryButton: {
flex: 1,
borderRadius: 18,
paddingVertical: 15,
alignItems: "center",
backgroundColor: "#F7B267",
},
primaryButtonText: {
color: "#24120B",
fontWeight: "900",
fontSize: 15,
},
secondaryButton: {
borderRadius: 18,
paddingVertical: 14,
paddingHorizontal: 16,
alignItems: "center",
backgroundColor: "rgba(36,18,11,0.08)",
borderWidth: 1,
borderColor: "rgba(36,18,11,0.12)",
},
secondaryButtonText: {
color: "#24120B",
fontWeight: "900",
fontSize: 14,
},
ordersCard: {
borderRadius: 26,
padding: 18,
backgroundColor: "#FFF8EF",
},
totalText: {
color: "rgba(36,18,11,0.62)",
fontWeight: "800",
},
orderRow: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
paddingVertical: 13,
borderTopWidth: 1,
borderTopColor: "rgba(36,18,11,0.10)",
},
orderMain: {
flex: 1,
},
orderId: {
color: "#24120B",
fontWeight: "900",
fontSize: 15,
},
orderItems: {
color: "rgba(36,18,11,0.74)",
marginTop: 3,
fontWeight: "700",
},
orderMeta: {
color: "rgba(36,18,11,0.52)",
marginTop: 3,
fontSize: 12,
},
statusPill: {
borderRadius: 999,
paddingHorizontal: 10,
paddingVertical: 7,
backgroundColor: "#24120B",
},
statusText: {
color: "#FFF8EF",
fontSize: 12,
fontWeight: "900",
},
emptyBox: {
paddingVertical: 19,
alignItems: "center",
},
emptyTitle: {
color: "#24120B",
fontSize: 16,
fontWeight: "900",
},
emptyText: {
color: "rgba(36,18,11,0.62)",
textAlign: "center",
marginTop: 6,
lineHeight: 19,
},
footer: {
color: "rgba(255,248,239,0.50)",
textAlign: "center",
marginTop: 18,
fontSize: 12,
},
});
