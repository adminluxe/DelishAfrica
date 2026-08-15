import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
Alert,
RefreshControl,
SafeAreaView,
ScrollView,
StyleSheet,
Text,
TouchableOpacity,
View,
} from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";

type GeoPoint = {
latitude: number;
longitude: number;
};

type DemoOrder = {
id?: string;
orderId?: string;
publicId?: string;
status?: string;
restaurant?: string;
restaurantName?: string;
merchantName?: string;
partnerName?: string;
client?: string;
customerName?: string;
customer?: {
name?: string;
address?: string;
city?: string;
};
deliveryAddress?: string;
customerAddress?: string;
total?: number;
amount?: number;
items?: Array<{
name?: string;
title?: string;
quantity?: number;
qty?: number;
price?: number;
amount?: number;
}>;
timeline?: Array<{
status?: string;
at?: string;
label?: string;
note?: string;
}>;
createdAt?: string;
updatedAt?: string;
};

type MissionStatus = "pending" | "accepted" | "ready" | "picked_up" | "unknown";

type Mission = {
id: string;
publicId: string;
status: MissionStatus;
title: string;
restaurantName: string;
clientName: string;
restaurantAddress: string;
clientAddress: string;
restaurantPoint: GeoPoint;
clientPoint: GeoPoint;
updatedAt?: string;
createdAt?: string;
};

type EtaState = {
current?: GeoPoint;
permission?: Location.PermissionStatus | "unknown";
accuracy?: number | null;
distanceToRestaurantKm: number;
distanceRestaurantToClientKm: number;
distanceToClientKm: number;
totalDistanceKm: number;
etaToRestaurantMin: number;
etaRestaurantToClientMin: number;
etaToClientMin: number;
etaTotalMin: number;
mode: "pickup_then_delivery" | "direct_to_client" | "base_only";
capturedAt?: string;
};

type MissionState = {
activeMission: Mission | null;
lastCompletedMission: Mission | null;
activeCount: number;
completedCount: number;
totalCount: number;
source: "api" | "empty" | "error";
};

const API_BASE_URL = normalizeApiBaseUrl(
process.env.EXPO_PUBLIC_API_BASE_URL ||
process.env.EXPO_PUBLIC_API_URL ||
"https://api.delishafrica.me/api/v1"
);

const THIEYP_POINT: GeoPoint = {
latitude: 50.8359,
longitude: 4.3717,
};

const DEFAULT_CLIENT_POINT: GeoPoint = {
latitude: 50.8195,
longitude: 4.4302,
};

const AVG_CITY_SPEED_KMH = 18;
const PICKUP_BUFFER_MIN = 4;

function normalizeApiBaseUrl(raw: string) {
const clean = String(raw || "").trim().replace(/\/+$/, "");
if (!clean) return "https://api.delishafrica.me/api/v1";
if (clean.endsWith("/api/v1")) return clean;
if (clean.endsWith("/api")) return `${clean}/v1`;
return `${clean}/api/v1`;
}

function toRad(value: number) {
return (value * Math.PI) / 180;
}

function distanceKm(a: GeoPoint, b: GeoPoint) {
const earthKm = 6371;
const dLat = toRad(b.latitude - a.latitude);
const dLon = toRad(b.longitude - a.longitude);
const lat1 = toRad(a.latitude);
const lat2 = toRad(b.latitude);

const h =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

return 2 * earthKm * Math.asin(Math.sqrt(h));
}

function etaMinutes(km: number) {
return Math.max(1, Math.round((km / AVG_CITY_SPEED_KMH) * 60));
}

function formatKm(value: number) {
return `${value.toFixed(1).replace(".", ",")} km`;
}

function formatMin(value: number) {
if (value < 60) return `${value} min`;
const h = Math.floor(value / 60);
const m = value % 60;
return m ? `${h} h ${m} min` : `${h} h`;
}

function publicIdOf(order: DemoOrder) {
return String(order.publicId || order.orderId || order.id || "DA-MISSION");
}

