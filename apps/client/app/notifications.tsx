import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
Pressable,
RefreshControl,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type OrderStatus =
| "pending"
| "accepted"
| "ready"
| "picked_up"
| "delivered"
| "cancelled"
| "canceled"
| string;

type DemoOrder = {
id?: string;
orderId?: string;
publicId?: string;
status?: OrderStatus;
restaurantName?: string;
restaurant?: string | { name?: string };
customerName?: string;
customer?: string | { name?: string };
items?: Array<{ name?: string; title?: string; quantity?: number }>;
total?: number;
amount?: number;
createdAt?: string;
updatedAt?: string;
};

type ClientAlert = {
id: string;
tone: "gold" | "blue" | "green" | "quiet";
title: string;
body: string;
meta: string;
status: string;
};

const RAW_API =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/+$/, "").endsWith("/api/v1")
? RAW_API.replace(/\/+$/, "")
: `${RAW_API.replace(/\/+$/, "")}/api/v1`;

function textFrom(value: unknown, fallback = ""): string {
if (!value) return fallback;
if (typeof value === "string") return value;
if (typeof value === "object" && "name" in value && typeof value.name === "string") {
return value.name;
}
return fallback;
}

function publicId(order: DemoOrder): string {
return String(order.publicId || order.orderId || order.id || "Commande");
}

function firstItem(order: DemoOrder): string {
const item = order.items?.[0];
return item?.name || item?.title || "Commande DelishAfrica®";
}

function statusLabel(status?: OrderStatus): string {
switch (status) {
case "pending":
return "Reçue";
case "accepted":
return "Cuisine";
case "ready":
return "Prête";
case "picked_up":
return "En route";
case "delivered":
return "Livrée";
case "cancelled":
case "canceled":
return "Annulée";
default:
return "Suivi";
}
}

function buildAlert(order: DemoOrder): ClientAlert {
const status = String(order.status || "pending");
const id = publicId(order);
const restaurant = textFrom(order.restaurantName || order.restaurant, "Thieyp");
const item = firstItem(order);

if (status === "pending") {
return {
id,
tone: "gold",
title: "Commande reçue",
body: `${restaurant} a reçu votre commande ${item}. Le restaurant va la prendre en charge.`,
meta: `${id} · Paiement sécurisé validé`,
status,
};
}

if (status === "accepted") {
return {
id,
tone: "gold",
title: "Cuisine en préparation",
body: `${restaurant} prépare votre commande. Le suivi reste actif jusqu’à la livraison.`,
meta: `${id} · Préparation en cours`,
status,
};
}

if (status === "ready") {
return {
id,
tone: "blue",
title: "Commande prête",
body: `${item} est prêt chez ${restaurant}. Un coursier peut passer en récupération.`,
meta: `${id} · Prête pour livraison`,
status,
};
}

if (status === "picked_up") {
return {
id,
tone: "blue",
title: "Livraison en route",
body: `Votre commande ${item} a quitté ${restaurant}. Elle arrive bientôt.`,
meta: `${id} · Coursier en route`,
status,
};
}

if (status === "delivered") {
return {
id,
tone: "green",
title: "Commande livrée",
body: `${item} a été livré. Merci de faire rayonner les saveurs africaines avec DelishAfrica.`,
meta: `${id} · Bon appétit`,
status,
};
}

return {
id,
tone: "quiet",
title: "Suivi de commande",
body: `${restaurant} garde votre commande dans le flux DelishAfrica.`,
meta: `${id} · ${statusLabel(status)}`,
status,
};
}

function normalizeList(payload: any): DemoOrder[] {
const source =
payload?.orders ||
payload?.items ||
payload?.data ||
payload?.result ||
payload?.list ||
[];

return Array.isArray(source) ? source : [];
}

export default function ClientNotificationsScreen() {
const insets = useSafeAreaInsets();
const router = useRouter();
const [orders, setOrders] = useState<DemoOrder[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState("");

const load = useCallback(async () => {
setError("");
try {
const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ scope: "client-inapp-notifications-v1a" }),
});

const json = await response.json().catch(() => ({}));
if (!response.ok) {
throw new Error(json?.message || `HTTP ${response.status}`);
}

setOrders(normalizeList(json));
} catch (err: any) {
setError(err?.message || "Impossible de charger les alertes Client.");
setOrders([]);
} finally {
setLoading(false);
setRefreshing(false);
}
}, []);

