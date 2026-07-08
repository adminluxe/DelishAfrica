import React, { useEffect, useMemo, useState } from "react";
import {
ActivityIndicator,
Alert,
Linking,
Platform,
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
items?: Array<{
name?: string;
title?: string;
quantity?: number;
qty?: number;
}>;
createdAt?: string;
updatedAt?: string;
};

type MissionStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | "unknown";

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
source: "active" | "latest_completed";
};

type GuidanceState = {
permission: string;
accuracy?: number | null;
current?: GeoPoint;
distanceToRestaurantKm: number;
distanceRestaurantToClientKm: number;
distanceToClientKm: number;
etaToRestaurantMin: number;
etaRestaurantToClientMin: number;
etaToClientMin: number;
etaTotalMin: number;
capturedAt?: string;
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

const THIEYP_NAV_LABEL = "Thieyp";
const THIEYP_NAV_ADDRESS = "Rue Longue Vie 46, 1050 Ixelles, Belgique";

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

function normalizeOrdersPayload(payload: any): DemoOrder[] {
if (Array.isArray(payload)) return payload;
if (Array.isArray(payload?.orders)) return payload.orders;
if (Array.isArray(payload?.items)) return payload.items;
if (Array.isArray(payload?.data)) return payload.data;
if (Array.isArray(payload?.result)) return payload.result;
return [];
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
return String(order.deliveryAddress || order.customerAddress || nested || "Adresse client synchronisée");
}

function normalizeStatus(status?: string): MissionStatus {
const s = String(status || "").toLowerCase();
if (s === "pending") return "pending";
if (s === "accepted") return "accepted";
if (s === "ready") return "ready";
if (s === "picked_up") return "picked_up";
if (s === "delivered") return "delivered";
return "unknown";
}

function isActiveStatus(status?: string) {
const s = String(status || "").toLowerCase();
return ["pending", "accepted", "ready", "picked_up"].includes(s);
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

function sortByFreshness(a: DemoOrder, b: DemoOrder) {
const ad = Date.parse(String(a.updatedAt || a.createdAt || ""));
const bd = Date.parse(String(b.updatedAt || b.createdAt || ""));
if (Number.isFinite(ad) && Number.isFinite(bd)) return bd - ad;
if (Number.isFinite(bd)) return 1;
if (Number.isFinite(ad)) return -1;
return 0;
}

function missionFromOrder(order: DemoOrder, source: Mission["source"]): Mission {
return {
id: String(order.id || order.orderId || order.publicId || publicIdOf(order)),
publicId: publicIdOf(order),
status: normalizeStatus(order.status),
title: titleOf(order),
restaurantName: restaurantOf(order),
clientName: clientOf(order),
restaurantAddress: "Rue Longue Vie 46, 1050 Ixelles",
clientAddress: clientAddressOf(order),
restaurantPoint: THIEYP_POINT,
clientPoint: DEFAULT_CLIENT_POINT,
source,
};
}

function statusLabel(status: MissionStatus) {
if (status === "pending") return "Reçue";
if (status === "accepted") return "En préparation";
if (status === "ready") return "À récupérer";
if (status === "picked_up") return "En route client";
if (status === "delivered") return "Livrée";
return "Mission";
}

function encodeDestination(destination: GeoPoint, label: string, address?: string) {
const isThieyp = label.toLowerCase().includes("thieyp");
const value = isThieyp ? THIEYP_NAV_ADDRESS : address || `${destination.latitude},${destination.longitude}`;
return encodeURIComponent(value);
}

function appleMapsUrl(destination: GeoPoint, label: string, address?: string) {
const encodedDestination = encodeDestination(destination, label, address);
const encodedLabel = encodeURIComponent(label || THIEYP_NAV_LABEL);
return `http://maps.apple.com/?daddr=${encodedDestination}&q=${encodedLabel}&dirflg=d`;
}

function googleMapsUrl(destination: GeoPoint, label: string, address?: string) {
const encodedDestination = encodeDestination(destination, label, address);
return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`;
}

function wazeUrl(destination: GeoPoint) {
return `https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`;
}

function previewMapUrl(destination: GeoPoint, label: string, address?: string) {
const encodedDestination = encodeDestination(destination, label, address);
const encodedLabel = encodeURIComponent(label || THIEYP_NAV_LABEL);

if (Platform.OS === "ios") {
return `http://maps.apple.com/?q=${encodedLabel}&address=${encodedDestination}`;
}

return `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`;
}

async function openMapUrl(url: string) {
try {
await Linking.openURL(url);
} catch (err) {
const message = err instanceof Error ? err.message : "Impossible d’ouvrir la carte.";
Alert.alert("Maps & guidage", message);
}
}

function openGuidanceChooser(destination: GeoPoint, label: string, address?: string) {
const isThieyp = label.toLowerCase().includes("thieyp");
const finalAddress = isThieyp ? THIEYP_NAV_ADDRESS : address;

Alert.alert(
"Choisir le guidage",
isThieyp
? "Destination : Thieyp · Rue Longue Vie 46, 1050 Ixelles"
: `Destination : ${label}`,
[
{
text: "Apple Plans",
onPress: () => openMapUrl(appleMapsUrl(destination, label, finalAddress)),
},
{
text: "Google Maps",
onPress: () => openMapUrl(googleMapsUrl(destination, label, finalAddress)),
},
{
text: "Waze",
onPress: () => openMapUrl(wazeUrl(destination)),
},
{
text: "Annuler",
style: "cancel",
},
],
{ cancelable: true }
);
}

function baseGuidance(mission: Mission): GuidanceState {
const restaurantToClient = distanceKm(mission.restaurantPoint, mission.clientPoint);
const restaurantToClientMin = etaMinutes(restaurantToClient);

return {
permission: "non demandée",
distanceToRestaurantKm: 0,
distanceRestaurantToClientKm: restaurantToClient,
distanceToClientKm: mission.status === "picked_up" ? restaurantToClient : 0,
etaToRestaurantMin: 0,
etaRestaurantToClientMin: restaurantToClientMin,
etaToClientMin: mission.status === "picked_up" ? restaurantToClientMin : 0,
etaTotalMin: restaurantToClientMin + (mission.status === "picked_up" ? 0 : PICKUP_BUFFER_MIN),
};
}

export default function CourierRealMapScreen() {
const [loadingMission, setLoadingMission] = useState(false);
const [loadingLocation, setLoadingLocation] = useState(false);
const [mission, setMission] = useState<Mission | null>(null);
const [ordersCount, setOrdersCount] = useState(0);
const [guidance, setGuidance] = useState<GuidanceState | null>(null);
const [error, setError] = useState<string | null>(null);

async function loadMission() {
setLoadingMission(true);
setError(null);

try {
const res = await fetch(`${API_BASE_URL}/orders/demo/list`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({}),
});

const text = await res.text();
const payload = text ? JSON.parse(text) : null;

if (!res.ok) {
throw new Error(`Lecture missions impossible (${res.status})`);
}

const orders = normalizeOrdersPayload(payload);
const active = orders
.filter((order) => isActiveStatus(order.status))
.sort((a, b) => {
const priority = missionPriority(a.status) - missionPriority(b.status);
return priority !== 0 ? priority : sortByFreshness(a, b);
});

const completed = orders.filter((order) => isCompletedStatus(order.status)).sort(sortByFreshness);

const selected = active[0]
? missionFromOrder(active[0], "active")
: completed[0]
? missionFromOrder(completed[0], "latest_completed")
: null;

setOrdersCount(orders.length);
setMission(selected);
setGuidance(selected ? baseGuidance(selected) : null);
} catch (err) {
const message = err instanceof Error ? err.message : "Lecture mission impossible.";
setError(message);
setMission(null);
setGuidance(null);
} finally {
setLoadingMission(false);
}
}

async function calculateLiveGuidance() {
if (!mission) {
Alert.alert("Carte réelle", "Aucune mission disponible pour le guidage.");
return;
}

setLoadingLocation(true);
setError(null);

try {
const permission = await Location.requestForegroundPermissionsAsync();

if (permission.status !== Location.PermissionStatus.GRANTED) {
setGuidance({
...baseGuidance(mission),
permission: permission.status,
capturedAt: new Date().toISOString(),
});
setError("Permission localisation refusée. Le guidage externe reste disponible.");
return;
}

const position = await Location.getCurrentPositionAsync({
accuracy: Location.Accuracy.Balanced,
});

const current = {
latitude: position.coords.latitude,
longitude: position.coords.longitude,
};

const restaurantToClient = distanceKm(mission.restaurantPoint, mission.clientPoint);
const restaurantToClientMin = etaMinutes(restaurantToClient);

if (mission.status === "picked_up") {
const toClient = distanceKm(current, mission.clientPoint);
const toClientMin = etaMinutes(toClient);

setGuidance({
permission: permission.status,
accuracy: position.coords.accuracy,
current,
distanceToRestaurantKm: 0,
distanceRestaurantToClientKm: restaurantToClient,
distanceToClientKm: toClient,
etaToRestaurantMin: 0,
etaRestaurantToClientMin: restaurantToClientMin,
etaToClientMin: toClientMin,
etaTotalMin: toClientMin,
capturedAt: new Date().toISOString(),
});

return;
}

const toRestaurant = distanceKm(current, mission.restaurantPoint);
const toRestaurantMin = etaMinutes(toRestaurant);

setGuidance({
permission: permission.status,
accuracy: position.coords.accuracy,
current,
distanceToRestaurantKm: toRestaurant,
distanceRestaurantToClientKm: restaurantToClient,
distanceToClientKm: 0,
etaToRestaurantMin: toRestaurantMin,
etaRestaurantToClientMin: restaurantToClientMin,
etaToClientMin: 0,
etaTotalMin: toRestaurantMin + restaurantToClientMin + PICKUP_BUFFER_MIN,
capturedAt: new Date().toISOString(),
});
} catch (err) {
const message = err instanceof Error ? err.message : "Localisation indisponible.";
setError(message);
Alert.alert("Carte réelle", message);
} finally {
setLoadingLocation(false);
}
}

useEffect(() => {
loadMission();
}, []);

const targetPoint = useMemo(() => {
if (!mission) return THIEYP_POINT;
return mission.status === "picked_up" ? mission.clientPoint : mission.restaurantPoint;
}, [mission]);

const targetLabel = useMemo(() => {
if (!mission) return "Thieyp";
return mission.status === "picked_up" ? mission.clientName : mission.restaurantName;
}, [mission]);

return (
<SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
<ScrollView
contentContainerStyle={styles.container}
refreshControl={<RefreshControl refreshing={loadingMission} onRefresh={loadMission} />}
>
<View style={styles.header}>
<Text style={styles.kicker}>DELISHAFRICA® · COURIER</Text>
<Text style={styles.title}>Guidage mission</Text>
<Text style={styles.subtitle}>
Choisissez Apple Plans, Google Maps ou Waze.
</Text>
</View>

<View style={styles.mapPanel}>
<View style={styles.mapGrid}>
<View style={styles.mapPinCourier}>
<Text style={styles.pinText}>Vous</Text>
</View>
<View style={styles.mapRoad} />
<View style={styles.mapPinRestaurant}>
<Text style={styles.pinTextDark}>Resto</Text>
</View>
<View style={styles.mapRoadAlt} />
<View style={styles.mapPinClient}>
<Text style={styles.pinText}>Client</Text>
</View>
</View>

<Text style={styles.mapTitle}>Guidage terrain</Text>
<Text style={styles.mapText}>
Guidage externe au choix, sans suivi en arrière-plan.
</Text>
</View>

{mission ? (
<View style={styles.card}>
<View style={styles.rowBetween}>
<Text style={styles.cardLabel}>
{mission.source === "active" ? "Mission active" : "Dernière mission"}
</Text>
<Text style={styles.statusPill}>{statusLabel(mission.status)}</Text>
</View>

<Text style={styles.missionTitle}>{mission.title}</Text>
<Text style={styles.publicId}>{mission.publicId}</Text>

<View style={styles.addressBox}>
<Text style={styles.addressLabel}>Restaurant</Text>
<Text style={styles.addressText}>
{mission.restaurantName} · {mission.restaurantAddress}
</Text>
</View>

<View style={styles.addressBox}>
<Text style={styles.addressLabel}>Client</Text>
<Text style={styles.addressText}>
{mission.clientName} · {mission.clientAddress}
</Text>
</View>
</View>
) : (
<View style={styles.card}>
<Text style={styles.cardLabel}>Aucune mission</Text>
<Text style={styles.missionTitle}>Aucune mission active pour le moment.</Text>
<Text style={styles.small}>Le guidage reste disponible vers Thieyp pour test terrain.</Text>
</View>
)}

<View style={styles.heroCard}>
<Text style={styles.cardLabel}>ETA terrain</Text>
<Text style={styles.etaValue}>{guidance ? formatMin(guidance.etaTotalMin) : "—"}</Text>
<Text style={styles.small}>
{guidance
? `Restaurant → client : ${formatKm(guidance.distanceRestaurantToClientKm)}`
: "Charge une mission pour calculer l’ETA."}
</Text>

{guidance?.distanceToRestaurantKm ? (
<Text style={styles.small}>
Vous → restaurant : {formatKm(guidance.distanceToRestaurantKm)} ·{" "}
{formatMin(guidance.etaToRestaurantMin)}
</Text>
) : null}

{guidance?.distanceToClientKm ? (
<Text style={styles.small}>
Vous → client : {formatKm(guidance.distanceToClientKm)} · {formatMin(guidance.etaToClientMin)}
</Text>
) : null}

<Text style={styles.small}>
Permission : {guidance?.permission || "non demandée"}
{typeof guidance?.accuracy === "number" ? ` · précision ${Math.round(guidance.accuracy)} m` : ""}
</Text>
</View>

{error ? <Text style={styles.error}>{error}</Text> : null}

<TouchableOpacity
activeOpacity={0.86}
style={[styles.primaryButton, loadingLocation && styles.disabledButton]}
onPress={calculateLiveGuidance}
disabled={loadingLocation}
>
{loadingLocation ? (
<ActivityIndicator />
) : (
<Text style={styles.primaryButtonText}>Calculer avec ma position</Text>
)}
</TouchableOpacity>

<TouchableOpacity
activeOpacity={0.86}
style={styles.mapButton}
onPress={() => openGuidanceChooser(targetPoint, targetLabel, mission?.status === "picked_up" ? mission?.clientAddress : mission?.restaurantAddress)}
>
<Text style={styles.mapButtonText}>
{mission?.status === "picked_up" ? "Choisir mon guidage" : "Choisir mon guidage"}
</Text>
</TouchableOpacity>

<TouchableOpacity
activeOpacity={0.86}
style={styles.secondaryButton}
onPress={() => openMapUrl(previewMapUrl(targetPoint, targetLabel, mission?.status === "picked_up" ? mission?.clientAddress : mission?.restaurantAddress))}
>
<Text style={styles.secondaryButtonText}>Ouvrir la carte</Text>
</TouchableOpacity>

<TouchableOpacity activeOpacity={0.86} style={styles.secondaryButton} onPress={loadMission}>
<Text style={styles.secondaryButtonText}>
{loadingMission ? "Actualisation…" : `Actualiser les missions (${ordersCount})`}
</Text>
</TouchableOpacity>

<TouchableOpacity
activeOpacity={0.86}
style={styles.secondaryButton}
onPress={() => router.push("/courier-eta" as any)}
>
<Text style={styles.secondaryButtonText}>Retour ETA mission</Text>
</TouchableOpacity>

<TouchableOpacity activeOpacity={0.86} style={styles.ghostButton} onPress={() => router.back()}>
<Text style={styles.ghostButtonText}>Retour</Text>
</TouchableOpacity>

<Text style={styles.footer}>
Guidage externe · aucune mutation · aucun suivi arrière-plan.
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
backgroundColor: "#04160F",
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
fontWeight: "900",
letterSpacing: 1.2,
},
title: {
color: "#F7FFF9",
fontSize: 34,
fontWeight: "900",
},
subtitle: {
color: "#B8D8C4",
fontSize: 15,
lineHeight: 22,
fontWeight: "700",
},
mapPanel: {
minHeight: 224,
borderRadius: 34,
padding: 20,
backgroundColor: "#0B2B1B",
borderWidth: 1,
borderColor: "rgba(142,240,179,0.26)",
overflow: "hidden",
},
mapGrid: {
height: 150,
borderRadius: 26,
backgroundColor: "rgba(255,255,255,0.07)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.08)",
position: "relative",
marginBottom: 16,
},
mapPinCourier: {
position: "absolute",
left: 20,
top: 92,
backgroundColor: "#49D184",
borderRadius: 999,
paddingHorizontal: 12,
paddingVertical: 8,
},
mapPinRestaurant: {
position: "absolute",
left: "43%",
top: 28,
backgroundColor: "#F8D36B",
borderRadius: 999,
paddingHorizontal: 12,
paddingVertical: 8,
},
mapPinClient: {
position: "absolute",
right: 18,
bottom: 24,
backgroundColor: "#FFFFFF",
borderRadius: 999,
paddingHorizontal: 12,
paddingVertical: 8,
},
pinText: {
color: "#062015",
fontSize: 12,
fontWeight: "900",
},
pinTextDark: {
color: "#1F1705",
fontSize: 12,
fontWeight: "900",
},
mapRoad: {
position: "absolute",
left: 64,
top: 78,
width: 128,
height: 4,
borderRadius: 999,
backgroundColor: "rgba(142,240,179,0.42)",
transform: [{ rotate: "-18deg" }],
},
mapRoadAlt: {
position: "absolute",
right: 58,
top: 78,
width: 120,
height: 4,
borderRadius: 999,
backgroundColor: "rgba(255,255,255,0.35)",
transform: [{ rotate: "22deg" }],
},
mapTitle: {
color: "#FFFFFF",
fontSize: 23,
fontWeight: "900",
},
mapText: {
color: "#C9F4D8",
fontSize: 14,
lineHeight: 21,
marginTop: 8,
fontWeight: "700",
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
missionTitle: {
color: "#FFFFFF",
fontSize: 22,
fontWeight: "900",
lineHeight: 28,
},
publicId: {
color: "#DDFBE6",
fontSize: 14,
fontWeight: "800",
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
fontWeight: "700",
},
etaValue: {
color: "#061A12",
fontSize: 38,
fontWeight: "900",
},
small: {
color: "#2C4F38",
fontSize: 14,
lineHeight: 20,
fontWeight: "800",
},
error: {
color: "#FFD4D4",
backgroundColor: "rgba(255,120,120,0.12)",
borderWidth: 1,
borderColor: "rgba(255,120,120,0.3)",
borderRadius: 16,
padding: 12,
fontWeight: "800",
},
primaryButton: {
backgroundColor: "#8EF0B3",
borderRadius: 24,
paddingVertical: 17,
paddingHorizontal: 18,
alignItems: "center",
},
disabledButton: {
opacity: 0.68,
},
primaryButtonText: {
color: "#061A12",
fontSize: 16,
fontWeight: "900",
},
mapButton: {
backgroundColor: "#FFFFFF",
borderRadius: 24,
paddingVertical: 17,
paddingHorizontal: 18,
alignItems: "center",
},
mapButtonText: {
color: "#061A12",
fontSize: 16,
fontWeight: "900",
},
secondaryButton: {
backgroundColor: "rgba(255,255,255,0.08)",
borderWidth: 1,
borderColor: "rgba(255,255,255,0.12)",
borderRadius: 22,
paddingVertical: 15,
paddingHorizontal: 18,
alignItems: "center",
},
secondaryButtonText: {
color: "#F7FFF9",
fontSize: 15,
fontWeight: "900",
},
ghostButton: {
paddingVertical: 14,
alignItems: "center",
},
ghostButtonText: {
color: "#8EF0B3",
fontSize: 15,
fontWeight: "900",
},
footer: {
color: "#8CB99C",
textAlign: "center",
fontSize: 12,
lineHeight: 18,
fontWeight: "700",
},
});