function titleOf(order: DemoOrder) {
const firstItem = Array.isArray(order.items) ? order.items[0] : undefined;
return String(firstItem?.name || firstItem?.title || "Mission DelishAfrica®");
}

function restaurantOf(order: DemoOrder) {
return String(order.restaurantName || order.restaurant || order.merchantName || order.partnerName || "Thieyp");
}

function clientOf(order: DemoOrder) {
return String(order.customerName || order.customer?.name || order.client || "Client DelishAfrica®");
}

function clientAddressOf(order: DemoOrder) {
const nested = [order.customer?.address, order.customer?.city].filter(Boolean).join(", ");
return String(order.deliveryAddress || order.customerAddress || nested || "Adresse client à confirmer sur la mission");
}

function normalizeOrdersPayload(payload: any): DemoOrder[] {
if (Array.isArray(payload)) return payload;
if (Array.isArray(payload?.orders)) return payload.orders;
if (Array.isArray(payload?.items)) return payload.items;
if (Array.isArray(payload?.data)) return payload.data;
if (Array.isArray(payload?.result)) return payload.result;
return [];
}

function normalizeStatus(status?: string): MissionStatus {
const s = String(status || "").toLowerCase();
if (s === "pending") return "pending";
if (s === "accepted") return "accepted";
if (s === "ready") return "ready";
if (s === "picked_up") return "picked_up";
return "unknown";
}

function isActiveStatus(status?: string) {
const s = String(status || "").toLowerCase();
return ["picked_up", "ready", "accepted", "pending"].includes(s);
}

function isCompletedStatus(status?: string) {
const s = String(status || "").toLowerCase();
return ["delivered", "cancelled", "canceled"].includes(s);
}

function missionPriority(status?: string) {
const s = String(status || "").toLowerCase();
if (s === "picked_up") return 1;
if (s === "ready") return 2;
if (s === "accepted") return 3;
if (s === "pending") return 4;
return 99;
}

function missionFromOrder(order: DemoOrder): Mission {
return {
id: String(order.id || order.orderId || order.publicId || publicIdOf(order)),
publicId: publicIdOf(order),
status: normalizeStatus(order.status),
title: titleOf(order),
restaurantName: restaurantOf(order),
clientName: clientOf(order),
restaurantAddress: "Rue Longue Vie 46, Ixelles",
clientAddress: clientAddressOf(order),
restaurantPoint: THIEYP_POINT,
clientPoint: DEFAULT_CLIENT_POINT,
updatedAt: order.updatedAt,
createdAt: order.createdAt,
};
}

function statusLabel(status: string) {
const s = String(status || "").toLowerCase();
if (s === "pending") return "Reçue";
if (s === "accepted") return "Acceptée";
if (s === "ready") return "À récupérer";
if (s === "picked_up") return "En route client";
if (s === "delivered") return "Livrée";
if (s === "cancelled" || s === "canceled") return "Annulée";
return "Mission";
}

function actionHint(status: string) {
const s = String(status || "").toLowerCase();
if (s === "pending") return "Commande reçue. Attente validation restaurant.";
if (s === "accepted") return "Restaurant en préparation. Prépare-toi à partir.";
if (s === "ready") return "Mission prête. Va récupérer la commande.";
if (s === "picked_up") return "Commande récupérée. Cap vers le client.";
return "Mission en cours.";
}

function phaseLabel(status: string) {
const s = String(status || "").toLowerCase();
if (s === "picked_up") return "Livraison";
if (s === "ready") return "Retrait";
if (s === "accepted") return "Préparation";
if (s === "pending") return "Réception";
return "Terrain";
}

function sortByFreshness(a: DemoOrder, b: DemoOrder) {
const ad = Date.parse(String(a.updatedAt || a.createdAt || ""));
const bd = Date.parse(String(b.updatedAt || b.createdAt || ""));
if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad;
if (Number.isFinite(bd)) return 1;
if (Number.isFinite(ad)) return -1;
return 0;
}

