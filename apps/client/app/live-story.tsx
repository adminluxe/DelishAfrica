import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useEffect, useMemo, useState } from "react";
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
total?: number;
amount?: number;
currency?: string;
createdAt?: string;
updatedAt?: string;
deliveryAddress?: string;
items?: Array<{
id?: string;
name?: string;
title?: string;
quantity?: number;
price?: number;
amount?: number;
}>;
timeline?: Array<{
status?: string;
label?: string;
note?: string;
at?: string;
changedAt?: string;
}>;
};

const API_BASE_URL =
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me";

const STATUS_ORDER = ["pending", "accepted", "ready", "picked_up", "delivered"];

const STORY_STEPS = [
{
key: "pending",
label: "Commande envoyée",
title: "Le signal part en cuisine.",
text: "Votre commande est transmise au restaurant. La cuisine reçoit le signal et prépare le premier geste.",
},
{
key: "accepted",
label: "Cuisine éveillée",
title: "La cuisine entre en scène.",
text: "Le restaurant confirme la commande. La préparation devient le cœur de l’expérience.",
},
{
key: "ready",
label: "Prête au départ",
title: "Le plat attend son coursier.",
text: "Votre plat est prêt. La passerelle entre la cuisine et la livraison s’ouvre.",
},
{
key: "picked_up",
label: "En route",
title: "La mission est lancée.",
text: "Le coursier transporte la commande. Le dernier segment rapproche les saveurs de la table.",
},
{
key: "delivered",
label: "Livrée",
title: "Le voyage touche à sa porte.",
text: "La commande est livrée. Le voyage s’achève, le moment peut commencer.",
},
];

function statusOf(order?: DemoOrder): string {
return String(order?.status || "pending").toLowerCase();
}

function statusIndex(status?: string): number {
const idx = STATUS_ORDER.indexOf(String(status || "pending").toLowerCase());
return idx >= 0 ? idx : 0;
}

function priority(status?: string): number {
const s = String(status || "").toLowerCase();
if (s === "picked_up") return 1;
if (s === "ready") return 2;
if (s === "accepted") return 3;
if (s === "pending") return 4;
if (s === "delivered") return 5;
return 9;
}

function orderKey(order?: DemoOrder): string {
return String(order?.publicId || order?.orderId || order?.id || "Commande");
}

