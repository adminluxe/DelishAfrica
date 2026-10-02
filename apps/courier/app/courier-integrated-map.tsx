import { daOrdersFetch } from "../utils/daOrdersApi";
// DA_A5A3A7S16R9A2C_FOREGROUND_POSITION_ROUTE_ETA_V1
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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

type RoutePreview = {
  provider: string;
  distanceMeters: number;
  durationSeconds: number;
  etaMinutes: number;
  polyline: string | null;
  confidence: number;
  fallback: boolean;
  meta?: {
    trafficAware?: boolean;
    computedAt?: string;
    mode?: string;
    source?: string;
    reason?: string;
    orderId?: string | null;
  };
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

const LIVE_LOCATION_ENDPOINT = `${API_BASE_URL}/orders/demo/location`;

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
const ROUTE_REFRESH_MS = 20_000;
const ROUTE_REFRESH_MOVE_METERS = 90;
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

function assignmentAccepted(order?: Order | null) {
  const proposal = order?.assignmentProposal;
  return (
    clean(proposal?.status).toLowerCase() === "accepted" &&
    Boolean(clean(proposal?.courierId))
  );
}

function assignedCourierId(order?: Order | null) {
  return clean(
    order?.assignmentProposal?.courierId ||
      order?.courierId ||
      order?.courier?.id ||
      "",
  );
}

function assignedCourierName(order?: Order | null) {
  return clean(
    order?.assignmentProposal?.courierName ||
      order?.courierName ||
      order?.courier?.name ||
      "Courier DelishAfrica",
  );
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

function selectMission(orders: Order[], requestedOrderId = "") {
  const requested = clean(requestedOrderId);
  if (requested) {
    const exact = orders.find((order) => orderId(order) === requested);
    if (exact) return exact;
  }

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

async function openNativeGuidance(destination: LatLng) {
  const coordinates = `${destination.latitude},${destination.longitude}`;
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${encodeURIComponent(coordinates)}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinates)}&travelmode=driving`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      "Guidage routier",
      "Le guidage externe n’a pas pu être ouvert. La carte DelishAfrica reste active.",
    );
  }
}

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return points.filter(
    (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
  );
}

function thinRoute(points: LatLng[], maxPoints = 120): LatLng[] {
  if (points.length <= maxPoints) return points;
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const thinned = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (last && thinned[thinned.length - 1] !== last) thinned.push(last);
  return thinned;
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

async function fetchRoutePreview(
  origin: LatLng,
  destination: LatLng,
  currentOrderId: string,
): Promise<RoutePreview> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(`${API_BASE_URL}/routes/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        mode: "DRIVE",
        orderId: currentOrderId,
        source: "courier-mission-current",
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.reason || `HTTP ${response.status}`);
    }
    return payload as RoutePreview;
  } finally {
    clearTimeout(timeout);
  }
}

async function postMissionStatus(order: Order, next: "picked_up" | "delivered") {
  const id = orderId(order);
  const mutationId = `courier-map:${id}:${next}:${Date.now()}`;
  const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      orderId: id,
      id,
      status: next,
      clientMutationId: mutationId,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  }
  return mutationId;
}