function buildBaseEta(mission: Mission): EtaState {
const restaurantToClient = distanceKm(mission.restaurantPoint, mission.clientPoint);
const restaurantToClientMin = etaMinutes(restaurantToClient);
const isPickedUp = mission.status === "picked_up";

return {
permission: "unknown",
distanceToRestaurantKm: 0,
distanceRestaurantToClientKm: restaurantToClient,
distanceToClientKm: isPickedUp ? restaurantToClient : 0,
totalDistanceKm: restaurantToClient,
etaToRestaurantMin: 0,
etaRestaurantToClientMin: restaurantToClientMin,
etaToClientMin: isPickedUp ? restaurantToClientMin : 0,
etaTotalMin: restaurantToClientMin + (isPickedUp ? 0 : PICKUP_BUFFER_MIN),
mode: isPickedUp ? "direct_to_client" : "base_only",
};
}

export default function CourierEtaScreen() {
const [loadingLocation, setLoadingLocation] = useState(false);
const [loadingMission, setLoadingMission] = useState(false);
const [missionState, setMissionState] = useState<MissionState>({
activeMission: null,
lastCompletedMission: null,
activeCount: 0,
completedCount: 0,
totalCount: 0,
source: "empty",
});
const [eta, setEta] = useState<EtaState | null>(null);
const [locationError, setLocationError] = useState<string | null>(null);
const [missionError, setMissionError] = useState<string | null>(null);

const activeMission = missionState.activeMission;
const lastCompletedMission = missionState.lastCompletedMission;

const baseEta = useMemo(() => {
if (!activeMission) return null;
return buildBaseEta(activeMission);
}, [activeMission]);

async function loadMissionState() {
setLoadingMission(true);
setMissionError(null);

try {
const res = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({}),
});

const text = await res.text();
let payload: any = null;

try {
payload = text ? JSON.parse(text) : null;
} catch {
payload = null;
}

if (!res.ok) {
throw new Error(`Lecture missions impossible (${res.status})`);
}

const orders = normalizeOrdersPayload(payload);

const activeOrders = orders
.filter((order) => isActiveStatus(order.status))
.sort((a, b) => {
const priority = missionPriority(a.status) - missionPriority(b.status);
return priority !== 0 ? priority : sortByFreshness(a, b);
});

const completedOrders = orders
.filter((order) => isCompletedStatus(order.status))
.sort(sortByFreshness);

const selectedActive = activeOrders[0] ? missionFromOrder(activeOrders[0]) : null;
const selectedCompleted = completedOrders[0] ? missionFromOrder(completedOrders[0]) : null;

setMissionState({
activeMission: selectedActive,
lastCompletedMission: selectedCompleted,
activeCount: activeOrders.length,
completedCount: completedOrders.length,
totalCount: orders.length,
source: "api",
});

setEta(selectedActive ? buildBaseEta(selectedActive) : null);
} catch (err) {
const message = err instanceof Error ? err.message : "Lecture mission impossible.";
setMissionState({
activeMission: null,
lastCompletedMission: null,
activeCount: 0,
completedCount: 0,
totalCount: 0,
source: "error",
});
setEta(null);
setMissionError(message);
} finally {
setLoadingMission(false);
}
}