function shortId(order?: DemoOrder): string {
const id = orderKey(order);
if (id.length <= 16) return id;
return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

function restaurantOf(order?: DemoOrder): string {
return String(order?.restaurantName || order?.merchantName || order?.restaurant || "Thieyp");
}

function itemOf(order?: DemoOrder): string {
const first = Array.isArray(order?.items) ? order?.items?.[0] : undefined;
return String(first?.name || first?.title || "Commande DelishAfrica®");
}

function amountOf(order?: DemoOrder): string {
const raw = Number(order?.total ?? order?.amount ?? 0);
const euros = raw > 100 ? raw / 100 : raw;
try {
return new Intl.NumberFormat("fr-BE", {
style: "currency",
currency: "EUR",
minimumFractionDigits: 2,
maximumFractionDigits: 2,
}).format(euros);
} catch {
return `${euros.toFixed(2).replace(".", ",")} €`;
}
}

function etaOf(order?: DemoOrder): string {
const s = statusOf(order);
if (s === "pending") return "38 min";
if (s === "accepted") return "34 min";
if (s === "ready") return "22 min";
if (s === "picked_up") return "12 min";
if (s === "delivered") return "Livrée";
return "En cours";
}

function etaUnit(order?: DemoOrder): string {
 return statusOf(order) === "delivered" ? "livrée" : "min";
}

function etaValueOnly(order?: DemoOrder): string {
 const value = etaOf(order);
 return value.replace(/\s*min$/i, "").trim();
}

function storyPulse(order?: DemoOrder): string {
const s = statusOf(order);
if (s === "pending") return "Le restaurant reçoit le signal.";
if (s === "accepted") return "La cuisine donne vie à l’assiette.";
if (s === "ready") return "Le plat attend le relais du coursier.";
if (s === "picked_up") return "Le coursier rapproche la commande de vous.";
if (s === "delivered") return "La livraison est arrivée.";
return "Le suivi reste actif.";
}

function storyTitle(order?: DemoOrder): string {
const s = statusOf(order);
if (s === "pending") return "Votre commande vient d’entrer dans le voyage.";
if (s === "accepted") return "La cuisine est en mouvement.";
if (s === "ready") return "Le relais livraison s’ouvre.";
if (s === "picked_up") return "Le dernier trajet est lancé.";
if (s === "delivered") return "Le voyage est arrivé.";
return "Votre suivi reste vivant.";
}

function timelineNote(order: DemoOrder, key: string): string | undefined {
const found = Array.isArray(order.timeline)
? order.timeline.find((entry) => String(entry.status || entry.label || "").toLowerCase() === key)
: undefined;
return found?.note || found?.label;
}

async function readOrders(): Promise<DemoOrder[]> {
const res = await daOrdersFetch(`${API_BASE_URL}/api/v1/orders/demo/list`, {
method: "POST",
headers: { "Content-Type": "application/json", Accept: "application/json" },
body: JSON.stringify({ scope: "client-live-story-v1-readonly" }),
});

const text = await res.text();
let json: any = {};
try {
json = text ? JSON.parse(text) : {};
} catch {
throw new Error(`Réponse suivi illisible (${res.status}).`);
}

if (!res.ok) {
throw new Error(json?.message || json?.error || `Suivi indisponible (${res.status}).`);
}

const list = json?.orders || json?.data?.orders || json?.items || [];
return Array.isArray(list) ? list : [];
}

function StoryRail({ order }: { order: DemoOrder }) {
const current = statusIndex(statusOf(order));

return (
<View style={styles.storyRail}>
{STORY_STEPS.map((step, index) => {
const done = index <= current;
const active = index === current;
const note = timelineNote(order, step.key);

return (
<View key={step.key} style={styles.storyStep}>
<View style={[styles.storyDot, done && styles.storyDotDone]}>
<Text style={done ? styles.storyDotTextDone : styles.storyDotText}>
{done ? "✓" : index + 1}
</Text>
</View>

<View style={[styles.storyBody, active && styles.storyBodyActive]}>
<Text style={[styles.storyLabel, active && styles.storyLabelActive]}>{step.label}</Text>
<Text style={styles.storyStepTitle}>{step.title}</Text>
<Text style={styles.storyText}>{note || step.text}</Text>
</View>
</View>
);
})}
</View>
);
}

export default function LiveStoryScreen() {
const [orders, setOrders] = useState<DemoOrder[]>([]);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [error, setError] = useState<string | null>(null);

const selectedOrder = useMemo(() => {
const sorted = [...orders].sort((a, b) => {
const pa = priority(statusOf(a));
const pb = priority(statusOf(b));
if (pa !== pb) return pa - pb;
return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
});

if (selectedId) {
return sorted.find((order) => orderKey(order) === selectedId) || sorted[0] || null;
}

return sorted[0] || null;
}, [orders, selectedId]);

async function refresh() {
try {
setError(null);
setRefreshing(true);
const next = await readOrders();
setOrders(next);
} catch (err) {
setError(err instanceof Error ? err.message : "Live Story momentanément indisponible.");
} finally {
setLoading(false);
setRefreshing(false);
}
}

useEffect(() => {
refresh();
}, []);

const activeCount = orders.filter((order) => statusOf(order) !== "delivered").length;
const currentStatus = statusOf(selectedOrder || undefined);

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.content}
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#FFD166" />}
showsVerticalScrollIndicator={false}
>
<View style={styles.hero}>
<Text style={styles.brand}>DELISHAFRICA®</Text>
<Text style={styles.kicker}>LIVE STORY TRACKING</Text>
<Text style={styles.title}>Votre commande devient un voyage vivant.</Text>
<Text style={styles.subtitle}>
Cuisine, préparation, coursier et arrivée : chaque minute devient lisible, rassurante et vivante.
</Text>
</View>

<View style={styles.signalCard}>
<View style={styles.signalRow}>
<View style={styles.signalBox}>
<Text style={styles.signalValue}>{orders.length}</Text>
<Text style={styles.signalLabel}>total</Text>
</View>
<View style={styles.signalBox}>
<Text style={styles.signalValue}>{activeCount}</Text>
<Text style={styles.signalLabel}>actives</Text>
</View>
<View style={styles.signalBox}>
<Text style={styles.signalValue}>{etaValueOnly(selectedOrder || undefined)}</Text>
<Text style={styles.signalLabel}>{etaUnit(selectedOrder || undefined)}</Text>
</View>
</View>
</View>

<Pressable style={styles.refreshButton} onPress={refresh}>
{refreshing && !loading ? (
<ActivityIndicator color="#07101E" />
) : (
<Text style={styles.refreshButtonText}>{loading ? "Lecture du voyage…" : "Rafraîchir le voyage"}</Text>
)}
</Pressable>

{error ? (
<View style={styles.errorCard}>
<Text style={styles.errorTitle}>Live Story indisponible</Text>
<Text style={styles.errorText}>{error}</Text>
</View>
) : null}

{selectedOrder ? (
<>
<View style={styles.orderCard}>
<Text style={styles.cardKicker}>HISTOIRE ACTIVE</Text>
<Text style={styles.orderTitle}>{storyTitle(selectedOrder)}</Text>
<Text style={styles.orderMeta}>
{shortId(selectedOrder)} · {restaurantOf(selectedOrder)} · {amountOf(selectedOrder)}
</Text>

<View style={styles.focusBox}>
<Text style={styles.focusLabel}>Plat repère</Text>
<Text style={styles.focusValue}>{itemOf(selectedOrder)}</Text>
</View>

<View style={styles.focusBox}>
<Text style={styles.focusLabel}>Signal actuel</Text>
<Text style={styles.focusValue}>{storyPulse(selectedOrder)}</Text>
</View>

<View style={styles.statusPill}>
<Text style={styles.statusText}>{currentStatus.toUpperCase()}</Text>
</View>
</View>

<View style={styles.timelineCard}>
<Text style={styles.blockTitle}>Chronique de livraison</Text>
<Text style={styles.blockSubtitle}>
Chaque étape transforme l’attente en lecture claire, chaleureuse et premium.
</Text>
<StoryRail order={selectedOrder} />
</View>

<View style={styles.recentCard}>
<Text style={styles.blockTitle}>Stories récentes</Text>
<Text style={styles.blockSubtitle}>Touchez une commande pour changer de récit.</Text>

{orders.slice(0, 5).map((order) => {
const key = orderKey(order);
const selected = key === orderKey(selectedOrder);

return (
<Pressable
key={key}
style={[styles.recentRow, selected && styles.recentRowSelected]}
onPress={() => setSelectedId(key)}
>
<View style={{ flex: 1 }}>
<Text style={styles.recentId}>{shortId(order)}</Text>
<Text style={styles.recentText}>{restaurantOf(order)} · {statusOf(order)}</Text>
</View>
<Text style={styles.recentArrow}>{selected ? "✓" : "→"}</Text>
</Pressable>
);
})}
</View>
</>
) : (
<View style={styles.emptyCard}>
<Text style={styles.emptyTitle}>Aucune histoire active</Text>
<Text style={styles.emptyText}>
Les prochaines commandes DelishAfrica apparaîtront ici sous forme de récit de livraison.
</Text>
</View>
)}

<Pressable style={styles.primaryButton} onPress={() => router.push("/live-tracking" as any)}>
<Text style={styles.primaryButtonText}>Voir le suivi intelligent</Text>
</Pressable>

<Pressable style={styles.secondaryButton} onPress={() => router.push("/order-tracking" as any)}>
<Text style={styles.secondaryButtonText}>Suivi classique</Text>
</Pressable>

<Pressable style={styles.ghostButton} onPress={() => router.back()}>
<Text style={styles.ghostButtonText}>Retour</Text>
</Pressable>

<Text style={styles.footer}>Live Story · suivi enrichi · aucun paiement déclenché · aucune action automatique.</Text>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(98, 202, 255, 0.020)", borderWidth: 1, borderColor: "rgba(220, 245, 255, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(218, 246, 255, 0.038)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(88, 211, 255, 0.020)", borderWidth: 1, borderColor: "rgba(200, 242, 255, 0.050)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 242, 255, 0.040)" },
safe: {
flex: 1,
backgroundColor: "#050915",
},
content: {
paddingHorizontal: 18,
paddingTop: 12,
paddingBottom: 42,
gap: 14,
},
hero: {
backgroundColor: "#101A38",
borderRadius: 34,
padding: 24,
borderWidth: 1,
borderColor: "rgba(255,209,102,0.28)",
},
brand: {
color: "#FFD166",
fontSize: 17,
fontWeight: "900",
letterSpacing: 6,
marginBottom: 20,
},
kicker: {
color: "#9BB4FF",
fontSize: 14,
fontWeight: "900",
letterSpacing: 5,
marginBottom: 12,
},
title: {
color: "#FFF7E7",
fontSize: 38,
lineHeight: 47,
fontWeight: "900",
marginBottom: 16,
},
subtitle: {
color: "#BFC8E8",
fontSize: 18,
lineHeight: 27,
fontWeight: "800",
},
signalCard: {
backgroundColor: "#101A38",
borderRadius: 28,
padding: 16,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
signalRow: {
flexDirection: "row",
gap: 10,
},
signalBox: {
flex: 1,
backgroundColor: "#182441",
borderRadius: 22,
padding: 11,
},
signalValue: {
color: "#FFFFFF",
fontSize: 24,
fontWeight: "900",
},
signalLabel: {
color: "#BFC8E8",
fontSize: 11,
fontWeight: "900",
letterSpacing: 1.2,
textTransform: "uppercase",
marginTop: 4,
},
refreshButton: {
backgroundColor: "#FFD166",
borderRadius: 24,
paddingVertical: 18,
alignItems: "center",
},
refreshButtonText: {
color: "#07101E",
fontSize: 18,
fontWeight: "900",
},
errorCard: {
backgroundColor: "rgba(255,120,120,0.12)",
borderRadius: 24,
padding: 18,
borderWidth: 1,
borderColor: "rgba(255,120,120,0.34)",
},
errorTitle: {
color: "#FFD6D6",
fontSize: 20,
fontWeight: "900",
},
errorText: {
color: "#FFD6D6",
fontSize: 15,
lineHeight: 22,
fontWeight: "800",
marginTop: 6,
},
orderCard: {
backgroundColor: "#FFF5DE",
borderRadius: 34,
padding: 24,
},
cardKicker: {
color: "#7A570E",
fontSize: 13,
fontWeight: "900",
letterSpacing: 5,
marginBottom: 12,
},
orderTitle: {
color: "#07101E",
fontSize: 34,
lineHeight: 42,
fontWeight: "900",
},
orderMeta: {
color: "rgba(7,16,30,0.64)",
fontSize: 17,
lineHeight: 25,
fontWeight: "800",
marginTop: 12,
},
focusBox: {
backgroundColor: "rgba(7,16,30,0.08)",
borderRadius: 24,
padding: 16,
marginTop: 14,
},
focusLabel: {
color: "#7A570E",
fontSize: 12,
fontWeight: "900",
letterSpacing: 3,
textTransform: "uppercase",
marginBottom: 7,
},
focusValue: {
color: "#07101E",
fontSize: 20,
lineHeight: 27,
fontWeight: "900",
},
statusPill: {
alignSelf: "flex-start",
backgroundColor: "#07101E",
borderRadius: 999,
paddingHorizontal: 16,
paddingVertical: 9,
marginTop: 16,
},
statusText: {
color: "#FFD166",
fontSize: 12,
fontWeight: "900",
letterSpacing: 2,
},
timelineCard: {
backgroundColor: "#101A38",
borderRadius: 34,
padding: 22,
borderWidth: 1,
borderColor: "rgba(155,180,255,0.25)",
},
blockTitle: {
color: "#FFFFFF",
fontSize: 28,
fontWeight: "900",
},
blockSubtitle: {
color: "#BFC8E8",
fontSize: 16,
lineHeight: 23,
fontWeight: "800",
marginTop: 8,
},
storyRail: {
marginTop: 18,
gap: 14,
},
storyStep: {
flexDirection: "row",
gap: 12,
},
storyDot: {
width: 34,
height: 34,
borderRadius: 17,
alignItems: "center",
justifyContent: "center",
backgroundColor: "#182441",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
marginTop: 4,
},
storyDotDone: {
backgroundColor: "#FFD166",
borderColor: "#FFD166",
},
storyDotText: {
color: "#BFC8E8",
fontSize: 13,
fontWeight: "900",
},
storyDotTextDone: {
color: "#07101E",
fontSize: 13,
fontWeight: "900",
},
storyBody: {
flex: 1,
backgroundColor: "#182441",
borderRadius: 22,
padding: 15,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
storyBodyActive: {
borderColor: "rgba(255,209,102,0.42)",
backgroundColor: "#1D2B4A",
},
storyLabel: {
color: "#9BB4FF",
fontSize: 12,
fontWeight: "900",
letterSpacing: 2.5,
textTransform: "uppercase",
marginBottom: 7,
},
storyLabelActive: {
color: "#FFD166",
},
storyStepTitle: {
color: "#FFFFFF",
fontSize: 18,
lineHeight: 23,
fontWeight: "900",
},
storyText: {
color: "#BFC8E8",
fontSize: 15,
lineHeight: 22,
fontWeight: "800",
marginTop: 6,
},
recentCard: {
backgroundColor: "#101A38",
borderRadius: 30,
padding: 20,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
recentRow: {
marginTop: 12,
backgroundColor: "#182441",
borderRadius: 20,
padding: 15,
flexDirection: "row",
alignItems: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
},
recentRowSelected: {
borderColor: "rgba(255,209,102,0.52)",
},
recentId: {
color: "#FFFFFF",
fontSize: 18,
fontWeight: "900",
},
recentText: {
color: "#BFC8E8",
fontSize: 14,
lineHeight: 20,
fontWeight: "800",
marginTop: 4,
},
recentArrow: {
color: "#FFD166",
fontSize: 23,
fontWeight: "900",
},
emptyCard: {
backgroundColor: "#101A38",
borderRadius: 30,
padding: 22,
borderWidth: 1,
borderColor: "rgba(255,255,255,0.10)",
},
emptyTitle: {
color: "#FFFFFF",
fontSize: 27,
fontWeight: "900",
},
emptyText: {
color: "#BFC8E8",
fontSize: 16,
lineHeight: 24,
fontWeight: "800",
marginTop: 8,
},
primaryButton: {
backgroundColor: "#FFD166",
borderRadius: 26,
paddingVertical: 19,
alignItems: "center",
},
primaryButtonText: {
color: "#07101E",
fontSize: 19,
fontWeight: "900",
},
secondaryButton: {
backgroundColor: "#182033",
borderRadius: 26,
paddingVertical: 18,
alignItems: "center",
},
secondaryButtonText: {
color: "#FFFFFF",
fontSize: 18,
fontWeight: "900",
},
ghostButton: {
borderRadius: 26,
paddingVertical: 18,
alignItems: "center",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.14)",
},
ghostButtonText: {
color: "#BFC8E8",
fontSize: 17,
fontWeight: "900",
},
footer: {
color: "rgba(191,200,232,0.72)",
textAlign: "center",
fontSize: 13,
lineHeight: 19,
fontWeight: "800",
},
});