useEffect(() => {
load();
}, [load]);

const alerts = useMemo(() => {
return orders
.map(buildAlert)
.sort((a, b) => {
const priority: Record<string, number> = {
picked_up: 0,
ready: 1,
accepted: 2,
pending: 3,
delivered: 4,
};
return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
});
}, [orders]);

const counts = useMemo(() => {
const active = alerts.filter((a) =>
["pending", "accepted", "ready", "picked_up"].includes(a.status)
).length;
const route = alerts.filter((a) => a.status === "picked_up").length;
const delivered = alerts.filter((a) => a.status === "delivered").length;
return { active, route, delivered };
}, [alerts]);

const onRefresh = useCallback(() => {
setRefreshing(true);
load();
}, [load]);

return (
<ScrollView
style={styles.screen}
contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 18, 54) }]}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
>
<View style={styles.hero}>
<Text style={styles.kicker}>DELISHAFRICA® · CLIENT</Text>
<View style={styles.row}>
<Text style={styles.title}>Mes alertes</Text>
<Text style={styles.live}>LIVE</Text>
</View>
<Text style={styles.subtitle}>
Un centre clair pour suivre paiement, cuisine, livraison et commandes terminées.
</Text>
</View>

<View style={styles.grid}>
<View style={styles.metric}>
<Text style={styles.metricValue}>{counts.active}</Text>
<Text style={styles.metricLabel}>Actives</Text>
</View>
<View style={styles.metric}>
<Text style={styles.metricValue}>{counts.route}</Text>
<Text style={styles.metricLabel}>En route</Text>
</View>
<View style={styles.metric}>
<Text style={styles.metricValue}>{counts.delivered}</Text>
<Text style={styles.metricLabel}>Livrées</Text>
</View>
</View>

<View style={styles.actions}>
<Pressable style={styles.primaryButton} onPress={load}>
<Text style={styles.primaryButtonText}>
{loading ? "Chargement..." : "Rafraîchir mes alertes"}
</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/order-tracking" as any)}>
<Text style={styles.secondaryButtonText}>Suivre ma commande</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/checkout-preflight" as any)}>
<Text style={styles.secondaryButtonText}>Commander Thieyp</Text>
</Pressable>
</View>

{loading ? (
<View style={styles.emptyCard}>
<ActivityIndicator />
<Text style={styles.emptyText}>Lecture du suivi Client…</Text>
</View>
) : error ? (
<View style={styles.errorCard}>
<Text style={styles.errorTitle}>Alertes indisponibles</Text>
<Text style={styles.errorText}>{error}</Text>
<Text style={styles.note}>
L’écran reste informatif. Aucune commande n’a été modifiée.
</Text>
</View>
) : alerts.length === 0 ? (
<View style={styles.emptyCard}>
<Text style={styles.emptyTitle}>Aucune alerte pour l’instant</Text>
<Text style={styles.emptyText}>
Vos prochaines commandes DelishAfrica apparaîtront ici avec leur suivi.
</Text>
</View>
) : (
<View style={styles.list}>
{alerts.map((alert) => (
<View key={`${alert.id}-${alert.status}`} style={[styles.alertCard, styles[alert.tone]]}>
<View style={styles.alertTop}>
<Text style={styles.alertTitle}>{alert.title}</Text>
<Text style={styles.badge}>{statusLabel(alert.status)}</Text>
</View>
<Text style={styles.alertBody}>{alert.body}</Text>
<Text style={styles.alertMeta}>{alert.meta}</Text>
</View>
))}
</View>
)}

<View style={styles.footer}>
<Text style={styles.footerTitle}>Alertes internes</Text>
<Text style={styles.footerText}>
Centre d’alertes interne : aucune notification native ni permission iOS requise.
</Text>
</View>
</ScrollView>
);
}