async function calculateFromCurrentPosition() {
if (!activeMission || !baseEta) {
Alert.alert("ETA mission", "Aucune mission active à estimer pour le moment.");
return;
}

setLoadingLocation(true);
setLocationError(null);

try {
const permission = await Location.requestForegroundPermissionsAsync();

if (permission.status !== Location.PermissionStatus.GRANTED) {
setEta({
...baseEta,
permission: permission.status,
capturedAt: new Date().toISOString(),
});

setLocationError("Permission localisation refusée. L’estimation reste basée sur le trajet connu.");
return;
}

const position = await Location.getCurrentPositionAsync({
accuracy: Location.Accuracy.Balanced,
});

const current = {
latitude: position.coords.latitude,
longitude: position.coords.longitude,
};

const restaurantToClient = distanceKm(activeMission.restaurantPoint, activeMission.clientPoint);
const restaurantToClientMin = etaMinutes(restaurantToClient);

if (activeMission.status === "picked_up") {
const directToClient = distanceKm(current, activeMission.clientPoint);

setEta({
current,
permission: permission.status,
accuracy: position.coords.accuracy,
distanceToRestaurantKm: 0,
distanceRestaurantToClientKm: restaurantToClient,
distanceToClientKm: directToClient,
totalDistanceKm: directToClient,
etaToRestaurantMin: 0,
etaRestaurantToClientMin: restaurantToClientMin,
etaToClientMin: etaMinutes(directToClient),
etaTotalMin: etaMinutes(directToClient),
mode: "direct_to_client",
capturedAt: new Date().toISOString(),
});

return;
}

const toRestaurant = distanceKm(current, activeMission.restaurantPoint);
const toRestaurantMin = etaMinutes(toRestaurant);
const totalDistance = toRestaurant + restaurantToClient;
const totalMin = toRestaurantMin + restaurantToClientMin + PICKUP_BUFFER_MIN;

setEta({
current,
permission: permission.status,
accuracy: position.coords.accuracy,
distanceToRestaurantKm: toRestaurant,
distanceRestaurantToClientKm: restaurantToClient,
distanceToClientKm: 0,
totalDistanceKm: totalDistance,
etaToRestaurantMin: toRestaurantMin,
etaRestaurantToClientMin: restaurantToClientMin,
etaToClientMin: 0,
etaTotalMin: totalMin,
mode: "pickup_then_delivery",
capturedAt: new Date().toISOString(),
});
} catch (err) {
const message = err instanceof Error ? err.message : "Erreur géolocalisation inconnue.";
setLocationError(message);
Alert.alert("ETA mission", message);
} finally {
setLoadingLocation(false);
}
}

useEffect(() => {
loadMissionState();
}, []);

const etaToShow = eta ?? baseEta;
const hasLivePosition = Boolean(etaToShow?.current);
const isPickedUp = activeMission?.status === "picked_up";

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.container}
refreshControl={<RefreshControl refreshing={loadingMission} onRefresh={loadMissionState} />}
>
<View style={styles.header}>
<Text style={styles.kicker}>DELISHAFRICA® · COURIER</Text>
<Text style={styles.title}>ETA mission</Text>
<Text style={styles.subtitle}>
Une vue terrain claire : mission active, estimation segmentée et décisions maîtrisées.
</Text>
</View>

<View style={styles.summaryRow}>
<View style={styles.summaryPill}>
<Text style={styles.summaryNumber}>{missionState.activeCount}</Text>
<Text style={styles.summaryLabel}>actives</Text>
</View>
<View style={styles.summaryPill}>
<Text style={styles.summaryNumber}>{missionState.completedCount}</Text>
<Text style={styles.summaryLabel}>terminées</Text>
</View>
<View style={styles.summaryPill}>
<Text style={styles.summaryNumber}>{missionState.totalCount}</Text>
<Text style={styles.summaryLabel}>total</Text>
</View>
</View>

