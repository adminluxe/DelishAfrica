import { daOrdersFetch } from "../utils/daOrdersApi";
// DA_A5A3A7S16R4_LIVE_LOCATION_TRUTH_V1
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { useJourneyRoute } from "../utils/useJourneyRoute";
import { assessJourneySignal, journeyDestinationPoint, journeyDistanceMeters, journeyPickupPoint, journeyPoint, journeyRouteProgress, journeyTravelMode, type JourneySignal } from "../../../packages/contracts/src/missionJourney";
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

type Coordinate = {
  latitude: number;
  longitude: number;
};

type LiveCourierLocationResponse = JourneySignal;

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

const coordinateFrom = journeyPoint;

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
    if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
    const matches = await Location.geocodeAsync(address);
    return matches[0] ? coordinateFrom(matches[0]) : null;
  } catch {
    return null;
  }
}

async function resolveOrderNetworkCoordinates(order: DeliveredTruthOrder): Promise<{
  restaurant: Coordinate | null;
  client: Coordinate | null;
}> {
  const restaurant = order.restaurant;
  const restaurantObject = restaurant && typeof restaurant === "object" ? restaurant : null;
  const explicitRestaurant = journeyPickupPoint(order);
  const explicitClient = journeyDestinationPoint(order);

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
      const matches = partners.filter((entry: any) => [entry?.id, entry?.slug, entry?.name].map(networkKey).some((key: string) => wanted.has(key)));
      partner = matches.length === 1 ? matches[0] : null;
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
    restaurant: explicitRestaurant || partnerPoint || geocodedRestaurant,
    client: explicitClient || geocodedClient,
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

function resolveStoryModel({ orderDelivered, orderLifecycleStatus, restaurantName, hasUsableLiveLocation, etaLabel, distanceToClient, hasOrder }: {
  orderDelivered: boolean; orderLifecycleStatus: string; restaurantName: string; hasUsableLiveLocation: boolean;
  etaLabel: string | null; distanceToClient: number | null; hasOrder: boolean;
}): StoryModel {
  if (!hasOrder) return { stage: "kitchen", stepIndex: 0, liveLabel: "EN ATTENTE", title: "Votre suivi attend sa commande.", subtitle: "Ouvrez le suivi depuis une commande accessible dans votre compte.", kicker: "COMMANDE À SÉLECTIONNER", status: "Informations en attente" };
  if (orderDelivered) return { stage: "delivered", stepIndex: 2, liveLabel: "LIVRÉE", title: "Bon appétit.", subtitle: "La remise de votre commande est confirmée.", kicker: "COMMANDE LIVRÉE", status: "Votre commande vous a été remise." };
  if (["cancelled", "canceled", "rejected"].includes(orderLifecycleStatus)) return { stage: "kitchen", stepIndex: 0, liveLabel: "CLÔTURÉE", title: "Cette commande est clôturée.", subtitle: "Consultez votre commande pour retrouver les détails.", kicker: "SUIVI TERMINÉ", status: "Le suivi de cette commande est arrêté." };
  if (!["picked_up", "on_the_way", "in_transit"].includes(orderLifecycleStatus)) {
    if (orderLifecycleStatus === "ready") return { stage: "pickup", stepIndex: 0, liveLabel: "PRÊTE", title: `Votre commande est prête chez ${restaurantName}.`, subtitle: "La prochaine étape est sa récupération par le coursier.", kicker: "RETRAIT AU RESTAURANT", status: "La commande attend son départ." };
    return { stage: "kitchen", stepIndex: 0, liveLabel: orderLifecycleStatus === "accepted" ? "EN CUISINE" : "EN ATTENTE", title: orderLifecycleStatus === "accepted" ? `${restaurantName} prépare votre commande.` : "Votre commande attend la confirmation du restaurant.", subtitle: "Vous retrouverez ici chaque étape de votre commande.", kicker: "VOTRE COMMANDE", status: orderLifecycleStatus === "accepted" ? "La préparation est confirmée." : "Confirmation en attente" };
  }
  if (!hasUsableLiveLocation) return { stage: "journey", stepIndex: 1, liveLabel: "À ACTUALISER", title: "Votre commande est en route.", subtitle: "La dernière position attend une actualisation. Le coursier peut continuer sa mission.", kicker: "POSITION EN ATTENTE", status: "Nouvelle position attendue" };
  if (distanceToClient !== null && distanceToClient <= 500) return { stage: "approach", stepIndex: 1, liveLabel: "À PROXIMITÉ", title: "Votre coursier se trouve à proximité.", subtitle: "Gardez vos indications d’accès disponibles pour faciliter la remise.", kicker: "LES DERNIERS MÈTRES", status: "La remise reste à confirmer." };
  return { stage: "journey", stepIndex: 1, liveLabel: "EN ROUTE", title: "Votre commande avance vers vous.", subtitle: etaLabel ? `Trajet restant estimé : ${etaLabel}.` : "L’heure d’arrivée sera précisée dès qu’un itinéraire récent sera disponible.", kicker: "VERS VOTRE ADRESSE", status: etaLabel ? `Arrivée estimée · ${etaLabel}` : "Arrivée à préciser" };
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

function MapsLiveLabScreen() {
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
  const [orderSyncPending, setOrderSyncPending] = useState(true);
  const [restaurantCoordinate, setRestaurantCoordinate] = useState<Coordinate | null>(null);
  const [clientCoordinate, setClientCoordinate] = useState<Coordinate | null>(null);
  // DA_P3C2_CLIENT_ORDER_TRUTH_ENGINE_RUNTIME_V2_V1
  const [orderLifecycleStatus, setOrderLifecycleStatus] =
    useState("pending");
  const deliveredTruthInFlightRef = useRef(false);
const liveLocationInFlightRef = useRef(false);
const [liveLocation, setLiveLocation] = useState<LiveCourierLocationResponse | null>(null);
  const [signalNow, setSignalNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setSignalNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const [nativeReady, setNativeReady] = useState(false);
  const [mapsModule, setMapsModule] = useState<MapsModule | null>(null);
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
    if (!trackedOrder || !identity) { setRestaurantCoordinate(null); setClientCoordinate(null); return; }
    let cancelled = false;
    void resolveOrderNetworkCoordinates(trackedOrder).then((resolved) => {
      if (cancelled) return;
      setRestaurantCoordinate(resolved.restaurant);
      setClientCoordinate(resolved.client);
    });
    return () => {
      cancelled = true;
    };
  }, [deliveredTruthId(trackedOrder || undefined), JSON.stringify(trackedOrder?.restaurantLocation), JSON.stringify(trackedOrder?.restaurant), JSON.stringify(trackedOrder?.delivery), JSON.stringify(trackedOrder?.customer), JSON.stringify(trackedOrder?.deliveryAddress)]);

  const signal = assessJourneySignal(liveLocation, signalNow);
  const hasUsableLiveLocation = signal.usable;
  // A coordinate used for camera calculations is never rendered as a courier without a usable signal.
  const visibleCourier: Coordinate = signal.point || clientCoordinate || restaurantCoordinate || { latitude: 0, longitude: 0 };
  const visibleHeading = Number(liveLocation?.location?.point?.headingDegrees || 0);
  const liveJourneyVisible = hasUsableLiveLocation && ["picked_up", "on_the_way", "in_transit"].includes(orderLifecycleStatus) && !orderDelivered;
  const liveRoute = useJourneyRoute({ apiBaseUrl: API_BASE_URL, orderId: routeOrderId,
    origin: hasUsableLiveLocation ? signal.point : null,
    destination: liveJourneyVisible ? clientCoordinate : restaurantCoordinate,
    mode: journeyTravelMode(liveLocation?.location?.travelMode), phase: orderLifecycleStatus,
    enabled: Boolean(trackedOrder && !orderDelivered && hasUsableLiveLocation && ["ready", "picked_up", "on_the_way", "in_transit"].includes(orderLifecycleStatus)) });
  const routeCoordinates = liveRoute.route?.points || [];
  const loadingRoute = liveRoute.loading;
  const routeError = liveRoute.unavailable;
  const loadRealRoute = liveRoute.refresh;
  const projection = hasUsableLiveLocation ? journeyRouteProgress(routeCoordinates, visibleCourier) : null;
  const visibleProgressValue = projection?.progress || 0;
  const distanceToClient = liveJourneyVisible && clientCoordinate ? journeyDistanceMeters(visibleCourier, clientCoordinate) : null;
  // DA_P3B2_ARRIVAL_PRESENCE_SEQUENCE_ENGINE_RUNTIME_V2_V1B
  const arrivalPresenceReady = false;

  // DA_P3B4_TERMINAL_PRESENCE_MOTION_ENGINE_RUNTIME_V2_V1D
  const terminalPresenceMotion =
    useRef(new Animated.Value(1)).current;


  useEffect(() => {
    let cancelled = false;
    let deliveredTruthInterval: ReturnType<typeof setInterval> | null =
      null;

    async function refreshDeliveredTruth() {
      if (!routeOrderId || deliveredTruthInFlightRef.current || AppState.currentState && AppState.currentState !== "active") {
        return;
      }

      deliveredTruthInFlightRef.current = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await daOrdersFetch(
          `${API_BASE_URL}/orders/demo/list`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
            signal: controller.signal,
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
          setOrderSyncPending(false);
          setTrackedOrder(matchingOrder || null);
          setOrderLifecycleStatus(matchingStatus || "pending");
          setOrderDelivered(delivered);
        }

        if (delivered && deliveredTruthInterval) {
          clearInterval(deliveredTruthInterval);
          deliveredTruthInterval = null;
        }
      } catch {
        if (!cancelled) setOrderSyncPending(true);
      } finally {
        clearTimeout(timeout);
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
      if (!routeOrderId || liveLocationInFlightRef.current || AppState.currentState && AppState.currentState !== "active") return;
      liveLocationInFlightRef.current = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/location/get`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ orderId: routeOrderId }),
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as LiveCourierLocationResponse | null;
        if (!cancelled && response.ok) setLiveLocation(payload ? { ...payload, receivedAtMs: Date.now() } : null);
        else if (!cancelled && [401, 403, 404].includes(response.status)) setLiveLocation(null);
      } catch {
        // Preserve the last known point during a transient network gap.
      } finally {
        clearTimeout(timeout);
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

  const routeSummary = liveRoute.route ? `Itinéraire actualisé · ${formatDistance(liveRoute.eta?.distanceMeters || liveRoute.route.distanceMeters)}` : "Itinéraire en attente";
  const trackedRestaurantName = deliveredTruthRestaurant(trackedOrder);
  const story = resolveStoryModel({ orderDelivered, orderLifecycleStatus, restaurantName: trackedRestaurantName,
    hasUsableLiveLocation, etaLabel: liveRoute.eta?.label || null, distanceToClient, hasOrder: Boolean(trackedOrder) });
  const activeStorySteps = storySteps(trackedRestaurantName);
  const compactLayout =
    viewportHeight < 780 ||
    story.stage === "journey" ||
    story.stage === "approach" ||
    story.stage === "handoff";
  const canControlJourney = liveJourneyVisible;
  const cameraFollowLabel =
    visibleProgressValue >= 1
      ? "Centrer la remise"
      : reduceMotionEnabled
        ? "Centrer le coursier"
        : followCourier
          ? "Suivi auto"
          : "Reprendre le suivi";

  const fitJourney = () => {
    const points = routeCoordinates.length >= 2 ? routeCoordinates : [restaurantCoordinate, clientCoordinate, signal.point].filter((point): point is Coordinate => Boolean(point));
    if (!mapReadyRef.current || !points.length) return;

    requestAnimationFrame(() => {
      mapRef.current?.fitToCoordinates?.(points, {
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
    if (!mapReadyRef.current || !clientCoordinate) return;

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
      if (followCourier && liveJourneyVisible) focusCourierNow();
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
      {restaurantCoordinate || clientCoordinate || signal.point ? <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: (signal.point || restaurantCoordinate || clientCoordinate || { latitude: 0, longitude: 0 }).latitude,
          longitude: (signal.point || restaurantCoordinate || clientCoordinate || { latitude: 0, longitude: 0 }).longitude,
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
        {routeCoordinates.length >= 2 ? <LiveRouteEngine
          routeCoordinates={routeCoordinates}
          progressValue={visibleProgressValue}
          baseColor={"#B76A3A"}
          baseWidth={6}
        /> : null}

        {restaurantCoordinate ? <Marker coordinate={restaurantCoordinate} title={trackedRestaurantName} description="Restaurant partenaire">
          <View style={[styles.marker, styles.restaurantMarker]}>
            <Text style={styles.markerEmoji}>🍲</Text>
          </View>
        </Marker> : null}

        {/* DA_P3A7_DESTINATION_APPROACH_ENGINE_RUNTIME_V2_V1 */}
        {clientCoordinate ? <Marker
          coordinate={clientCoordinate}
          title="Destination"
          description="Adresse client"
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <DestinationApproachMarker progressValue={visibleProgressValue} />
        </Marker> : null}

        {/* DA_P3A2_COURIER_MARKER_ROTATION_RUNTIME_V2_V1 */}
        {/* DA_P3A5_LIVING_COURIER_MARKER_RUNTIME_V2_V1 */}
        {liveJourneyVisible ? (
<LivingCourierMarker
          coordinate={visibleCourier}
          heading={visibleHeading}
          running={running && !reduceMotionEnabled}
        />
        ) : null}
      </MapView> : <View style={styles.fallbackContent}><Text style={styles.fallbackText}>Les repères apparaîtront dès que les coordonnées de votre commande seront disponibles.</Text></View>}

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
              {orderSyncPending && trackedOrder ? "Dernière étape connue. La commande attend une actualisation." : story.subtitle}
            </Text>
            <View style={styles.sourceRow}>
              {loadingRoute ? (
                <ActivityIndicator size="small" color="#E7B88E" />
              ) : null}
              <Text style={styles.sourceText} numberOfLines={1}>
                {loadingRoute
                  ? "Nous dessinons votre trajet…"
                  : `${routeSummary} · ${signal.label}`}
              </Text>
            </View>
            {routeError ? (
              <Text style={styles.routeWarning}>
                Calcul du trajet indisponible · l’arrivée reste à préciser
              </Text>
            ) : null}
            <View style={styles.liveTruthRow}>
              <View style={[styles.liveTruthDot, hasUsableLiveLocation && styles.liveTruthDotActive]} />
              <Text style={styles.liveTruthText} numberOfLines={1}>
                {hasUsableLiveLocation
                  ? `${liveLocation?.location?.courierName || "Coursier"} · ${signal.label}`
                  : signal.label}
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
                        ? "Réduire les animations de la carte, le suivi continue"
                        : "Réactiver les animations de la carte"
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
                        ? "Calmer la carte"
                        : "Animer la carte"
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

export default function MissionMapEntry() {
  const params = useLocalSearchParams<{ orderId?: string | string[]; publicId?: string | string[] }>();
  const identity = params.publicId || params.orderId || "";
  return <MapsLiveLabScreen key={String(identity)} />;
}
