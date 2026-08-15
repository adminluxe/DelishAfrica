import { daOrdersFetch } from "../utils/daOrdersApi";
// DA_A5A3A7S16R9A2C_FOREGROUND_POSITION_ROUTE_ETA_V1
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import MapView, { Circle, Marker, Polyline, type LatLng } from "react-native-maps";

type Order = Record<string, any>;

type MissionPhase = {
  key: "pickup" | "accepted" | "delivery" | "waiting";
  label: string;
  title: string;
  body: string;
  accent: string;
};

type PermissionMode = "idle" | "requesting" | "granted" | "denied" | "error";

type CourierFix = {
  coordinate: LatLng;
  accuracy: number | null;
  capturedAt: number;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

const THIEYP_FALLBACK: LatLng = {
  latitude: 50.8359,
  longitude: 4.3717,
};

const CLIENT_FALLBACK: LatLng = {
  latitude: 50.8195,
  longitude: 4.4302,
};

const INITIAL_REGION = {
  latitude: 50.8282,
  longitude: 4.4009,
  latitudeDelta: 0.055,
  longitudeDelta: 0.075,
};

const NETWORK_TIMEOUT_MS = 8000;
const ACTIVE_RANK: Record<string, number> = {
  picked_up: 0,
  on_the_way: 0,
  in_transit: 0,
  courier_accepted: 1,
  ready: 2,
  accepted: 3,
  pending: 4,
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function statusOf(order?: Order | null) {
  return clean(order?.status || "ready").toLowerCase();
}

function orderId(order?: Order | null) {
  return clean(order?.publicId || order?.orderId || order?.id || "DA-MISSION");
}

function restaurantName(order?: Order | null) {
  return clean(
    order?.restaurantName ||
      order?.merchantName ||
      order?.restaurant?.name ||
      order?.restaurant ||
      "Restaurant partenaire",
  );
}

function customerName(order?: Order | null) {
  return clean(
    order?.customer?.name ||
      order?.customerName ||
      order?.clientName ||
      "Client DelishAfrica",
  );
}

function deliveryAddress(order?: Order | null) {
  return clean(
    order?.deliveryAddress ||
      order?.customer?.address ||
      order?.dropoffAddress ||
      "Adresse de livraison",
  );
}

function firstItem(order?: Order | null) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const first = items[0];
  if (!first) return "Commande à livrer";
  const quantity = Number(first.quantity || first.qty || 1);
  const name = clean(first.name || first.title || "Plat");
  const remaining = Math.max(0, items.length - 1);
  return remaining
    ? `${quantity}× ${name} + ${remaining} autre${remaining > 1 ? "s" : ""}`
    : `${quantity}× ${name}`;
}

function extractOrders(payload: any): Order[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function selectMission(orders: Order[]) {
  return (
    [...orders]
      .filter((order) => Object.prototype.hasOwnProperty.call(ACTIVE_RANK, statusOf(order)))
      .sort((left, right) => ACTIVE_RANK[statusOf(left)] - ACTIVE_RANK[statusOf(right)])[0] || null
  );
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinateFrom(value: any): LatLng | null {
  if (!value || typeof value !== "object") return null;
  const latitude = numeric(value.latitude ?? value.lat);
  const longitude = numeric(value.longitude ?? value.lng ?? value.lon);
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function firstCoordinate(candidates: any[]): LatLng | null {
  for (const candidate of candidates) {
    const coordinate = coordinateFrom(candidate);
    if (coordinate) return coordinate;
  }
  return null;
}

function pickupCoordinate(order?: Order | null): LatLng {
  return (
    firstCoordinate([
      order?.pickupLocation,
      order?.restaurantLocation,
      order?.merchantLocation,
      order?.restaurant?.location,
      order?.pickup,
      order?.merchant?.location,
      order?.pickupCoordinates,
    ]) || THIEYP_FALLBACK
  );
}

function destinationCoordinate(order?: Order | null): LatLng {
  return (
    firstCoordinate([
      order?.deliveryLocation,
      order?.dropoffLocation,
      order?.customer?.location,
      order?.destination,
      order?.dropoff,
      order?.deliveryCoordinates,
    ]) || CLIENT_FALLBACK
  );
}

function usesFallbackCoordinate(order?: Order | null) {
  return (
    !firstCoordinate([
      order?.pickupLocation,
      order?.restaurantLocation,
      order?.merchantLocation,
      order?.restaurant?.location,
      order?.pickup,
      order?.merchant?.location,
      order?.pickupCoordinates,
    ]) ||
    !firstCoordinate([
      order?.deliveryLocation,
      order?.dropoffLocation,
      order?.customer?.location,
      order?.destination,
      order?.dropoff,
      order?.deliveryCoordinates,
    ])
  );
}

function missionPhase(status: string): MissionPhase {
  if (["picked_up", "on_the_way", "in_transit"].includes(status)) {
    return {
      key: "delivery",
      label: "VERS LE CLIENT",
      title: "La commande voyage.",
      body: "Le prochain repère utile est la destination client.",
      accent: "#D9A928",
    };
  }

  if (status === "courier_accepted") {
    return {
      key: "accepted",
      label: "MISSION ACCEPTÉE",
      title: "Le retrait devient prioritaire.",
      body: "Le restaurant reste le premier repère opérationnel.",
      accent: "#8EF0B3",
    };
  }

  if (["ready", "accepted"].includes(status)) {
    return {
      key: "pickup",
      label: "À RÉCUPÉRER",
      title: "Le restaurant vous attend.",
      body: "La carte garde le retrait au centre avant la livraison.",
      accent: "#8EF0B3",
    };
  }

  return {
    key: "waiting",
    label: "EN ATTENTE",
    title: "La mission se prépare.",
    body: "Les deux repères restent visibles sans anticiper le statut.",
    accent: "#B7D4C1",
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(left: LatLng, right: LatLng) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistance(value: number | null) {
  if (value === null) return "—";
  if (value < 1) return `${Math.max(10, Math.round(value * 1000 / 10) * 10)} m`;
  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}

function estimateEtaMinutes(value: number | null, phase: MissionPhase) {
  if (value === null) return null;
  const urbanSpeedKmH = phase.key === "delivery" ? 18 : 22;
  return Math.max(2, Math.ceil((value / urbanSpeedKmH) * 60) + 2);
}

function formatAccuracy(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `±${Math.max(1, Math.round(value))} m`;
}

async function fetchOrders() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return extractOrders(payload);
  } finally {
    clearTimeout(timeout);
  }
}

export default function CourierIntegratedMapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const [mission, setMission] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkMode, setNetworkMode] = useState<"live" | "fallback">("live");
  const [message, setMessage] = useState("Synchronisation de la mission…");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("idle");
  const [tracking, setTracking] = useState(false);
  const [locationFix, setLocationFix] = useState<CourierFix | null>(null);
  const [locationError, setLocationError] = useState("");

  const pickup = useMemo(() => pickupCoordinate(mission), [mission]);
  const destination = useMemo(() => destinationCoordinate(mission), [mission]);
  const phase = useMemo(() => missionPhase(statusOf(mission)), [mission]);
  const fallbackCoordinates = useMemo(() => usesFallbackCoordinate(mission), [mission]);
  const activeTarget = phase.key === "delivery" ? destination : pickup;
  const activeTargetLabel = phase.key === "delivery" ? customerName(mission) : restaurantName(mission);
  const activeDistance = useMemo(
    () => (locationFix ? distanceKm(locationFix.coordinate, activeTarget) : null),
    [activeTarget, locationFix],
  );
  const activeEta = useMemo(() => estimateEtaMinutes(activeDistance, phase), [activeDistance, phase]);

  const fitMission = useCallback(() => {
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates([pickup, destination], {
        edgePadding: { top: 90, right: 46, bottom: 96, left: 46 },
        animated: true,
      });
    });
  }, [destination, pickup]);

  const fitCourierToTarget = useCallback(() => {
    const coordinates = locationFix ? [locationFix.coordinate, activeTarget] : [pickup, destination];
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 94, right: 48, bottom: 100, left: 48 },
        animated: true,
      });
    });
  }, [activeTarget, destination, locationFix, pickup]);

  const stopTracking = useCallback(() => {
    locationSubscriptionRef.current?.remove();
    locationSubscriptionRef.current = null;
    setTracking(false);
  }, []);

  const applyLocation = useCallback((location: Location.LocationObject) => {
    setLocationFix({
      coordinate: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      accuracy: Number.isFinite(Number(location.coords.accuracy))
        ? Number(location.coords.accuracy)
        : null,
      capturedAt: location.timestamp || Date.now(),
    });
  }, []);

  const startTracking = useCallback(async () => {
    stopTracking();
    setPermissionMode("requesting");
    setLocationError("");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setPermissionMode("denied");
        setLocationError("Autorisez la localisation pendant l’utilisation pour afficher votre position.");
        return;
      }

      setPermissionMode("granted");
      const firstLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      applyLocation(firstLocation);

      requestAnimationFrame(() => {
        mapRef.current?.fitToCoordinates(
          [
            {
              latitude: firstLocation.coords.latitude,
              longitude: firstLocation.coords.longitude,
            },
            activeTarget,
          ],
          {
            edgePadding: { top: 94, right: 48, bottom: 100, left: 48 },
            animated: true,
          },
        );
      });

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 4000,
          distanceInterval: 8,
        },
        applyLocation,
      );
      locationSubscriptionRef.current = subscription;
      setTracking(true);
    } catch (error) {
      setPermissionMode("error");
      setLocationError(
        error instanceof Error
          ? error.message
          : "La position n’est pas disponible pour le moment.",
      );
    }
  }, [activeTarget, applyLocation, stopTracking]);

  const loadMission = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const orders = await fetchOrders();
      const selected = selectMission(orders);
      setMission(selected);
      setNetworkMode("live");
      setMessage(
        selected
          ? `Mission ${orderId(selected)} synchronisée.`
          : "Aucune mission active. Carte prête en mode veille.",
      );
    } catch {
      setNetworkMode("fallback");
      setMessage("Réseau indisponible. Les repères sûrs restent affichés.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMission(false);
    }, [loadMission]),
  );

  useFocusEffect(
    useCallback(() => {
      void startTracking();
      return () => stopTracking();
    }, [startTracking, stopTracking]),
  );

  useEffect(() => {
    fitMission();
  }, [fitMission, mission]);

  const locationStatus = useMemo(() => {
    if (permissionMode === "requesting") return "Demande de localisation en cours…";
    if (permissionMode === "denied") return "Localisation refusée. La mission reste visible sans votre position.";
    if (permissionMode === "error") return locationError || "Position indisponible.";
    if (!locationFix) return "Position en attente. La mission reste lisible.";
    return tracking
      ? `Position active au premier plan · ${formatAccuracy(locationFix.accuracy)}`
      : `Dernière position connue · ${formatAccuracy(locationFix.accuracy)}`;
  }, [locationError, locationFix, permissionMode, tracking]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMission(true)}
            tintColor="#8EF0B3"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
          <Text style={styles.kicker}>R9A2C · POSITION + ETA</Text>
          <Text style={styles.title}>Le prochain repère se rapproche.</Text>
          <Text style={styles.body}>
            Votre position au premier plan, la mission en lecture seule et une ETA directe sans changement de statut.
          </Text>
        </View>

        <View style={styles.missionCard}>
          <View style={styles.missionTopline}>
            <View style={[styles.phasePill, { borderColor: phase.accent }]}>
              <Text style={[styles.phasePillText, { color: phase.accent }]}>{phase.label}</Text>
            </View>
            <Text style={styles.orderId}>{mission ? orderId(mission) : "MODE VEILLE"}</Text>
          </View>

          <Text style={styles.phaseTitle}>{phase.title}</Text>
          <Text style={styles.phaseBody}>{phase.body}</Text>

          <View style={styles.missionFacts}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>RETRAIT</Text>
              <Text style={styles.factValue}>{mission ? restaurantName(mission) : "Thieyp"}</Text>
            </View>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>DESTINATION</Text>
              <Text style={styles.factValue}>{mission ? customerName(mission) : "Client"}</Text>
            </View>
          </View>

          <Text style={styles.itemText}>{mission ? firstItem(mission) : "Aucune mission active"}</Text>
          <Text style={styles.addressText}>
            {mission ? deliveryAddress(mission) : "La carte reste disponible pour le prochain départ."}
          </Text>
        </View>

        <View style={styles.liveCard}>
          <View style={styles.liveHeader}>
            <View>
              <Text style={styles.liveKicker}>PROCHAIN REPÈRE</Text>
              <Text style={styles.liveTitle}>{activeTargetLabel || "Mission"}</Text>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>{tracking ? "LIVE" : "PRÊT"}</Text>
            </View>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{formatDistance(activeDistance)}</Text>
              <Text style={styles.metricLabel}>DISTANCE DIRECTE</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{activeEta === null ? "—" : `${activeEta} min`}</Text>
              <Text style={styles.metricLabel}>ETA ESTIMÉE</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{formatAccuracy(locationFix?.accuracy ?? null)}</Text>
              <Text style={styles.metricLabel}>PRÉCISION</Text>
            </View>
          </View>

          <Text style={styles.liveStatus}>{locationStatus}</Text>
          <Text style={styles.liveNote}>
            ETA calculée sur la distance directe et une vitesse urbaine prudente. Aucun itinéraire routier n’est inventé.
          </Text>
        </View>

        <View style={styles.mapShell}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={INITIAL_REGION}
            mapType="standard"
            loadingEnabled
            pitchEnabled={false}
            rotateEnabled={false}
            showsCompass
            showsScale
            accessibilityLabel="Carte Courier avec mission et position au premier plan"
          >
            <Marker
              coordinate={pickup}
              title={mission ? restaurantName(mission) : "Restaurant"}
              description="Point de retrait"
              pinColor="#2EBD73"
            />
            <Marker
              coordinate={destination}
              title={mission ? customerName(mission) : "Destination"}
              description={mission ? deliveryAddress(mission) : "Point de livraison"}
              pinColor="#D9A928"
            />
            <Polyline
              coordinates={[pickup, destination]}
              strokeColor="rgba(142,240,179,0.52)"
              strokeWidth={5}
              lineDashPattern={[12, 9]}
            />
            {locationFix ? (
              <>
                <Circle
                  center={locationFix.coordinate}
                  radius={Math.max(18, locationFix.accuracy || 18)}
                  fillColor="rgba(51,126,255,0.12)"
                  strokeColor="rgba(51,126,255,0.38)"
                  strokeWidth={2}
                />
                <Marker
                  coordinate={locationFix.coordinate}
                  title="Votre position"
                  description={`Précision ${formatAccuracy(locationFix.accuracy)}`}
                  pinColor="#337EFF"
                />
                <Polyline
                  coordinates={[locationFix.coordinate, activeTarget]}
                  strokeColor={phase.accent}
                  strokeWidth={7}
                />
              </>
            ) : null}
          </MapView>

          <View pointerEvents="none" style={styles.mapBadge}>
            <Text style={styles.mapBadgeText}>
              {locationFix ? "POSITION APP · PREMIER PLAN" : "MISSION API · POSITION EN ATTENTE"}
            </Text>
          </View>

          <View style={styles.mapActions}>
            <Pressable
              style={({ pressed }) => [styles.mapAction, pressed && styles.pressed]}
              onPress={fitMission}
              accessibilityRole="button"
              accessibilityLabel="Recentrer la carte sur toute la mission"
            >
              <Text style={styles.mapActionText}>MISSION</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.mapAction, pressed && styles.pressed]}
              onPress={fitCourierToTarget}
              accessibilityRole="button"
              accessibilityLabel="Recentrer la carte sur le coursier et le prochain repère"
            >
              <Text style={styles.mapActionText}>MOI + CIBLE</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.signalCard}>
          <View style={styles.signalHeader}>
            <Text style={styles.signalKicker}>VÉRITÉ TERRAIN</Text>
            {loading || permissionMode === "requesting" ? <ActivityIndicator color="#147040" /> : null}
          </View>
          <Text style={styles.signalTitle}>{message}</Text>
          <Text style={styles.signalText}>
            {fallbackCoordinates
              ? "Certaines coordonnées API manquent encore : les repères de sécurité restent visibles et signalés."
              : "Les coordonnées de mission proviennent de la synchronisation API."}
          </Text>
        </View>

        <View style={styles.steps}>
          <View style={[styles.step, phase.key !== "delivery" && styles.stepActive]}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepLabel}>Restaurant</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.step, phase.key === "delivery" && styles.stepActive]}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepLabel}>Client</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => void startTracking()}
          accessibilityRole="button"
          accessibilityLabel="Actualiser la position du coursier"
        >
          <Text style={styles.primaryButtonText}>Actualiser ma position</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => void loadMission(true)}
          accessibilityRole="button"
          accessibilityLabel="Rafraîchir la mission"
        >
          <Text style={styles.secondaryButtonText}>Rafraîchir la mission</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour au cockpit Courier"
        >
          <Text style={styles.secondaryButtonText}>Retour au cockpit</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#031A12" },
  page: { padding: 20, paddingBottom: 44, gap: 18 },
  header: { gap: 8 },
  brand: { color: "#8EF0B3", fontSize: 12, fontWeight: "900", letterSpacing: 2.4 },
  kicker: { color: "#D9A928", fontSize: 11, fontWeight: "900", letterSpacing: 1.8, marginTop: 8 },
  title: { color: "#F7FFF9", fontSize: 38, fontWeight: "900", lineHeight: 42 },
  body: { color: "#B7D4C1", fontSize: 15, lineHeight: 23, fontWeight: "700" },
  missionCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: "#E9FFF0",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.60)",
  },
  missionTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  phasePill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#07301E",
    borderWidth: 1,
  },
  phasePillText: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  orderId: { color: "rgba(5,32,19,0.62)", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  phaseTitle: { color: "#052013", fontSize: 27, lineHeight: 31, fontWeight: "900", marginTop: 14 },
  phaseBody: { color: "rgba(5,32,19,0.72)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 7 },
  missionFacts: { flexDirection: "row", gap: 10, marginTop: 18 },
  fact: { flex: 1, borderRadius: 18, padding: 13, backgroundColor: "rgba(5,32,19,0.07)" },
  factLabel: { color: "#147040", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  factValue: { color: "#052013", fontSize: 15, fontWeight: "900", marginTop: 5 },
  itemText: { color: "#052013", fontSize: 15, lineHeight: 21, fontWeight: "900", marginTop: 16 },
  addressText: { color: "rgba(5,32,19,0.66)", fontSize: 13, lineHeight: 19, fontWeight: "700", marginTop: 5 },
  liveCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: "#082719",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.30)",
  },
  liveHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  liveKicker: { color: "#8EF0B3", fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  liveTitle: { color: "#F7FFF9", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 6 },
  liveBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#8EF0B3" },
  liveBadgeText: { color: "#052013", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  metrics: { flexDirection: "row", gap: 8, marginTop: 18 },
  metric: { flex: 1, minHeight: 86, borderRadius: 18, padding: 12, justifyContent: "center", backgroundColor: "rgba(142,240,179,0.08)" },
  metricValue: { color: "#F7FFF9", fontSize: 19, fontWeight: "900" },
  metricLabel: { color: "rgba(183,212,193,0.62)", fontSize: 8, lineHeight: 12, fontWeight: "900", letterSpacing: 0.9, marginTop: 5 },
  liveStatus: { color: "#B7D4C1", fontSize: 13, lineHeight: 19, fontWeight: "800", marginTop: 16 },
  liveNote: { color: "rgba(183,212,193,0.52)", fontSize: 11, lineHeight: 17, marginTop: 7 },
  mapShell: {
    height: 530,
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.34)",
    backgroundColor: "#082719",
  },
  map: { flex: 1 },
  mapBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(3,26,18,0.90)",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.42)",
  },
  mapBadgeText: { color: "#8EF0B3", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  mapActions: { position: "absolute", right: 14, bottom: 14, flexDirection: "row", gap: 8 },
  mapAction: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(3,26,18,0.92)",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.42)",
  },
  mapActionText: { color: "#F7FFF9", fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  signalCard: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: "#E9FFF0",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.60)",
  },
  signalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  signalKicker: { color: "#147040", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  signalTitle: { color: "#052013", fontSize: 22, lineHeight: 27, fontWeight: "900", marginTop: 9 },
  signalText: { color: "rgba(5,32,19,0.72)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 8 },
  steps: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  step: {
    width: 94,
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "rgba(142,240,179,0.12)",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.24)",
  },
  stepActive: { backgroundColor: "#8EF0B3", borderColor: "#8EF0B3" },
  stepNumber: { color: "#052013", fontSize: 19, fontWeight: "900" },
  stepLabel: { color: "#052013", fontSize: 11, fontWeight: "900", marginTop: 3 },
  stepLine: { flex: 1, height: 2, backgroundColor: "rgba(142,240,179,0.35)" },
  primaryButton: { borderRadius: 24, paddingVertical: 17, alignItems: "center", backgroundColor: "#8EF0B3" },
  primaryButtonText: { color: "#052013", fontSize: 16, fontWeight: "900" },
  secondaryButton: {
    borderRadius: 24,
    paddingVertical: 17,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.35)",
    backgroundColor: "rgba(142,240,179,0.08)",
  },
  secondaryButtonText: { color: "#F7FFF9", fontSize: 16, fontWeight: "900" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
