import { daOrdersFetch } from "../utils/daOrdersApi";
// DA_A5A3A7S16R4_LIVE_LOCATION_TRUTH_V1
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { useLiveMapEngine } from "../components/live/LiveMapEngine";
import { LiveRouteEngine } from "../components/live/LiveRouteEngine";
import { DestinationApproachMarker } from "../components/live/DestinationApproachMarker";
import { LivingCourierMarker } from "../components/live/LivingCourierMarker";
// DA_P4A6A_CLIENT_MAPS_PREMIUM_ROUTE_COURIER_RESTORE_V1
import { useSmartCamera } from "../components/live/useSmartCamera";
import { MotionMapEntrance } from "../components/motion/MotionMapEntrance";
import { Animated } from "react-native";

// DA_P4A6C_ADAPTIVE_STORY_MAP_HUMAN_CAMERA_V1
// DA_SPRINT5_REALTIME_HANDOFF_ESSENTIAL_V1
// DA_SPRINT6_MOTION_CONTINUITY_ESSENTIAL_V1

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

const ROUTES_PREVIEW_URL = `${API_BASE_URL}/routes/preview`;

const DEFAULT_RESTAURANT = {
  latitude: 50.83558,
  longitude: 4.36756,
};

const DEFAULT_CLIENT = {
  latitude: 50.84662,
  longitude: 4.35281,
};

const COURIER_START = {
  latitude: 50.8327,
  longitude: 4.3741,
};

function buildFallbackRoute(restaurant: Coordinate, client: Coordinate): Coordinate[] {
  return [
    COURIER_START,
    {
      latitude: (COURIER_START.latitude + restaurant.latitude) / 2,
      longitude: (COURIER_START.longitude + restaurant.longitude) / 2,
    },
    restaurant,
    {
      latitude: (restaurant.latitude + client.latitude) / 2,
      longitude: (restaurant.longitude + client.longitude) / 2,
    },
    client,
  ];
}

type Coordinate = {
  latitude: number;
  longitude: number;
};

type RoutePreviewResponse = {
  ok?: boolean;
  provider?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  etaMinutes?: number;
  polyline?: string | null;
  fallback?: boolean;
  meta?: {
    reason?: string;
  };
};

type LiveCourierLocationResponse = {
ok?: boolean;
freshness?: "live" | "recent" | "stale" | "stopped" | "missing";
ageSeconds?: number | null;
location?: {
active?: boolean;
courierName?: string;
stage?: "to_restaurant" | "to_customer";
point?: {
latitude?: number;
longitude?: number;
headingDegrees?: number;
accuracyMeters?: number;
capturedAt?: string;
};
} | null;
};

type DeliveredTruthOrder = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: string;
  restaurant?: string | {
    id?: string;
    slug?: string;
    name?: string;
    address?: string | Record<string, unknown>;
    location?: Record<string, unknown>;
    latitude?: number;
    longitude?: number;
  };
  restaurantId?: string;
  restaurantName?: string;
  restaurantAddress?: string | Record<string, unknown>;
  restaurantLocation?: Record<string, unknown>;
  merchantName?: string;
  delivery?: { address?: string | Record<string, unknown>; location?: Record<string, unknown> };
  deliveryAddress?: string | Record<string, unknown>;
  customer?: { address?: string | Record<string, unknown>; location?: Record<string, unknown> };
  customerAddress?: string | Record<string, unknown>;
};

function deliveredTruthId(order?: DeliveredTruthOrder): string {
  return String(
    order?.publicId ||
      order?.orderId ||
      order?.id ||
      "",
  ).trim();
}

function deliveredTruthStatus(order?: DeliveredTruthOrder): string {
  return String(order?.status || "").trim().toLowerCase();
}

function deliveredTruthRestaurant(order?: DeliveredTruthOrder): string {
  const restaurant = order?.restaurant;
  if (restaurant && typeof restaurant === "object") {
    return String(restaurant.name || order?.restaurantName || order?.merchantName || "Restaurant partenaire").trim();
  }
  return String(order?.restaurantName || restaurant || order?.merchantName || "Restaurant partenaire").trim();
}