{activeMission ? (
<>
<View style={styles.card}>
<View style={styles.rowBetween}>
<Text style={styles.cardLabel}>Mission active</Text>
<Text style={styles.phaseBadge}>{phaseLabel(activeMission.status)}</Text>
</View>

<Text style={styles.orderTitle}>
{activeMission.title} · {activeMission.restaurantName}
</Text>

<View style={styles.metaRow}>
<Text style={styles.publicId}>{activeMission.publicId}</Text>
<Text style={styles.statusPill}>{statusLabel(activeMission.status)}</Text>
</View>

<Text style={styles.hint}>{actionHint(activeMission.status)}</Text>

<View style={styles.addressBox}>
<Text style={styles.addressLabel}>Restaurant</Text>
<Text style={styles.addressText}>
{activeMission.restaurantName} · {activeMission.restaurantAddress}
</Text>
</View>

<View style={styles.addressBox}>
<Text style={styles.addressLabel}>Client</Text>
<Text style={styles.addressText}>
{activeMission.clientName} · {activeMission.clientAddress}
</Text>
</View>
</View>

{etaToShow ? (
<>
<View style={styles.heroCard}>
<Text style={styles.cardLabel}>
{isPickedUp ? "ETA vers client" : "ETA opérationnelle"}
</Text>
<Text style={styles.etaValue}>{formatMin(etaToShow.etaTotalMin)}</Text>
<Text style={styles.small}>
Distance prise en compte : {formatKm(etaToShow.totalDistanceKm)}
</Text>
<Text style={styles.heroHint}>
{hasLivePosition
? "Position coursier intégrée."
: "Base mission affichée. Calcule avec ta position pour affiner."}
</Text>
</View>

<View style={styles.timelineCard}>
<Text style={styles.cardLabel}>Découpage mission</Text>

{isPickedUp ? (
<>
<View style={styles.stepLine}>
<View style={styles.stepDotActive} />
<View style={styles.stepBody}>
<Text style={styles.stepTitle}>En route vers le client</Text>
<Text style={styles.stepText}>
{etaToShow.distanceToClientKm > 0
? `${formatKm(etaToShow.distanceToClientKm)} · ${formatMin(etaToShow.etaToClientMin)}`
: "Position requise pour l’estimation directe."}
</Text>
</View>
</View>

<View style={styles.stepLine}>
<View style={styles.stepDotMuted} />
<View style={styles.stepBody}>
<Text style={styles.stepTitle}>Référence restaurant → client</Text>
<Text style={styles.stepText}>
{formatKm(etaToShow.distanceRestaurantToClientKm)} · {formatMin(etaToShow.etaRestaurantToClientMin)}
</Text>
</View>
</View>
</>
) : (
<>
<View style={styles.stepLine}>
<View style={styles.stepDotActive} />
<View style={styles.stepBody}>
<Text style={styles.stepTitle}>Coursier → restaurant</Text>
<Text style={styles.stepText}>
{etaToShow.distanceToRestaurantKm > 0
? `${formatKm(etaToShow.distanceToRestaurantKm)} · ${formatMin(etaToShow.etaToRestaurantMin)}`
: "Position requise pour ce segment."}
</Text>
</View>
</View>

<View style={styles.stepLine}>
<View style={styles.stepDot} />
<View style={styles.stepBody}>
<Text style={styles.stepTitle}>Restaurant → client</Text>
<Text style={styles.stepText}>
{formatKm(etaToShow.distanceRestaurantToClientKm)} · {formatMin(etaToShow.etaRestaurantToClientMin)}
</Text>
</View>
</View>

<View style={styles.stepLine}>
<View style={styles.stepDotMuted} />
<View style={styles.stepBody}>
<Text style={styles.stepTitle}>Marge pickup</Text>
<Text style={styles.stepText}>{PICKUP_BUFFER_MIN} min · contrôle commande</Text>
</View>
</View>
</>
)}
</View>

<View style={styles.card}>
<Text style={styles.cardLabel}>Localisation</Text>
<Text style={styles.statusText}>Permission : {etaToShow.permission ?? "unknown"}</Text>
<Text style={styles.statusText}>
Précision :{" "}
{typeof etaToShow.accuracy === "number"
? `${Math.round(etaToShow.accuracy)} m`
: "non disponible"}
</Text>
<Text style={styles.statusText}>
Mise à jour :{" "}
{etaToShow.capturedAt
? new Date(etaToShow.capturedAt).toLocaleTimeString()
: "pas encore calculée"}
</Text>
{locationError ? <Text style={styles.error}>{locationError}</Text> : null}
</View>
</>
) : null}

<TouchableOpacity
activeOpacity={0.85}
style={[styles.primaryButton, loadingLocation && styles.disabledButton]}
onPress={calculateFromCurrentPosition}
disabled={loadingLocation}
>
{loadingLocation ? (
<ActivityIndicator />
) : (
<Text style={styles.primaryButtonText}>Calculer avec ma position</Text>
)}
</TouchableOpacity>
</>
) : (
<View style={styles.emptyCard}>
<Text style={styles.cardLabel}>Aucune mission active</Text>
<Text style={styles.emptyTitle}>Tout est livré pour le moment.</Text>
<Text style={styles.small}>
L’ETA s’active dès qu’une commande est reçue, acceptée, prête ou en route.
</Text>

{lastCompletedMission ? (
<View style={styles.historyBox}>
<Text style={styles.historyLabel}>Dernière mission terminée</Text>
<Text style={styles.historyTitle}>
{lastCompletedMission.title} · {lastCompletedMission.restaurantName}
</Text>
<Text style={styles.small}>
{lastCompletedMission.publicId} · {statusLabel(lastCompletedMission.status)}
</Text>
</View>
) : null}

{missionError ? <Text style={styles.error}>{missionError}</Text> : null}
</View>
)}