async function postLiveLocation(
  path: "publish" | "stop",
  body: Record<string, unknown>,
) {
  const response = await daOrdersFetch(`${LIVE_LOCATION_ENDPOINT}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.message || payload?.error || `Signal live indisponible (${response.status})`,
    );
  }
  return payload;
}

export default function CourierIntegratedMapScreen() {
  const routeParams = useLocalSearchParams<{
    orderId?: string | string[];
    publicId?: string | string[];
    launch?: string | string[];
  }>();
  const requestedOrderId = clean(
    Array.isArray(routeParams.publicId)
      ? routeParams.publicId[0]
      : routeParams.publicId ||
          (Array.isArray(routeParams.orderId) ? routeParams.orderId[0] : routeParams.orderId),
  );
  const launchMode = clean(
    Array.isArray(routeParams.launch) ? routeParams.launch[0] : routeParams.launch,
  );

  const mapRef = useRef<MapView | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastRouteRequestAtRef = useRef(0);
  const lastRouteOriginRef = useRef<LatLng | null>(null);
  const routeRequestSeqRef = useRef(0);
  const statusMutationRef = useRef(false);
  const missionRef = useRef<Order | null>(null);
  const liveSharingRef = useRef(false);
  const publishInFlightRef = useRef(false);
  const [mission, setMission] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [networkMode, setNetworkMode] = useState<"live" | "fallback">("live");
  const [message, setMessage] = useState("Synchronisation de la mission…");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("idle");
  const [tracking, setTracking] = useState(false);
  const [locationFix, setLocationFix] = useState<CourierFix | null>(null);
  const [locationError, setLocationError] = useState("");
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);

  const pickup = useMemo(() => pickupCoordinate(mission), [mission]);
  const destination = useMemo(() => destinationCoordinate(mission), [mission]);
  const phase = useMemo(() => missionPhase(statusOf(mission)), [mission]);
  const fallbackCoordinates = useMemo(() => usesFallbackCoordinate(mission), [mission]);
  const activeTarget = phase.key === "delivery" ? destination : pickup;
  const activeTargetLabel = phase.key === "delivery" ? customerName(mission) : restaurantName(mission);
  const directDistance = useMemo(
    () => (locationFix ? distanceKm(locationFix.coordinate, activeTarget) : null),
    [activeTarget, locationFix],
  );
  const activeDistance = routePreview?.distanceMeters
    ? routePreview.distanceMeters / 1000
    : directDistance;
  const activeEta = routePreview?.etaMinutes ?? estimateEtaMinutes(directDistance, phase);
  const routeTruthLabel = routePreview
    ? routePreview.fallback
      ? "ROUTE ESTIMÉE"
      : routePreview.meta?.trafficAware
        ? "TRAFIC LIVE"
        : "ROUTE RÉELLE"
    : routeBusy
      ? "ROUTE…"
      : "TRAJET DIRECT";

  const fitMission = useCallback(() => {
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates([pickup, destination], {
        edgePadding: { top: 90, right: 46, bottom: 96, left: 46 },
        animated: true,
      });
    });
  }, [destination, pickup]);

  const fitCourierToTarget = useCallback(() => {
    const coordinates =
      routeCoordinates.length >= 2
        ? routeCoordinates
        : locationFix
          ? [locationFix.coordinate, activeTarget]
          : [pickup, destination];
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 110, right: 50, bottom: 126, left: 50 },
        animated: true,
      });
    });
  }, [activeTarget, destination, locationFix, pickup, routeCoordinates]);

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
      const selected = selectMission(orders, requestedOrderId);
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
  }, [requestedOrderId]);

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

  const refreshRoadRoute = useCallback(
    async (force = false) => {
      if (!mission || !locationFix) return;
      const now = Date.now();
      const previousOrigin = lastRouteOriginRef.current;
      const movedMeters = previousOrigin
        ? distanceKm(previousOrigin, locationFix.coordinate) * 1000
        : Number.POSITIVE_INFINITY;
      if (
        !force &&
        now - lastRouteRequestAtRef.current < ROUTE_REFRESH_MS &&
        movedMeters < ROUTE_REFRESH_MOVE_METERS
      ) {
        return;
      }

      const seq = ++routeRequestSeqRef.current;
      lastRouteRequestAtRef.current = now;
      lastRouteOriginRef.current = locationFix.coordinate;
      setRouteBusy(true);
      setRouteError("");

      try {
        const preview = await fetchRoutePreview(
          locationFix.coordinate,
          activeTarget,
          orderId(mission),
        );
        if (seq !== routeRequestSeqRef.current) return;
        setRoutePreview(preview);
        const decoded = preview.polyline ? thinRoute(decodePolyline(preview.polyline)) : [];
        setRouteCoordinates(
          decoded.length >= 2 ? decoded : [locationFix.coordinate, activeTarget],
        );
      } catch (error) {
        if (seq !== routeRequestSeqRef.current) return;
        setRoutePreview(null);
        setRouteCoordinates([locationFix.coordinate, activeTarget]);
        setRouteError(
          error instanceof Error ? error.message : "Route routière indisponible.",
        );
      } finally {
        if (seq === routeRequestSeqRef.current) setRouteBusy(false);
      }
    },
    [activeTarget, locationFix, mission],
  );

  useEffect(() => {
    lastRouteRequestAtRef.current = 0;
    lastRouteOriginRef.current = null;
    setRoutePreview(null);
    setRouteCoordinates([]);
    if (locationFix && mission) void refreshRoadRoute(true);
  }, [
    mission ? orderId(mission) : "",
    phase.key,
    activeTarget.latitude,
    activeTarget.longitude,
  ]);

  useEffect(() => {
    if (locationFix && mission) void refreshRoadRoute(false);
  }, [locationFix?.capturedAt, refreshRoadRoute]);

  useEffect(() => {
    fitMission();
  }, [fitMission, mission]);

  useEffect(() => {
    if (routeCoordinates.length >= 2) fitCourierToTarget();
  }, [fitCourierToTarget, routeCoordinates.length]);

  const locationStatus = useMemo(() => {
    if (permissionMode === "requesting") return "Demande de localisation en cours…";
    if (permissionMode === "denied") return "Localisation refusée. La mission reste visible sans votre position.";
    if (permissionMode === "error") return locationError || "Position indisponible.";
    if (!locationFix) return "Position en attente. La mission reste lisible.";
    return tracking
      ? `Position active au premier plan · ${formatAccuracy(locationFix.accuracy)}`
      : `Dernière position connue · ${formatAccuracy(locationFix.accuracy)}`;
  }, [locationError, locationFix, permissionMode, tracking]);

  const nextMissionStatus =
    mission && statusOf(mission) === "ready" && assignmentAccepted(mission)
      ? "picked_up"
      : mission && statusOf(mission) === "picked_up"
        ? "delivered"
        : null;

  const commitMissionStatus = useCallback(async () => {
    if (!mission || !nextMissionStatus || statusMutationRef.current) return;

    if (nextMissionStatus === "picked_up" && !assignmentAccepted(mission)) {
      Alert.alert(
        "Mission non attribuée",
        "Cette mission doit être acceptée avant de confirmer le retrait.",
      );
      return;
    }

    statusMutationRef.current = true;
    setStatusBusy(true);
    const targetStatus = nextMissionStatus;
    const id = orderId(mission);
    setMessage(
      targetStatus === "picked_up"
        ? "Confirmation du retrait…"
        : "Confirmation de la remise…",
    );

    try {
      await postMissionStatus(mission, targetStatus);

      let confirmed: Order | null = null;
      for (const waitMs of [0, 320, 850]) {
        if (waitMs) {
          await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
        }
        const orders = await fetchOrders();
        const exact = orders.find((order) => orderId(order) === id) || null;
        if (exact && statusOf(exact) === targetStatus) {
          confirmed = exact;
          break;
        }
      }

      if (!confirmed) {
        throw new Error("Le nouvel état n’a pas été confirmé après relecture.");
      }

      setMission(confirmed);
      setMessage(
        targetStatus === "picked_up"
          ? "Retrait confirmé · cap automatique vers le client."
          : "Livraison confirmée · mission terminée.",
      );

      if (targetStatus === "delivered") {
        setTimeout(() => router.replace("/orders" as any), 650);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "La confirmation n’a pas pu être vérifiée.";
      setMessage("Dernière vérité conservée.");
      Alert.alert("Action non confirmée", message);
      await loadMission(true).catch(() => undefined);
    } finally {
      statusMutationRef.current = false;
      setStatusBusy(false);
    }
  }, [loadMission, mission, nextMissionStatus]);

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
        <View style={styles.fastHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
            <Text style={styles.fastKicker}>
              {launchMode === "accepted" ? "MISSION ACCEPTÉE · DÉPART IMMÉDIAT" : "MISSION CURRENT"}
            </Text>
          </View>
          <View style={[styles.phasePill, { borderColor: phase.accent }]}>
            <Text style={[styles.phasePillText, { color: phase.accent }]}>{phase.label}</Text>
          </View>
        </View>

        <View style={styles.commandDeck}>
          <View style={styles.commandTopline}>
            <View style={styles.commandStep}>
              <Text style={styles.commandStepNumber}>{phase.key === "delivery" ? "2" : "1"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.commandLabel}>
                {phase.key === "delivery" ? "CAP CLIENT" : "CAP RESTAURANT"}
              </Text>
              <Text style={styles.commandTarget}>{activeTargetLabel || "Mission"}</Text>
            </View>
            <Text style={styles.commandOrder}>{mission ? orderId(mission) : "VEILLE"}</Text>
          </View>

          <View style={styles.commandMetrics}>
            <View style={styles.commandMetric}>
              <Text style={styles.commandMetricValue}>
                {activeEta === null ? "—" : `${activeEta} min`}
              </Text>
              <Text style={styles.commandMetricLabel}>ETA</Text>
            </View>
            <View style={styles.commandMetric}>
              <Text style={styles.commandMetricValue}>{formatDistance(activeDistance)}</Text>
              <Text style={styles.commandMetricLabel}>ROUTE</Text>
            </View>
            <View style={styles.commandMetric}>
              <Text style={[styles.commandMetricValue, { color: phase.accent }]}>
                {routeTruthLabel}
              </Text>
              <Text style={styles.commandMetricLabel}>VÉRITÉ</Text>
            </View>
          </View>

          <Text style={styles.commandBody}>
            {mission
              ? phase.key === "delivery"
                ? `Remise à ${customerName(mission)} · ${deliveryAddress(mission)}`
                : `${restaurantName(mission)} · ${firstItem(mission)}`
              : "Aucune mission active. La carte reste prête."}
          </Text>
        </View>

        <View style={styles.mapShellFast}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={INITIAL_REGION}
            mapType="standard"
            loadingEnabled
            pitchEnabled
            rotateEnabled
            showsCompass
            showsScale
            accessibilityLabel="Carte de guidage Courier vers le prochain repère"
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
              strokeColor="rgba(142,240,179,0.22)"
              strokeWidth={4}
              lineDashPattern={[10, 10]}
            />
            {locationFix ? (
              <>
                <Circle
                  center={locationFix.coordinate}
                  radius={Math.max(18, locationFix.accuracy || 18)}
                  fillColor="rgba(51,126,255,0.10)"
                  strokeColor="rgba(51,126,255,0.34)"
                  strokeWidth={2}
                />
                <Marker
                  coordinate={locationFix.coordinate}
                  title="Vous"
                  description={formatAccuracy(locationFix.accuracy)}
                  pinColor="#337EFF"
                />
                <Polyline
                  coordinates={
                    routeCoordinates.length >= 2
                      ? routeCoordinates
                      : [locationFix.coordinate, activeTarget]
                  }
                  strokeColor={phase.accent}
                  strokeWidth={8}
                />
              </>
            ) : null}
          </MapView>

          <View pointerEvents="none" style={styles.routeTruthBadge}>
            <Text style={styles.routeTruthBadgeText}>{routeTruthLabel}</Text>
          </View>

          <View style={styles.mapActionsFast}>
            <Pressable
              style={({ pressed }) => [styles.mapAction, pressed && styles.pressed]}
              onPress={fitCourierToTarget}
              accessibilityRole="button"
              accessibilityLabel="Recentrer sur moi et la destination"
            >
              <Text style={styles.mapActionText}>MOI + CIBLE</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.mapAction, pressed && styles.pressed]}
              onPress={() => void openNativeGuidance(activeTarget)}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir le guidage routier vers la cible"
            >
              <Text style={styles.mapActionText}>GPS ROUTIER ↗</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.truthStrip}>
          <View style={[styles.truthDot, { backgroundColor: networkMode === "live" ? "#8EF0B3" : "#D9A928" }]} />
          <Text style={styles.truthText}>
            {locationStatus}
            {routeError ? " · Route routière momentanément estimée." : ""}
            {fallbackCoordinates ? " · Coordonnées de sécurité utilisées." : ""}
          </Text>
        </View>

        {mission && nextMissionStatus ? (
          <Pressable
            disabled={statusBusy}
            onPress={() => void commitMissionStatus()}
            style={({ pressed }) => [
              styles.nextAction,
              statusBusy && styles.nextActionDisabled,
              pressed && !statusBusy && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: statusBusy, busy: statusBusy }}
            accessibilityLabel={
              nextMissionStatus === "picked_up"
                ? "Confirmer que la commande a été récupérée"
                : "Confirmer que la commande a été remise au client"
            }
          >
            <View style={styles.nextActionCopy}>
              <Text style={styles.nextActionKicker}>
                {nextMissionStatus === "picked_up" ? "AU RESTAURANT" : "CHEZ LE CLIENT"}
              </Text>
              <Text style={styles.nextActionTitle}>
                {statusBusy
                  ? "Confirmation en cours…"
                  : nextMissionStatus === "picked_up"
                    ? "Commande récupérée"
                    : "Commande remise"}
              </Text>
            </View>
            {statusBusy ? (
              <ActivityIndicator color="#031A12" />
            ) : (
              <Text style={styles.nextActionArrow}>→</Text>
            )}
          </Pressable>
        ) : mission && !assignmentAccepted(mission) ? (
          <Pressable
            onPress={() =>
              router.replace({
                pathname: "/route-oracle" as any,
                params: { orderId: orderId(mission) },
              })
            }
            style={({ pressed }) => [styles.nextAction, pressed && styles.pressed]}
          >
            <View style={styles.nextActionCopy}>
              <Text style={styles.nextActionKicker}>ATTRIBUTION REQUISE</Text>
              <Text style={styles.nextActionTitle}>Accepter la mission</Text>
            </View>
            <Text style={styles.nextActionArrow}>→</Text>
          </Pressable>
        ) : null}

        <View style={styles.secondaryRail}>
          <Pressable
            style={({ pressed }) => [styles.secondaryCompact, pressed && styles.pressed]}
            onPress={() =>
              mission
                ? router.push({
                    pathname: "/mission-detail" as any,
                    params: { orderId: orderId(mission) },
                  })
                : router.push("/orders" as any)
            }
          >
            <Text style={styles.secondaryCompactText}>
              {mission ? "Détails commande" : "Voir les missions"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryCompact, pressed && styles.pressed]}
            onPress={() => router.replace("/orders" as any)}
          >
            <Text style={styles.secondaryCompactText}>Cockpit</Text>
          </Pressable>
        </View>

        <Text style={styles.fastFootnote}>
          Une mission · une cible · une action. Le statut ne change jamais sans votre confirmation.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#031A12" },
  page: { padding: 18, paddingBottom: 46, gap: 14 },
  fastHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  fastKicker: { color: "#F7FFF9", fontSize: 17, lineHeight: 21, fontWeight: "900", marginTop: 7 },
  commandDeck: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: "#082719",
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.30)",
  },
  commandTopline: { flexDirection: "row", alignItems: "center", gap: 12 },
  commandStep: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#8EF0B3" },
  commandStepNumber: { color: "#052013", fontSize: 19, fontWeight: "900" },
  commandLabel: { color: "#8EF0B3", fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  commandTarget: { color: "#F7FFF9", fontSize: 24, lineHeight: 28, fontWeight: "900", marginTop: 3 },
  commandOrder: { color: "rgba(183,212,193,0.52)", fontSize: 9, fontWeight: "900", maxWidth: 92, textAlign: "right" },
  commandMetrics: { flexDirection: "row", gap: 8, marginTop: 16 },
  commandMetric: { flex: 1, minHeight: 70, borderRadius: 17, padding: 11, justifyContent: "center", backgroundColor: "rgba(142,240,179,0.07)" },
  commandMetricValue: { color: "#F7FFF9", fontSize: 16, fontWeight: "900" },
  commandMetricLabel: { color: "rgba(183,212,193,0.52)", fontSize: 8, fontWeight: "900", letterSpacing: 1.1, marginTop: 5 },
  commandBody: { color: "rgba(231,255,239,0.68)", fontSize: 12.5, lineHeight: 18, fontWeight: "700", marginTop: 14 },
  mapShellFast: {
    height: 500,
    overflow: "hidden",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(142,240,179,0.34)",
    backgroundColor: "#082719",
  },
  routeTruthBadge: { position: "absolute", top: 14, left: 14, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(3,26,18,0.92)", borderWidth: 1, borderColor: "rgba(142,240,179,0.42)" },
  routeTruthBadgeText: { color: "#8EF0B3", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  mapActionsFast: { position: "absolute", right: 14, bottom: 14, flexDirection: "row", gap: 8 },
  truthStrip: { flexDirection: "row", alignItems: "flex-start", gap: 9, paddingHorizontal: 4 },
  truthDot: { width: 8, height: 8, borderRadius: 999, marginTop: 5 },
  truthText: { flex: 1, color: "rgba(183,212,193,0.62)", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  nextAction: { minHeight: 76, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, backgroundColor: "#8EF0B3" },
  nextActionDisabled: { opacity: 0.58 },
  nextActionCopy: { flex: 1 },
  nextActionKicker: { color: "#0A6338", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  nextActionTitle: { color: "#031A12", fontSize: 21, lineHeight: 25, fontWeight: "900", marginTop: 4 },
  nextActionArrow: { color: "#031A12", fontSize: 30, fontWeight: "900" },
  secondaryRail: { flexDirection: "row", gap: 9 },
  secondaryCompact: { flex: 1, minHeight: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(142,240,179,0.22)", backgroundColor: "rgba(142,240,179,0.07)" },
  secondaryCompactText: { color: "#D9F9E5", fontSize: 12, fontWeight: "900" },
  fastFootnote: { color: "rgba(183,212,193,0.42)", fontSize: 10, lineHeight: 15, fontWeight: "700", textAlign: "center" },
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