function networkKey(value: unknown): string {
  return String(value || "").trim().toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function coordinateFrom(value: unknown): Coordinate | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const latitude = Number(record.latitude ?? record.lat);
  const longitude = Number(record.longitude ?? record.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function addressFrom(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return [record.label, record.line1, record.line2, record.postalCode, record.city, record.countryCode]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(", ");
}

async function geocodeNetworkAddress(address: string): Promise<Coordinate | null> {
  if (!address) return null;
  try {
    const matches = await Location.geocodeAsync(address);
    return matches[0] ? coordinateFrom(matches[0]) : null;
  } catch {
    return null;
  }
}

async function resolveOrderNetworkCoordinates(order: DeliveredTruthOrder): Promise<{
  restaurant: Coordinate;
  client: Coordinate;
}> {
  const restaurant = order.restaurant;
  const restaurantObject = restaurant && typeof restaurant === "object" ? restaurant : null;
  const explicitRestaurant =
    coordinateFrom(order.restaurantLocation) ||
    coordinateFrom(restaurantObject?.location) ||
    coordinateFrom(restaurantObject);
  const explicitClient =
    coordinateFrom(order.delivery?.location) ||
    coordinateFrom(order.customer?.location) ||
    coordinateFrom(order.delivery?.address) ||
    coordinateFrom(order.customer?.address);

  let partner: any = null;
  if (!explicitRestaurant) {
    try {
      const response = await fetch(`${API_BASE_URL}/partners`, { headers: { Accept: "application/json" } });
      const payload = response.ok ? await response.json().catch(() => null) : null;
      const partners = Array.isArray(payload) ? payload : Array.isArray(payload?.partners) ? payload.partners : Array.isArray(payload?.data) ? payload.data : [];
      const wanted = new Set([
        networkKey(order.restaurantId),
        networkKey(restaurantObject?.id),
        networkKey(restaurantObject?.slug),
        networkKey(deliveredTruthRestaurant(order)),
      ].filter(Boolean));
      partner = partners.find((entry: any) => [entry?.id, entry?.slug, entry?.name].map(networkKey).some((key: string) => wanted.has(key))) || null;
    } catch {
      partner = null;
    }
  }

  const partnerPoint = coordinateFrom(partner?.location) || coordinateFrom(partner);
  const restaurantAddress =
    addressFrom(order.restaurantAddress) ||
    addressFrom(restaurantObject?.address) ||
    addressFrom(partner?.address);
  const clientAddress =
    addressFrom(order.delivery?.address) ||
    addressFrom(order.deliveryAddress) ||
    addressFrom(order.customerAddress) ||
    addressFrom(order.customer?.address);
  const geocodedRestaurant = explicitRestaurant || partnerPoint ? null : await geocodeNetworkAddress(restaurantAddress);
  const geocodedClient = explicitClient ? null : await geocodeNetworkAddress(clientAddress);

  return {
    restaurant: explicitRestaurant || partnerPoint || geocodedRestaurant || DEFAULT_RESTAURANT,
    client: explicitClient || geocodedClient || DEFAULT_CLIENT,
  };
}

function normalizeDeliveredTruthOrders(
  payload: unknown,
): DeliveredTruthOrder[] {
  if (Array.isArray(payload)) {
    return payload as DeliveredTruthOrder[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  for (const key of ["orders", "items", "data", "results"]) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value as DeliveredTruthOrder[];
    }

    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;

      for (const nestedKey of ["orders", "items", "data", "results"]) {
        const nestedValue = nested[nestedKey];

        if (Array.isArray(nestedValue)) {
          return nestedValue as DeliveredTruthOrder[];
        }
      }
    }
  }

  return [];
}


function coordinateProgress(route: Coordinate[], point: Coordinate): number {
if (route.length < 2) return 0;
let bestIndex = 0;
let bestDistance = Number.POSITIVE_INFINITY;
route.forEach((candidate, index) => {
const lat = candidate.latitude - point.latitude;
const lng = candidate.longitude - point.longitude;
const distance = lat * lat + lng * lng;
if (distance < bestDistance) {
bestDistance = distance;
bestIndex = index;
}
});
return Math.max(0, Math.min(1, bestIndex / (route.length - 1)));
}

function liveSignalLabel(
freshness: LiveCourierLocationResponse["freshness"],
ageSeconds?: number | null,
): string {
if (freshness === "live") return ageSeconds ? `Signal réel · ${ageSeconds}s` : "Signal réel";
if (freshness === "recent") return ageSeconds ? `Signal récent · ${ageSeconds}s` : "Signal récent";
if (freshness === "stale") return "Signal à rafraîchir";
if (freshness === "stopped") return "Partage arrêté";
return "En attente du coursier";
}

type MapsModule = {
  default: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  Polyline: React.ComponentType<any>;
};

function detectNativeMaps(): boolean {
  try {
    // DA_P4A5H_IPA_PROVEN_FABRIC_GUARD_V1
    const getConfig = (UIManager as any).getViewManagerConfig;
    if (typeof getConfig === "function" && getConfig("AIRMap")) return true;
    if (Boolean((UIManager as any).AIRMap)) return true;

    // Expo SDK 54 / Fabric can hide a linked native component from the
    // legacy UIManager registry. This fallback is enabled only after the
    // installed P4A5D IPA has proven native Maps symbols.
    try {
      const mapsModule = require("react-native-maps");
      return Boolean((globalThis as any).nativeFabricUIManager && mapsModule?.default);
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

function loadMapsModule(): MapsModule | null {
  try {
    // DA_P4A5J_IPA_PROVEN_MAPS_MODULE_LOADER_V1
    const loaded = require("react-native-maps") as any;
    const moduleNamespace =
      loaded?.default?.Marker && loaded?.default?.Polyline
        ? loaded.default
        : loaded;

    const MapView =
      moduleNamespace?.default ||
      moduleNamespace?.MapView ||
      loaded?.default;
    const Marker =
      moduleNamespace?.Marker ||
      loaded?.Marker ||
      loaded?.default?.Marker;
    const Polyline =
      moduleNamespace?.Polyline ||
      loaded?.Polyline ||
      loaded?.default?.Polyline;

    if (!MapView || !Marker || !Polyline) {
      return null;
    }

    return {
      default: MapView,
      Marker,
      Polyline,
    };
  } catch (error) {
    console.warn("[DA_P4A5J] react-native-maps load failed", error);
    return null;
  }
}
// DA_P4A5J_IPA_PROVEN_MAPS_MODULE_LOADER_V1

function decodePolyline(encoded: string): Coordinate[] {
  const points: Coordinate[] = [];
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

function thinRoute(points: Coordinate[], maxPoints = 90): Coordinate[] {
  if (points.length <= maxPoints) return points;
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const thinned = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (thinned[thinned.length - 1] !== last) thinned.push(last);
  return thinned;
}

function formatDistance(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return "—";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1).replace(".", ",")} km`;
}

type StoryStage =
  | "kitchen"
  | "pickup"
  | "journey"
  | "approach"
  | "handoff"
  | "delivered";

type StoryModel = {
  stage: StoryStage;
  stepIndex: number;
  liveLabel: string;
  title: string;
  subtitle: string;
  kicker: string;
  status: string;
};

function storySteps(restaurantName: string) {
  return [
    { icon: "🍲", label: restaurantName || "Restaurant" },
    { icon: "🛵", label: "Trajet" },
    { icon: "⌂", label: "Remise" },
  ] as const;
}

function resolveStoryModel({
  orderDelivered,
  orderLifecycleStatus,
  progressValue,
  remainingEtaMinutes,
  arrivalPresenceReady,
  restaurantName,
  hasUsableLiveLocation,
}: {
  orderDelivered: boolean;
  orderLifecycleStatus: string;
  progressValue: number;
  remainingEtaMinutes: number;
  arrivalPresenceReady: boolean;
  restaurantName: string;
  hasUsableLiveLocation: boolean;
}): StoryModel {
  if (orderDelivered) {
    return {
      stage: "delivered",
      stepIndex: 2,
      liveLabel: "LIVRÉE",
      title: "Bon appétit.",
      subtitle:
        "Le voyage se termine. Votre expérience DelishAfrica peut commencer.",
      kicker: "COMMANDE LIVRÉE",
      status: "Votre commande vous a été remise.",
    };
  }

  if (orderLifecycleStatus !== "picked_up") {
    if (orderLifecycleStatus === "ready") {
      return {
        stage: "pickup",
        stepIndex: 0,
        liveLabel: "PRÊTE",
        title: `Votre coursier rejoint ${restaurantName}.`,
        subtitle:
          "La commande est prête. Le trajet s’animera après la récupération.",
        kicker: "PRÊTE AU DÉPART",
        status: "Votre coursier doit encore récupérer la commande.",
      };
    }

    return {
      stage: "kitchen",
      stepIndex: 0,
      liveLabel: "EN COURS",
      title: `${restaurantName} prépare votre commande.`,
      subtitle:
        "Chaque étape devient visible, sans vous noyer dans la technique.",
      kicker: "EN CUISINE",
      status:
        orderLifecycleStatus === "accepted"
          ? "La cuisine est en mouvement."
          : "Votre commande est bien confirmée.",
    };
  }

  if (!hasUsableLiveLocation) {
    return {
      stage: "pickup",
      stepIndex: 1,
      liveLabel: "EN ATTENTE",
      title: "Le suivi démarre avec le signal réel du coursier.",
      subtitle:
        "La commande est récupérée, mais aucun point terrain récent n’est encore partagé.",
      kicker: "SIGNAL COURIER ATTENDU",
      status: "En attente du coursier",
    };
  }

  if (progressValue >= 1) {
    return arrivalPresenceReady
      ? {
          stage: "handoff",
          stepIndex: 2,
          liveLabel: "ARRIVÉ",
          title: "La remise commence.",
          subtitle:
            "Le coursier est au point de destination et attend la confirmation terrain.",
          kicker: "REMISE EN COURS",
          status: "Le coursier vous retrouve à l’adresse indiquée.",
        }
      : {
          stage: "handoff",
          stepIndex: 2,
          liveLabel: "ARRIVÉ",
          title: "Votre coursier est arrivé.",
          subtitle:
            "La carte se concentre sur les derniers instants avant la remise.",
          kicker: "COURSIER ARRIVÉ",
          status: "La remise va commencer.",
        };
  }

  if (progressValue >= 0.82) {
    return {
      stage: "approach",
      stepIndex: 1,
      liveLabel: "PROCHE",
      title: "Votre coursier approche.",
      subtitle: "Les derniers mètres deviennent le centre de l’expérience.",
      kicker: "ARRIVÉE IMMINENTE",
      status: "Préparez-vous, votre coursier est tout proche.",
    };
  }

  return {
    stage: "journey",
    stepIndex: 1,
    liveLabel: "LIVE",
    title: "Votre commande avance vers vous.",
    subtitle: `${remainingEtaMinutes} min estimées avant la remise.`,
    kicker: "COURSIER EN MOUVEMENT",
    status: `Arrivée estimée · ${remainingEtaMinutes} min`,
  };
}

function MotionAwarePanel({
  reduceMotion,
  direction,
  delay,
  children,
}: {
  reduceMotion: boolean;
  direction: "top" | "bottom";
  delay?: number;
  children: React.ReactNode;
}) {
  if (reduceMotion) return <>{children}</>;

  return (
    <MotionMapEntrance direction={direction} delay={delay}>
      {children}
    </MotionMapEntrance>
  );
}

function FlowPulse({
  active,
  reduceMotion,
  color,
}: {
  active: boolean;
  reduceMotion: boolean;
  color: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);

    if (!active || reduceMotion) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1150,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1150,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [active, progress, reduceMotion]);

  if (!active || reduceMotion) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flowPulse,
        {
          backgroundColor: color,
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.34, 0],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.62],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export default function MapsLiveLabScreen() {
  // DA_V3C11F_ROUTE_PARAMS
  const routeParams = useLocalSearchParams<{
    orderId?: string | string[];
    publicId?: string | string[];
  }>();

  const routeOrderId = String(
    Array.isArray(routeParams.publicId)
      ? routeParams.publicId[0]
      : routeParams.publicId ||
        (Array.isArray(routeParams.orderId) ? routeParams.orderId[0] : routeParams.orderId) ||
        ""
  ).trim();


  // DA_P3B5_DELIVERED_TRUTH_BRIDGE_RUNTIME_V2_V1E
  const [orderDelivered, setOrderDelivered] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<DeliveredTruthOrder | null>(null);
  const [restaurantCoordinate, setRestaurantCoordinate] = useState<Coordinate>(DEFAULT_RESTAURANT);
  const [clientCoordinate, setClientCoordinate] = useState<Coordinate>(DEFAULT_CLIENT);
  const hydratedOrderRef = useRef("");
  // DA_P3C2_CLIENT_ORDER_TRUTH_ENGINE_RUNTIME_V2_V1
  const [orderLifecycleStatus, setOrderLifecycleStatus] =
    useState("pending");
  const deliveredTruthInFlightRef = useRef(false);
const liveLocationInFlightRef = useRef(false);
const [liveLocation, setLiveLocation] = useState<LiveCourierLocationResponse | null>(null);

  const [nativeReady, setNativeReady] = useState(false);
  const [mapsModule, setMapsModule] = useState<MapsModule | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>(buildFallbackRoute(DEFAULT_RESTAURANT, DEFAULT_CLIENT));
  const [routeInfo, setRouteInfo] = useState<RoutePreviewResponse>({
    provider: "local_preview",
    etaMinutes: 12,
    distanceMeters: 0,
    fallback: true,
  });
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [followCourier, setFollowCourier] = useState(true);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const mountedRef = useRef(true);
  const mapReadyRef = useRef(false);
  const lastAutoStageRef = useRef<StoryStage | null>(null);
  const mapRef = useRef<any>(null);
  const { height: viewportHeight } = useWindowDimensions();

  useEffect(() => {
    mountedRef.current = true;
    const registrySignal = detectNativeMaps();
    const loadedMapsModule = loadMapsModule();
    const moduleLoaded = Boolean(loadedMapsModule);

    setMapsModule(loadedMapsModule);
    setNativeReady(moduleLoaded);

    console.info("[DA_P4A5J_MAPS_RUNTIME]", {
      platform: Platform.OS,
      moduleLoaded,
      registrySignal,
      nativeReady: moduleLoaded,
    });

    if (!registrySignal && loadedMapsModule) {
      console.info(
        "[DA_P4A5J] Fabric registry hidden; using the IPA-proven native Maps module.",
      );
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotionEnabled(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const identity = deliveredTruthId(trackedOrder);
    if (!trackedOrder || !identity || hydratedOrderRef.current === identity) return;
    hydratedOrderRef.current = identity;
    let cancelled = false;
    void resolveOrderNetworkCoordinates(trackedOrder).then((resolved) => {
      if (cancelled) return;
      setRestaurantCoordinate(resolved.restaurant);
      setClientCoordinate(resolved.client);
    });
    return () => {
      cancelled = true;
    };
  }, [trackedOrder]);

  const loadRealRoute = async () => {
    setLoadingRoute(true);
    setRouteError(null);

    try {
      const response = await fetch(ROUTES_PREVIEW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lat: COURIER_START.latitude, lng: COURIER_START.longitude },
          destination: { lat: clientCoordinate.latitude, lng: clientCoordinate.longitude },
          waypoints: [{ lat: restaurantCoordinate.latitude, lng: restaurantCoordinate.longitude }],
          mode: "DRIVE",
          // DA_V3C11F_ORDER_ID_BRIDGE
          orderId: routeOrderId || undefined,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as RoutePreviewResponse;
      const decoded = data.polyline ? thinRoute(decodePolyline(data.polyline)) : [];

      if (!mountedRef.current) return;

      setRouteInfo(data);
      setRouteCoordinates(decoded.length >= 2 ? decoded : buildFallbackRoute(restaurantCoordinate, clientCoordinate));
      setRunning(true);
    } catch (error) {
      if (!mountedRef.current) return;
      setRouteCoordinates(buildFallbackRoute(restaurantCoordinate, clientCoordinate));
      setRouteInfo({
        provider: "local_preview",
        etaMinutes: 12,
        distanceMeters: 0,
        fallback: true,
      });
      setRouteError(error instanceof Error ? error.message : "Route indisponible");
    } finally {
      if (mountedRef.current) setLoadingRoute(false);
    }
  };

  useEffect(() => {
    void loadRealRoute();
  }, [restaurantCoordinate.latitude, restaurantCoordinate.longitude, clientCoordinate.latitude, clientCoordinate.longitude]);

  // DA_P3A1_LIVE_MAP_ENGINE_FOUNDATION_RUNTIME_V2_V1
  const { courier, heading } = useLiveMapEngine({
    routeCoordinates,
    running: false,
    enabled: nativeReady && Boolean(mapsModule),
    cycleDurationMs: reduceMotionEnabled ? 26000 : 18000,
    tickMs: reduceMotionEnabled ? 320 : 80,
  });

  const livePoint = liveLocation?.location?.point;
  const hasUsableLiveLocation = Boolean(
    liveLocation?.ok &&
      liveLocation.location?.active &&
      (liveLocation.freshness === "live" || liveLocation.freshness === "recent") &&
      Number.isFinite(Number(livePoint?.latitude)) &&
      Number.isFinite(Number(livePoint?.longitude)),
  );
  const visibleCourier: Coordinate = hasUsableLiveLocation
    ? {
        latitude: Number(livePoint?.latitude),
        longitude: Number(livePoint?.longitude),
      }
    : courier;
  const visibleHeading =
    hasUsableLiveLocation && Number.isFinite(Number(livePoint?.headingDegrees))
      ? Number(livePoint?.headingDegrees)
      : heading;
  const visibleProgressValue = hasUsableLiveLocation
    ? coordinateProgress(routeCoordinates, visibleCourier)
    : 0;
  const visibleProgress = Math.round(visibleProgressValue * 100);
  const liveJourneyVisible =
    hasUsableLiveLocation &&
    orderLifecycleStatus === "picked_up" &&
    !orderDelivered;

  // DA_P3B2_ARRIVAL_PRESENCE_SEQUENCE_ENGINE_RUNTIME_V2_V1B
  const [arrivalPresenceReady, setArrivalPresenceReady] =
    useState(false);

  // DA_P3B4_TERMINAL_PRESENCE_MOTION_ENGINE_RUNTIME_V2_V1D
  const terminalPresenceMotion =
    useRef(new Animated.Value(1)).current;


  useEffect(() => {
    if (visibleProgressValue < 1) {
      setArrivalPresenceReady(false);
      return;
    }

    const arrivalPresenceTimer = setTimeout(() => {
      setArrivalPresenceReady(true);
    }, 1800);

    return () => clearTimeout(arrivalPresenceTimer);
  }, [visibleProgressValue]);


  useEffect(() => {
    let cancelled = false;
    let deliveredTruthInterval: ReturnType<typeof setInterval> | null =
      null;

    async function refreshDeliveredTruth() {
      if (!routeOrderId || deliveredTruthInFlightRef.current) {
        return;
      }

      deliveredTruthInFlightRef.current = true;

      try {
        const response = await daOrdersFetch(
          `${API_BASE_URL}/orders/demo/list`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
        );

        const responseText = await response.text();
        const payload = responseText
          ? JSON.parse(responseText)
          : null;

        if (!response.ok) {
          throw new Error(
            `Delivered truth unavailable (${response.status})`,
          );
        }

        const matchingOrder = normalizeDeliveredTruthOrders(
          payload,
        ).find((order) => deliveredTruthId(order) === routeOrderId);

        const matchingStatus =
          deliveredTruthStatus(matchingOrder);
        const delivered =
          matchingStatus === "delivered" ||
          matchingStatus === "completed";

        if (!cancelled) {
          setTrackedOrder(matchingOrder || null);
          setOrderLifecycleStatus(matchingStatus || "pending");
          setOrderDelivered(delivered);
        }

        if (delivered && deliveredTruthInterval) {
          clearInterval(deliveredTruthInterval);
          deliveredTruthInterval = null;
        }
      } catch {
        // Preserve the current UI state on transient read failures.
      } finally {
        deliveredTruthInFlightRef.current = false;
      }
    }

    void refreshDeliveredTruth();

    if (!orderDelivered && routeOrderId) {
      deliveredTruthInterval = setInterval(() => {
        void refreshDeliveredTruth();
      }, 3000);
    }

    return () => {
      cancelled = true;

      if (deliveredTruthInterval) {
        clearInterval(deliveredTruthInterval);
      }
    };
  }, [orderDelivered, routeOrderId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function refreshLiveLocation() {
      if (!routeOrderId || liveLocationInFlightRef.current) return;
      liveLocationInFlightRef.current = true;
      try {
        const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/location/get`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ orderId: routeOrderId }),
        });
        const payload = (await response.json().catch(() => null)) as LiveCourierLocationResponse | null;
        if (!cancelled && response.ok) setLiveLocation(payload);
      } catch {
        // Preserve the last known point during a transient network gap.
      } finally {
        liveLocationInFlightRef.current = false;
      }
    }

    void refreshLiveLocation();
    if (routeOrderId && !orderDelivered) {
      timer = setInterval(() => void refreshLiveLocation(), 4000);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [orderDelivered, routeOrderId]);

  useEffect(() => {
    if (!arrivalPresenceReady || reduceMotionEnabled) {
      terminalPresenceMotion.setValue(1);
      return;
    }

    terminalPresenceMotion.setValue(0);

    const terminalPresenceAnimation = Animated.timing(
      terminalPresenceMotion,
      {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      },
    );

    terminalPresenceAnimation.start();

    return () => terminalPresenceAnimation.stop();
  }, [arrivalPresenceReady, reduceMotionEnabled, terminalPresenceMotion]);




  // DA_P3A3_SMART_CAMERA_ENGINE_RUNTIME_V2_V1
  useSmartCamera({
    mapRef,
    courier: visibleCourier,
    heading: visibleHeading,
    running: running && liveJourneyVisible,
    enabled:
      nativeReady &&
      Boolean(mapsModule) &&
      liveJourneyVisible &&
      followCourier &&
      !reduceMotionEnabled,
    throttleMs: 650,
  });

  const routeSourceLabel =
    routeInfo.provider === "google_routes" && !routeInfo.fallback && !routeError
      ? "Trajet vérifié"
      : "Continuité locale";
  const routeDistanceLabel = formatDistance(routeInfo.distanceMeters || 0);
  const routeSummary =
    routeDistanceLabel === "—"
      ? routeSourceLabel
      : `${routeSourceLabel} · ${routeDistanceLabel}`;
  const etaMinutes = Math.max(
    1,
    Math.round(routeInfo.etaMinutes || 12),
  );

  // DA_P3A10C_LIVE_ETA_COUNTDOWN_ENGINE_RUNTIME_V2_V1
  const remainingProgress = Math.max(
    0,
    1 - Math.max(0, Math.min(1, visibleProgressValue)),
  );
  const remainingEtaMinutes = Math.max(
    1,
    Math.ceil(etaMinutes * remainingProgress),
  );

  const trackedRestaurantName = deliveredTruthRestaurant(trackedOrder);
  const story = resolveStoryModel({
    orderDelivered,
    orderLifecycleStatus,
    progressValue: visibleProgressValue,
    remainingEtaMinutes,
    arrivalPresenceReady,
    restaurantName: trackedRestaurantName,
    hasUsableLiveLocation,
  });
  const activeStorySteps = storySteps(trackedRestaurantName);
  const compactLayout =
    viewportHeight < 780 ||
    story.stage === "journey" ||
    story.stage === "approach" ||
    story.stage === "handoff";
  const canControlJourney =
    liveJourneyVisible && visibleProgressValue < 1;
  const cameraFollowLabel =
    visibleProgressValue >= 1
      ? "Centrer la remise"
      : reduceMotionEnabled
        ? "Centrer le coursier"
        : followCourier
          ? "Suivi auto"
          : "Reprendre le suivi";

  const fitJourney = () => {
    if (!mapReadyRef.current || routeCoordinates.length < 2) return;

    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates?.(routeCoordinates, {
        edgePadding: {
          top: compactLayout ? 178 : 236,
          right: 52,
          bottom: compactLayout ? 278 : 326,
          left: 52,
        },
        animated: !reduceMotionEnabled,
      });
    });
  };

  const focusCourierNow = () => {
    if (!mapReadyRef.current) return;

    setFollowCourier(true);
    requestAnimationFrame(() => {
      mapRef.current?.animateCamera?.(
        {
          center: visibleCourier,
          heading: visibleHeading,
          pitch: 42,
          zoom: 16.1,
        },
        { duration: reduceMotionEnabled ? 0 : 480 },
      );
    });
  };

  const focusHandoff = () => {
    if (!mapReadyRef.current) return;

    setFollowCourier(false);
    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates?.([visibleCourier, clientCoordinate], {
        edgePadding: {
          top: compactLayout ? 190 : 240,
          right: 72,
          bottom: compactLayout ? 286 : 334,
          left: 72,
        },
        animated: !reduceMotionEnabled,
      });
    });
  };

  const handleMapReady = () => {
    mapReadyRef.current = true;
    setTimeout(() => fitJourney(), 180);
  };

  const handleFollowPress = () => {
    if (visibleProgressValue >= 1 || orderDelivered) {
      focusHandoff();
      return;
    }

    focusCourierNow();
  };

  useEffect(() => {
    if (
      !mapReadyRef.current ||
      loadingRoute ||
      routeCoordinates.length < 2 ||
      liveJourneyVisible
    ) {
      return;
    }

    const timer = setTimeout(() => fitJourney(), 180);
    return () => clearTimeout(timer);
  }, [loadingRoute, liveJourneyVisible, routeCoordinates]);

  useEffect(() => {
    if (!mapReadyRef.current || lastAutoStageRef.current === story.stage) {
      return;
    }

    lastAutoStageRef.current = story.stage;

    if (story.stage === "journey") {
      setFollowCourier(true);
      focusCourierNow();
      return;
    }

    if (
      story.stage === "handoff" ||
      story.stage === "delivered"
    ) {
      const timer = setTimeout(() => focusHandoff(), 120);
      return () => clearTimeout(timer);
    }

    if (story.stage === "kitchen" || story.stage === "pickup") {
      setFollowCourier(false);
      const timer = setTimeout(() => fitJourney(), 120);
      return () => clearTimeout(timer);
    }
  }, [story.stage]);

  if (!nativeReady || !mapsModule) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.fallbackContent}>
          <Text style={styles.eyebrow}>DELISHAFRICA® · SUIVI ESSENTIEL</Text>
          <Text style={styles.fallbackTitle}>Carte momentanément indisponible</Text>
          <Text style={styles.fallbackText}>
            La carte native n’a pas pu être chargée dans cette session. Votre commande et son suivi restent préservés.
          </Text>
          <View style={styles.diagnosticCard}>
            <Text style={styles.diagnosticLabel}>Suivi</Text>
            <Text style={styles.diagnosticValue}>Votre commande reste synchronisée.</Text>
            <Text style={styles.diagnosticLabel}>Action</Text>
            <Text style={styles.diagnosticValue}>Revenez à l’écran précédent puis réessayez.</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Revenir sans risque</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const MapView = mapsModule.default;
  const Marker = mapsModule.Marker;
  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: (restaurantCoordinate.latitude + clientCoordinate.latitude) / 2,
          longitude: (restaurantCoordinate.longitude + clientCoordinate.longitude) / 2,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }}
        pitchEnabled
        rotateEnabled
        showsCompass={false}
        showsUserLocation={false}
        onMapReady={handleMapReady}
        onPanDrag={() => setFollowCourier(false)}
        accessibilityLabel={`Carte de suivi. ${story.title} ${story.status}`}
      >
        {/* DA_P3A4_LIVE_ROUTE_ENGINE_RUNTIME_V2_V1 */}
        <LiveRouteEngine
          routeCoordinates={routeCoordinates}
          progressValue={visibleProgressValue}
          baseColor={"#B76A3A"}
          baseWidth={6}
        />

        <Marker coordinate={restaurantCoordinate} title={trackedRestaurantName} description="Restaurant partenaire">
          <View style={[styles.marker, styles.restaurantMarker]}>
            <Text style={styles.markerEmoji}>🍲</Text>
          </View>
        </Marker>

        {/* DA_P3A7_DESTINATION_APPROACH_ENGINE_RUNTIME_V2_V1 */}
        <Marker
          coordinate={clientCoordinate}
          title="Destination"
          description="Adresse client"
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <DestinationApproachMarker progressValue={visibleProgressValue} />
        </Marker>

        {/* DA_P3A2_COURIER_MARKER_ROTATION_RUNTIME_V2_V1 */}
        {/* DA_P3A5_LIVING_COURIER_MARKER_RUNTIME_V2_V1 */}
        {liveJourneyVisible ? (
<LivingCourierMarker
          coordinate={visibleCourier}
          heading={visibleHeading}
          running={running || hasUsableLiveLocation}
        />
        ) : null}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <MotionAwarePanel reduceMotion={reduceMotionEnabled} direction="top">
          <View style={[styles.topCard, compactLayout && styles.topCardCompact]}>
            <View style={styles.topRow}>
              <View style={styles.topTextColumn}>
                <Text style={styles.eyebrow}>DELISHAFRICA® · SUIVI ESSENTIEL</Text>
                <Text
                  style={[styles.title, compactLayout && styles.titleCompact]}
                  numberOfLines={2}
                >
                  {story.title}
                </Text>
              </View>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{story.liveLabel}</Text>
              </View>
            </View>
            <Text
              style={[styles.subtitle, compactLayout && styles.subtitleCompact]}
              numberOfLines={compactLayout ? 2 : 3}
            >
              {story.subtitle}
            </Text>
            <View style={styles.sourceRow}>
              {loadingRoute ? (
                <ActivityIndicator size="small" color="#E7B88E" />
              ) : null}
              <Text style={styles.sourceText} numberOfLines={1}>
                {loadingRoute
                  ? "Nous dessinons votre trajet…"
                  : `${routeSummary} · ${liveSignalLabel(liveLocation?.freshness, liveLocation?.ageSeconds)}`}
              </Text>
            </View>
            {routeError ? (
              <Text style={styles.routeWarning}>
                Réseau instable · la continuité de trajet reste active
              </Text>
            ) : null}
            <View style={styles.liveTruthRow}>
              <View style={[styles.liveTruthDot, hasUsableLiveLocation && styles.liveTruthDotActive]} />
              <Text style={styles.liveTruthText} numberOfLines={1}>
                {hasUsableLiveLocation
                  ? `${liveLocation?.location?.courierName || "Coursier"} · position terrain`
                  : liveSignalLabel(liveLocation?.freshness, liveLocation?.ageSeconds)}
              </Text>
            </View>
          </View>
        </MotionAwarePanel>

        <View pointerEvents="box-none" style={styles.cameraTools}>
          {liveJourneyVisible ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cameraFollowLabel}
              accessibilityHint="Replace la carte sur le coursier et reprend le suivi automatique lorsque les animations sont autorisées."
              style={[
                styles.cameraPill,
                followCourier && !reduceMotionEnabled && styles.cameraPillActive,
              ]}
              onPress={handleFollowPress}
            >
              <Text style={styles.cameraPillIcon}>◎</Text>
              <Text
                style={[
                  styles.cameraPillText,
                  followCourier &&
                    !reduceMotionEnabled &&
                    styles.cameraPillTextActive,
                ]}
              >
                {cameraFollowLabel}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir tout le trajet"
            accessibilityHint="Ajuste la carte pour afficher l’ensemble du trajet DelishAfrica."
            style={styles.cameraPill}
            onPress={() => {
              setFollowCourier(false);
              fitJourney();
            }}
          >
            <Text style={styles.cameraPillIcon}>⌁</Text>
            <Text style={styles.cameraPillText}>Tout voir</Text>
          </Pressable>
        </View>

        <MotionAwarePanel
          reduceMotion={reduceMotionEnabled}
          direction="bottom"
          delay={70}
        >
          <View style={styles.bottomArea}>
            <View
              style={[
                styles.statusCard,
                compactLayout && styles.statusCardCompact,
              ]}
            >
              <View style={styles.statusHeader}>
                <Animated.View
                  style={[
                    styles.statusCopy,
                    {
                      opacity: terminalPresenceMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1],
                      }),
                      transform: [
                        {
                          translateY: terminalPresenceMotion.interpolate({
                            inputRange: [0, 1],
                            outputRange: [8, 0],
                          }),
                        },
                        {
                          scale: terminalPresenceMotion.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.985, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.statusLabel}>{story.kicker}</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      compactLayout && styles.statusValueCompact,
                    ]}
                  >
                    {story.status}
                  </Text>
                </Animated.View>
                <Text
                  style={styles.progressText}
                  numberOfLines={1}
                  accessibilityLabel={`Progression ${visibleProgress} pour cent`}
                >
                  {visibleProgress}%
                </Text>
              </View>

              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Progression du trajet"
                accessibilityValue={{ min: 0, max: 100, now: visibleProgress }}
                style={styles.progressTrack}
              >
                <View style={[styles.progressFill, { width: `${visibleProgress}%` }]} />
              </View>

              <Text style={styles.handoffCaption}>CUISINE → TRAJET → REMISE</Text>

              <View style={styles.storyRail}>
                {activeStorySteps.map((step, index) => {
                  const active = index === story.stepIndex;
                  const done =
                    index < story.stepIndex || story.stage === "delivered";

                  return (
                    <View
                      key={step.label}
                      accessible
                      accessibilityLabel={`${step.label}. ${done ? "étape terminée" : active ? "étape actuelle" : "étape à venir"}`}
                      style={[
                        styles.storyStep,
                        active && styles.storyStepActive,
                        done && styles.storyStepDone,
                      ]}
                    >
                      <View style={styles.storyStepIconWrap}>
                        <FlowPulse
                          active={active}
                          reduceMotion={reduceMotionEnabled}
                          color="rgba(197,116,61,0.42)"
                        />
                        <Text style={styles.storyStepIcon}>
                          {done ? "✓" : step.icon}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.storyStepText,
                          active && styles.storyStepTextActive,
                          done && styles.storyStepTextDone,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    canControlJourney
                      ? running
                        ? "Mettre le mouvement en pause"
                        : "Reprendre le mouvement"
                      : "Voir l’ensemble du trajet"
                  }
                  style={styles.secondaryButton}
                  onPress={() => {
                    if (canControlJourney) {
                      setRunning((value) => !value);
                    } else {
                      setFollowCourier(false);
                      fitJourney();
                    }
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {canControlJourney
                      ? running
                        ? "Mettre en pause"
                        : "Reprendre"
                      : "Voir le trajet"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recalculer le trajet"
                  accessibilityState={{ disabled: loadingRoute }}
                  disabled={loadingRoute}
                  style={[
                    styles.refreshButton,
                    loadingRoute && styles.buttonDisabled,
                  ]}
                  onPress={() => void loadRealRoute()}
                >
                  <Text style={styles.refreshButtonText}>↻</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Revenir au suivi de commande"
                  style={styles.primaryButtonCompact}
                  onPress={() => router.back()}
                >
                  <Text style={styles.primaryButtonText}>Retour à la commande</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </MotionAwarePanel>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5EFE8" },
  safeArea: { flex: 1, backgroundColor: "#17120F" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  topCard: {
    marginTop: Platform.OS === "android" ? 18 : 8,
    borderRadius: 26,
    padding: 18,
    backgroundColor: "rgba(23,18,15,0.92)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 8,
  },
  topCardCompact: { padding: 15, borderRadius: 24 },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  topTextColumn: { flex: 1 },
  eyebrow: { color: "#E7B88E", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  title: {
    marginTop: 6,
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 31,
  },
  titleCompact: { fontSize: 23, lineHeight: 27 },
  subtitle: {
    marginTop: 10,
    color: "#DDD3CD",
    fontSize: 14,
    lineHeight: 20,
  },
  subtitleCompact: { marginTop: 7, fontSize: 13, lineHeight: 18 },
  sourceRow: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  sourceText: { color: "#E7B88E", fontSize: 12, fontWeight: "700" },
  routeWarning: { marginTop: 6, color: "#F2C9A7", fontSize: 11, fontWeight: "600" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(37,127,91,0.22)" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#54D39A" },
  liveText: { color: "#7CE3B5", fontSize: 12, fontWeight: "900", letterSpacing: 1.1 },
  liveTruthRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveTruthDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#8F7E75",
  },
  liveTruthDotActive: {
    backgroundColor: "#46D397",
    shadowColor: "#46D397",
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  liveTruthText: {
    flex: 1,
    color: "#E8D7C8",
    fontSize: 12,
    fontWeight: "800",
  },
  cameraTools: {
    alignItems: "flex-end",
    alignSelf: "flex-end",
    gap: 8,
  },
  cameraPill: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,252,248,0.94)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  cameraPillActive: {
    borderColor: "rgba(84,211,154,0.68)",
    backgroundColor: "rgba(28,67,50,0.94)",
  },
  cameraPillIcon: { color: "#6A4330", fontSize: 16, fontWeight: "900" },
  cameraPillText: { color: "#4A3429", fontSize: 12, fontWeight: "900" },
  cameraPillTextActive: { color: "#92E8BE" },
  bottomArea: { paddingBottom: Platform.OS === "android" ? 12 : 2 },
  statusCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(255,252,248,0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 8,
  },
  statusCardCompact: { padding: 16, borderRadius: 26 },
  statusHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  statusCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  statusLabel: { color: "#7A4C2C", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  statusValue: {
    marginTop: 5,
    color: "#211814",
    fontSize: 23,
    fontWeight: "900",
    flexShrink: 1,
  },
  statusValueCompact: { fontSize: 21, lineHeight: 25 },
  progressText: { minWidth: 58, flexShrink: 0, textAlign: "right", color: "#A34E23", fontSize: 25, fontWeight: "900" },
  progressTrack: { height: 8, marginTop: 18, overflow: "hidden", borderRadius: 999, backgroundColor: "#E9DDD4" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#B76A3A" },
  handoffCaption: { color: "rgba(255,255,255,0.56)", fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginTop: 15, marginBottom: 9 },
  storyRail: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  storyStep: {
    flex: 1,
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2D7CF",
    backgroundColor: "rgba(255,255,255,0.62)",
  },
  storyStepActive: {
    borderColor: "#C5743D",
    backgroundColor: "rgba(197,116,61,0.13)",
  },
  storyStepDone: {
    borderColor: "rgba(47,138,105,0.42)",
    backgroundColor: "rgba(47,138,105,0.10)",
  },
  storyStepIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  flowPulse: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 999,
  },
  storyStepIcon: { fontSize: 15, lineHeight: 18 },
  storyStepText: { color: "#75645A", fontSize: 11, fontWeight: "800" },
  storyStepTextActive: { color: "#8A4828" },
  storyStepTextDone: { color: "#2F765D" },
  actionsRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 },
  secondaryButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1, borderColor: "#D6C2B4", backgroundColor: "#FFFDFC" },
  secondaryButtonText: { color: "#49372E", fontSize: 14, fontWeight: "800" },
  refreshButton: { width: 50, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 18, borderWidth: 1, borderColor: "#D6C2B4", backgroundColor: "#FFFDFC" },
  refreshButtonText: { color: "#49372E", fontSize: 24, fontWeight: "700" },
  primaryButtonCompact: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#211814" },
  primaryButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#211814" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  buttonDisabled: { opacity: 0.52 },
  marker: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24, borderWidth: 3, borderColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.26, shadowRadius: 8, elevation: 6 },
  markerEmoji: { fontSize: 22 },
  restaurantMarker: { backgroundColor: "#A4522A" },
  clientMarker: { backgroundColor: "#2F8A69" },
  courierMarker: { backgroundColor: "#211814" },
  courierHalo: { padding: 6, borderRadius: 36, backgroundColor: "rgba(183,106,58,0.23)" },
  fallbackContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  fallbackTitle: { marginTop: 12, color: "#FFFFFF", fontSize: 31, lineHeight: 36, fontWeight: "900" },
  fallbackText: { marginTop: 16, color: "#D7CAC2", fontSize: 16, lineHeight: 24 },
  diagnosticCard: { marginTop: 22, borderRadius: 22, padding: 18, backgroundColor: "#2B211C" },
  diagnosticLabel: { marginTop: 10, color: "#B9A69B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase" },
  diagnosticValue: { marginTop: 4, color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