<TouchableOpacity
activeOpacity={0.85}
style={styles.secondaryButton}
onPress={loadMissionState}
disabled={loadingMission}
>
<Text style={styles.secondaryButtonText}>
{loadingMission ? "Actualisation…" : "Actualiser les missions"}
</Text>
</TouchableOpacity>

<TouchableOpacity
activeOpacity={0.85}
style={styles.secondaryButton}
onPress={() => router.push("/orders" as any)}
>
<Text style={styles.secondaryButtonText}>Retour Mission Cockpit</Text>
</TouchableOpacity>

<TouchableOpacity activeOpacity={0.85} style={styles.ghostButton} onPress={() => router.back()}>
<Text style={styles.ghostButtonText}>Retour</Text>
</TouchableOpacity>

<Text style={styles.footer}>
ETA opérationnelle · mission active priorisée · historique séparé · supervision terrain.
</Text>
</ScrollView>
</SafeAreaView>
);
}

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(220, 255, 240, 0.052)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(212, 255, 236, 0.014)", borderWidth: 1, borderColor: "rgba(224, 255, 241, 0.040)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(200, 255, 232, 0.052)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 255, 238, 0.042)" },
safe: {
flex: 1,
backgroundColor: "#061A12",
},
container: {
padding: 20,
paddingBottom: 44,
gap: 16,
},
header: {
paddingTop: 18,
gap: 8,
},
kicker: {
color: "#8EF0B3",
fontSize: 12,
fontWeight: "800",
letterSpacing: 1.2,
},
title: {
color: "#F7FFF9",
fontSize: 32,
fontWeight: "900",
},
subtitle: {
color: "#B8D8C4",
fontSize: 15,
lineHeight: 22,
},
summaryRow: {
flexDirection: "row",
gap: 10,
},
summaryPill: {
flex: 1,
backgroundColor: "rgba(255,255,255,0.07)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.1)",
borderRadius: 18,
padding: 12,
alignItems: "center",
gap: 3,
},
summaryNumber: {
color: "#FFFFFF",
fontSize: 22,
fontWeight: "900",
},
summaryLabel: {
color: "#A9CBB6",
fontSize: 11,
fontWeight: "700",
textTransform: "uppercase",
},
card: {
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
borderRadius: 24,
padding: 18,
gap: 12,
},
heroCard: {
backgroundColor: "#E9FFF0",
borderRadius: 28,
padding: 22,
gap: 8,
},
timelineCard: {
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(142,240,179,0.22)",
borderRadius: 24,
padding: 18,
gap: 14,
},
rowBetween: {
flexDirection: "row",
justifyContent: "space-between",
gap: 12,
alignItems: "center",
},
cardLabel: {
color: "#8EF0B3",
fontSize: 12,
fontWeight: "900",
letterSpacing: 0.9,
textTransform: "uppercase",
},
phaseBadge: {
color: "#061A12",
backgroundColor: "#8EF0B3",
overflow: "hidden",
borderRadius: 999,
paddingHorizontal: 10,
paddingVertical: 5,
fontSize: 11,
fontWeight: "900",
},
orderTitle: {
color: "#FFFFFF",
fontSize: 22,
fontWeight: "900",
lineHeight: 28,
},
metaRow: {
flexDirection: "row",
flexWrap: "wrap",
gap: 10,
alignItems: "center",
},
publicId: {
color: "#DDFBE6",
fontSize: 14,
fontWeight: "800",
},
statusPill: {
color: "#061A12",
backgroundColor: "#F8D36B",
overflow: "hidden",
borderRadius: 999,
paddingHorizontal: 10,
paddingVertical: 5,
fontSize: 12,
fontWeight: "900",
},
hint: {
color: "#DFFBE8",
fontSize: 14,
lineHeight: 20,
fontWeight: "700",
},
addressBox: {
backgroundColor: "rgba(0,0,0,0.18)",
borderRadius: 16,
padding: 12,
gap: 4,
},
addressLabel: {
color: "#8EF0B3",
fontSize: 11,
fontWeight: "900",
textTransform: "uppercase",
},
addressText: {
color: "#EAF9EF",
fontSize: 14,
lineHeight: 20,
fontWeight: "600",
},
etaValue: {
color: "#061A12",
fontSize: 39,
fontWeight: "900",
},
small: {
color: "#B8D8C4",
fontSize: 14,
lineHeight: 20,
},
heroHint: {
color: "#335E43",
fontSize: 13,
lineHeight: 18,
fontWeight: "700",
},
stepLine: {
flexDirection: "row",
gap: 12,
alignItems: "flex-start",
},
stepDotActive: {
width: 13,
height: 13,
borderRadius: 999,
backgroundColor: "#8EF0B3",
marginTop: 4,
},
stepDot: {
width: 13,
height: 13,
borderRadius: 999,
backgroundColor: "#F8D36B",
marginTop: 4,
},
stepDotMuted: {
width: 13,
height: 13,
borderRadius: 999,
backgroundColor: "rgba(255,255,255,0.35)",
marginTop: 4,
},
stepBody: {
flex: 1,
gap: 3,
},
stepTitle: {
color: "#FFFFFF",
fontSize: 15,
fontWeight: "900",
},
stepText: {
color: "#B8D8C4",
fontSize: 13,
lineHeight: 18,
fontWeight: "600",
},
statusText: {
color: "#DFFBE8",
fontSize: 14,
lineHeight: 20,
fontWeight: "600",
},
error: {
color: "#FFD2D2",
fontSize: 13,
lineHeight: 18,
fontWeight: "800",
},
primaryButton: {
minHeight: 58,
borderRadius: 22,
backgroundColor: "#8EF0B3",
alignItems: "center",
justifyContent: "center",
paddingHorizontal: 18,
},
disabledButton: {
opacity: 0.65,
},
primaryButtonText: {
color: "#061A12",
fontSize: 16,
fontWeight: "900",
},
secondaryButton: {
minHeight: 54,
borderRadius: 20,
backgroundColor: "rgba(255,255,255,0.1)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.13)",
alignItems: "center",
justifyContent: "center",
paddingHorizontal: 18,
},
secondaryButtonText: {
color: "#F7FFF9",
fontSize: 15,
fontWeight: "900",
},
ghostButton: {
minHeight: 46,
borderRadius: 18,
alignItems: "center",
justifyContent: "center",
paddingHorizontal: 18,
},
ghostButtonText: {
color: "#B8D8C4",
fontSize: 14,
fontWeight: "800",
},
emptyCard: {
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
borderRadius: 26,
padding: 20,
gap: 12,
},
emptyTitle: {
color: "#FFFFFF",
fontSize: 24,
fontWeight: "900",
},
historyBox: {
marginTop: 8,
backgroundColor: "rgba(0,0,0,0.2)",
borderRadius: 18,
padding: 14,
gap: 5,
},
historyLabel: {
color: "#8EF0B3",
fontSize: 11,
fontWeight: "900",
textTransform: "uppercase",
},
historyTitle: {
color: "#FFFFFF",
fontSize: 16,
fontWeight: "900",
},
footer: {
color: "#6FA780",
fontSize: 12,
textAlign: "center",
lineHeight: 18,
paddingHorizontal: 8,
},
});