const styles = StyleSheet.create({
screen: {
flex: 1,
backgroundColor: "#08111F",
},
content: {
padding: 18,
paddingBottom: 40,
},
hero: {
padding: 20,
borderRadius: 30,
backgroundColor: "#102A4C",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.14)",
marginBottom: 16,
},
kicker: {
color: "#D8C28A",
fontWeight: "900",
letterSpacing: 1.2,
fontSize: 12,
marginBottom: 8,
},
row: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
},
title: {
color: "#FFFFFF",
fontSize: 32,
fontWeight: "900",
flex: 1,
},
live: {
color: "#08111F",
backgroundColor: "#D8C28A",
paddingHorizontal: 10,
paddingVertical: 5,
borderRadius: 999,
fontWeight: "900",
fontSize: 12,
},
subtitle: {
color: "#EAF1FF",
fontSize: 15,
lineHeight: 23,
marginTop: 10,
},
grid: {
flexDirection: "row",
gap: 10,
marginBottom: 16,
},
metric: {
flex: 1,
backgroundColor: "#0C1B31",
borderRadius: 20,
padding: 14,
borderWidth: 1,
borderColor: "rgba(216,194,138,0.22)",
},
metricValue: {
color: "#FFFFFF",
fontSize: 26,
fontWeight: "900",
},
metricLabel: {
color: "#D8C28A",
marginTop: 4,
fontSize: 12,
fontWeight: "800",
},
actions: {
gap: 10,
marginBottom: 16,
},
primaryButton: {
backgroundColor: "#D8C28A",
borderRadius: 18,
paddingVertical: 15,
paddingHorizontal: 16,
},
primaryButtonText: {
color: "#08111F",
fontWeight: "900",
textAlign: "center",
fontSize: 15,
},
secondaryButton: {
backgroundColor: "rgba(216,194,138,0.10)",
borderColor: "rgba(216,194,138,0.25)",
borderWidth: 1,
borderRadius: 18,
paddingVertical: 14,
paddingHorizontal: 16,
},
secondaryButtonText: {
color: "#FFF7DE",
fontWeight: "900",
textAlign: "center",
},
list: {
gap: 12,
},
alertCard: {
borderRadius: 22,
padding: 16,
borderWidth: 1,
},
gold: {
backgroundColor: "#1F1B10",
borderColor: "rgba(216,194,138,0.55)",
},
blue: {
backgroundColor: "#10243F",
borderColor: "rgba(150,200,255,0.35)",
},
green: {
backgroundColor: "#10261B",
borderColor: "rgba(180,235,205,0.35)",
},
quiet: {
backgroundColor: "#101A2C",
borderColor: "rgba(255,255,255,0.12)",
},
alertTop: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
gap: 10,
},
alertTitle: {
color: "#FFFFFF",
fontWeight: "900",
fontSize: 18,
flex: 1,
},
badge: {
color: "#08111F",
backgroundColor: "#FFF7DE",
paddingHorizontal: 9,
paddingVertical: 4,
borderRadius: 999,
fontSize: 11,
fontWeight: "900",
},
alertBody: {
color: "#EAF1FF",
lineHeight: 22,
marginTop: 10,
},
alertMeta: {
color: "#D8C28A",
marginTop: 10,
fontWeight: "900",
fontSize: 12,
},
emptyCard: {
backgroundColor: "#0C1B31",
borderRadius: 22,
padding: 18,
borderWidth: 1,
borderColor: "rgba(216,194,138,0.18)",
gap: 10,
},
emptyTitle: {
color: "#FFFFFF",
fontWeight: "900",
fontSize: 18,
},
emptyText: {
color: "#EAF1FF",
lineHeight: 21,
},
errorCard: {
backgroundColor: "#351515",
borderRadius: 22,
padding: 18,
borderWidth: 1,
borderColor: "rgba(255,190,190,0.35)",
},
errorTitle: {
color: "#FFFFFF",
fontWeight: "900",
fontSize: 18,
},
errorText: {
color: "#FFD7D7",
marginTop: 8,
lineHeight: 21,
},
note: {
color: "#FFD7D7",
marginTop: 10,
fontSize: 12,
opacity: 0.85,
},
footer: {
marginTop: 18,
padding: 16,
borderRadius: 20,
backgroundColor: "rgba(255,255,255,0.05)",
},
footerTitle: {
color: "#FFFFFF",
fontWeight: "900",
marginBottom: 6,
},
footerText: {
color: "#D8C28A",
lineHeight: 20,
fontSize: 12,
},
});
