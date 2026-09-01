import { daOrdersFetch } from "../utils/daOrdersApi";
// DA_A5A3A7S16R8_COURIER_MISSION_DETAIL_REPAIR_V1
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { CourierAquaticSignature } from "../components/aquatic/CourierAquaticSignature";
import { WaterRouteCurrent } from "../ui/water/WaterRouteCurrent";
// DA_SPRINT19_ADAPTIVE_HOME_ORCHESTRATION_V1
import {
  loadCourierPresence,
  readCourierPresenceCache,
  saveCourierPresence,
  syncCourierPresence,
} from "../utils/daPresenceStore";
import {
  clearCourierOperationFocus,
  readCourierOperationFocus,
  writeCourierOperationFocus,
} from "../utils/daOperationFocusMemory";

type Order = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: string;
  customerName?: string;
  clientName?: string;
  customer?: { name?: string; address?: string; city?: string };
  restaurantName?: string;
  restaurant?: string;
  merchantName?: string;
  deliveryAddress?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; qty?: number }>;
  assignmentProposal?: { status?: string; courierId?: string; courierName?: string };
};

type PresenceProof = {
  token?: string;
  verifiedAt?: string;
  expiresAt?: string;
  destination?: string;
};

type CourierPresenceProfile = {
  riderName?: string;
  phone?: string;
  email?: string;
  activeZone?: string;
  available?: boolean;
  territory?: { city?: string; countryCode?: string };
  territoryEvidence?: { latitude?: number; longitude?: number; detectedAt?: string; source?: string };
  proofs?: { phone?: PresenceProof; email?: PresenceProof };
  trust?: { status?: string };
  updatedAt?: string;
};

const cleanPresence = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

function proofIsCurrent(proof: PresenceProof | undefined, destination: string) {
  if (!proof?.token || !proof?.expiresAt || cleanPresence(proof.destination) !== destination) return false;
  const expiresAt = new Date(proof.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function courierActivationReady(profile: CourierPresenceProfile | null) {
  if (!profile) return false;
  const phone = cleanPresence(profile.phone);
  const email = cleanPresence(profile.email).toLowerCase();
  const territoryReady = Boolean(
    cleanPresence(profile.activeZone) &&
      cleanPresence(profile.territory?.city) &&
      cleanPresence(profile.territory?.countryCode) &&
      Number.isFinite(Number(profile.territoryEvidence?.latitude)) &&
      Number.isFinite(Number(profile.territoryEvidence?.longitude)),
  );
  return (
    territoryReady &&
    proofIsCurrent(profile.proofs?.phone, phone) &&
    proofIsCurrent(profile.proofs?.email, email) &&
    profile.trust?.status === "screened"
  );
}

type ActivationProof = {
  key: "identity" | "territory" | "phone" | "email";
  label: string;
  ready: boolean;
};

function courierActivationProofs(profile: CourierPresenceProfile | null): ActivationProof[] {
  const phone = cleanPresence(profile?.phone);
  const email = cleanPresence(profile?.email).toLowerCase();
  const territoryReady = Boolean(
    cleanPresence(profile?.activeZone) &&
      cleanPresence(profile?.territory?.city) &&
      cleanPresence(profile?.territory?.countryCode) &&
      Number.isFinite(Number(profile?.territoryEvidence?.latitude)) &&
      Number.isFinite(Number(profile?.territoryEvidence?.longitude)),
  );

  return [
    { key: "identity", label: "Identité", ready: profile?.trust?.status === "screened" },
    { key: "territory", label: "Territoire", ready: territoryReady },
    { key: "phone", label: "Téléphone", ready: proofIsCurrent(profile?.proofs?.phone, phone) },
    { key: "email", label: "Email", ready: proofIsCurrent(profile?.proofs?.email, email) },
  ];
}

type TerrainMoment = {
  mode: "PRÊT" | "ROUTE" | "VEILLE" | "SYNCHRO";
  kicker: string;
  title: string;
  body: string;
  action: string;
  stage: number;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

const NETWORK_TIMEOUT_MS = 8000;
type NetworkTruth = "syncing" | "live" | "stale";

async function fetchNetworkJson(url: string, init?: Parameters<typeof fetch>[1]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const request = url.includes("/orders/demo/") ? daOrdersFetch : fetch;
    const response = await request(url, { ...(init || {}), signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le réseau met trop de temps à répondre.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function networkTruthMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : "Synchronisation indisponible";
  if (/temps|timeout|network|fetch|connexion|http/i.test(detail)) {
    return "Connexion momentanément indisponible. La mission et les dernières données restent disponibles.";
  }
  return "Une partie du réseau ne répond pas encore. La mission et les dernières données restent disponibles.";
}

function go(path: string) {
  router.push(path as any);
}

function orderId(order?: Order | null) {
  return String(order?.publicId || order?.orderId || order?.id || "DA-MISSION");
}

function statusOf(order?: Order | null) {
  return String(order?.status || "ready").toLowerCase();
}

function assignmentStatus(order?: Order | null) {
  return String(order?.assignmentProposal?.status || "").toLowerCase();
}

function assignmentAccepted(order?: Order | null) {
  return assignmentStatus(order) === "accepted" && Boolean(order?.assignmentProposal?.courierId);
}

function restaurantName(order?: Order | null) {
  return String(order?.restaurantName || order?.restaurant || order?.merchantName || "Restaurant partenaire");
}

function customerName(order?: Order | null) {
  return String(order?.customer?.name || order?.customerName || order?.clientName || "Client DelishAfrica");
}

function addressOf(order?: Order | null) {
  return String(order?.deliveryAddress || order?.customer?.address || "Adresse de livraison");
}

function firstItem(order?: Order | null) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const item = items[0] || null;
  if (!item) return "Commande à livrer";
  const first = `${Number(item.quantity || item.qty || 1)}× ${item.name || item.title || "Plat"}`;
  const remaining = Math.max(0, items.length - 1);
  return remaining ? `${first} + ${remaining} autre${remaining > 1 ? "s" : ""}` : first;
}

function extractOrders(payload: any): Order[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchOrders(): Promise<Order[]> {
  const payload = await fetchNetworkJson(`${API_BASE_URL}/orders/demo/list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return extractOrders(payload);
}

function terrainMoment(priority: Order | null, readyCount: number, routeCount: number): TerrainMoment {
  const status = statusOf(priority);

  if (priority && ["picked_up", "on_the_way", "in_transit"].includes(status)) {
    return {
      mode: "ROUTE",
      kicker: "LE CLIENT EST LE PROCHAIN POINT",
      title: `${customerName(priority)} vous attend.`,
      body: `${addressOf(priority)} · ${restaurantName(priority)} est derrière vous`,
      action: "Poursuivre Mission Live",
      stage: 1,
    };
  }

  if (priority && status === "ready") {
    const accepted = assignmentAccepted(priority);
    return {
      mode: "PRÊT",
      kicker: accepted ? "MISSION ACCEPTÉE · RETRAIT AUTORISÉ" : "NOUVELLE OFFRE DELISHAFRICA",
      title: accepted ? `${restaurantName(priority)} vous attend.` : `${restaurantName(priority)} propose une mission.`,
      body: `${orderId(priority)} · ${firstItem(priority)} · ${customerName(priority)}`,
      action: accepted ? "Ouvrir le guidage" : "Répondre à l’offre",
      stage: 0,
    };
  }

  return {
    mode: "VEILLE",
    kicker: "LE TERRAIN RESTE OUVERT",
    title: "Prêt pour la prochaine mission.",
    body: `${readyCount} à prendre · ${routeCount} en route · aucune urgence inventée`,
    action: "Voir les missions",
    stage: 0,
  };
}

// DA_SPRINT16_PRESENCE_CONTINUITY_V1
// DA_SPRINT18_ACTIVATION_PASSPORT_TRUTH_V1
// DELISHAFRICA_SPRINT27_NETWORK_GRACE_TRUTH_V1
// DELISHAFRICA_SPRINT28_FRESHNESS_GATE_TRUTH_V1B_TYPE_RESCUE
// DELISHAFRICA_SPRINT29_PRESENCE_COMMIT_TRUTH_V1
export default function CourierHome() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkTruth, setNetworkTruth] = useState<NetworkTruth>("syncing");
  const [lastSync, setLastSync] = useState("—");
  const [reduceMotion, setReduceMotion] = useState(false);
  // DELISHAFRICA_SPRINT25_OPERATION_CONTEXT_MEMORY_V1
  const initialOperationFocus = readCourierOperationFocus();
  const [showTools, setShowTools] = useState(initialOperationFocus.showTools);
  const [showActivationPreview, setShowActivationPreview] = useState(false);
  const operationScrollRef = useRef<ScrollView | null>(null);
  const operationScrollY = useRef(initialOperationFocus.scrollY);
  const operationToolsOpen = useRef(initialOperationFocus.showTools);
  const initialPresence = readCourierPresenceCache<CourierPresenceProfile>();
  const [presenceProfile, setPresenceProfile] = useState<CourierPresenceProfile | null>(initialPresence);
  const [available, setAvailable] = useState(() => Boolean(initialPresence?.available));
  const [presenceHydrated, setPresenceHydrated] = useState(false);
  const [presenceMutation, setPresenceMutation] = useState<"idle" | "opening" | "closing">("idle");
  const presenceMutationRef = useRef<"idle" | "opening" | "closing">("idle");
  const pulse = useRef(new Animated.Value(0)).current;
  // DELISHAFRICA_SPRINT26_LIVE_RESUME_TRUTH_V1
  const appStateRef = useRef(AppState.currentState);
  const backgroundAtRef = useRef<number | null>(null);
  const loadFlightRef = useRef<Promise<void> | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const syncPresence = useCallback(async () => {
    if (presenceMutationRef.current !== "idle") return;
    const profile = await loadCourierPresence<CourierPresenceProfile>();
    if (profile && !courierActivationReady(profile) && profile.available) {
      const locked = { ...profile, available: false, updatedAt: new Date().toISOString() };
      try { await saveCourierPresence(locked); } catch { /* L'interface reste verrouillée hors ligne. */ }
      setPresenceProfile(locked);
      setAvailable(false);
    } else {
      setPresenceProfile(profile);
      setAvailable(Boolean(profile?.available));
    }
    setPresenceHydrated(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void syncPresence().catch(() => {
        if (active) setPresenceHydrated(true);
      });
      return () => {
        active = false;
      };
    }, [syncPresence]),
  );

  useEffect(() => {
    const timer = setInterval(() => { void syncPresence(); }, 60000);
    return () => clearInterval(timer);
  }, [syncPresence]);

  const rememberOperationScroll = useCallback(
    (event: any) => {
      const nextY = Math.max(0, Number(event?.nativeEvent?.contentOffset?.y) || 0);
      operationScrollY.current = nextY;
      writeCourierOperationFocus({ scrollY: nextY, showTools: operationToolsOpen.current });
    },
    [],
  );

  const toggleOperationTools = useCallback(() => {
    setShowTools((current) => {
      const next = !current;
      operationToolsOpen.current = next;
      writeCourierOperationFocus({ scrollY: operationScrollY.current, showTools: next });
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const focus = readCourierOperationFocus();
      setShowTools(focus.showTools);
      operationToolsOpen.current = focus.showTools;
      operationScrollY.current = focus.scrollY;
      const frame = requestAnimationFrame(() => {
        operationScrollRef.current?.scrollTo({ y: focus.scrollY, animated: false });
      });
      return () => {
        cancelAnimationFrame(frame);
        writeCourierOperationFocus({
          scrollY: operationScrollY.current,
          showTools: operationToolsOpen.current,
        });
      };
    }, []),
  );

  const load = useCallback(async () => {
    if (loadFlightRef.current) return loadFlightRef.current;
    const flight = (async () => {
      try {
        if (!hasLoadedRef.current) setNetworkTruth("syncing");
        const profile = await loadCourierPresence<CourierPresenceProfile>();
        if (profile?.available && courierActivationReady(profile)) await syncCourierPresence(profile);
        setOrders(await fetchOrders());
        setNetworkTruth("live");
        setError(null);
        hasLoadedRef.current = true;
        setLastSync(
          new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }),
        );
      } catch (err) {
        hasLoadedRef.current = true;
        setNetworkTruth("stale");
        setError(networkTruthMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    })();
    loadFlightRef.current = flight;
    try {
      await flight;
    } finally {
      if (loadFlightRef.current === flight) loadFlightRef.current = null;
    }
  }, []);

  const refreshLiveTruth = useCallback(async () => {
    await Promise.allSettled([load(), syncPresence()]);
  }, [load, syncPresence]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (appStateRef.current === "active") void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState === "background" || nextState === "inactive") {
        if (previousState === "active") backgroundAtRef.current = Date.now();
        return;
      }
      if (nextState === "active" && previousState !== "active") {
        const backgroundAt = backgroundAtRef.current;
        backgroundAtRef.current = null;
        if (backgroundAt && Date.now() - backgroundAt >= 12000) void refreshLiveTruth();
      }
    });
    return () => subscription.remove();
  }, [refreshLiveTruth]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ready = useMemo(() => orders.filter((order) => statusOf(order) === "ready"), [orders]);
  const picked = useMemo(
    () => orders.filter((order) => ["picked_up", "on_the_way", "in_transit"].includes(statusOf(order))),
    [orders],
  );
  const delivered = useMemo(() => orders.filter((order) => statusOf(order) === "delivered"), [orders]);
  const priority = picked[0] || ready[0] || null;
  const priorityKey = priority ? orderId(priority) : "";
  const priorityStatus = statusOf(priority);
  const restaurants = useMemo(
    () => Array.from(new Set([...ready, ...picked].map(restaurantName))),
    [ready, picked],
  );
  const activationReady = useMemo(() => courierActivationReady(presenceProfile), [presenceProfile]);
  const activationProofs = useMemo(() => courierActivationProofs(presenceProfile), [presenceProfile]);
  const activationProofCount = activationProofs.filter((proof) => proof.ready).length;
  const nextActivationProof = activationProofs.find((proof) => !proof.ready) || null;
  const activationPassportVisible = presenceHydrated && !activationReady && !priority;

  useEffect(() => {
    const focus = readCourierOperationFocus();
    const priorityChanged = Boolean(priorityKey && focus.priorityKey && focus.priorityKey !== priorityKey);
    if (activationPassportVisible || priorityChanged) {
      clearCourierOperationFocus();
      operationScrollY.current = 0;
      operationToolsOpen.current = false;
      setShowTools(false);
      const frame = requestAnimationFrame(() => {
        operationScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
      writeCourierOperationFocus({ priorityKey });
      return () => cancelAnimationFrame(frame);
    }
    writeCourierOperationFocus({ priorityKey });
    return undefined;
  }, [activationPassportVisible, priorityKey]);
  const presenceMutationBusy = presenceMutation !== "idle";
  const homeModeLabel = !presenceHydrated
    ? "Reprise sécurisée"
    : presenceMutationBusy
      ? "Confirmation du terrain"
      : activationPassportVisible
        ? "Activation terrain"
      : priority
        ? "Mission prioritaire"
        : networkTruth === "syncing"
          ? "Synchronisation"
          : available
            ? "Terrain en ligne"
            : "Terrain essentiel";
  const presenceNetworkLocked = networkTruth !== "live";
  const presenceLabel = !presenceHydrated
    ? "SYNCHRO"
    : !activationReady
      ? "À VALIDER"
      : presenceMutation === "opening"
        ? "ENTRÉE"
        : presenceMutation === "closing"
          ? "SORTIE"
          : networkTruth === "syncing"
            ? "SYNCHRO"
            : presenceNetworkLocked
          ? "HORS RÉSEAU"
          : available
          ? "EN LIGNE"
          : "HORS LIGNE";
  const baseMoment = useMemo(
    () => terrainMoment(priority, ready.length, picked.length),
    [priority, ready.length, picked.length],
  );
  const moment = useMemo<TerrainMoment>(() => {
    if (!presenceHydrated) {
      return {
        mode: "VEILLE",
        kicker: "REPRISE SÉCURISÉE DU TERRAIN",
        title: "Votre présence est relue avant toute nouvelle mission.",
        body: "Le dernier état confirmé revient sans réinitialisation ni disponibilité fantôme.",
        action: "Synchronisation",
        stage: 0,
      };
    }
    if (priority) return baseMoment;
    if (!activationReady) {
      return {
        mode: "VEILLE",
        kicker: "IDENTITÉ, TERRITOIRE ET CONTACTS DOIVENT ÊTRE PROUVÉS",
        title: "Validez le terrain avant de recevoir une mission.",
        body: `${activationProofCount}/${activationProofs.length} preuves prêtes. Le terrain reste verrouillé jusqu’à la validation complète.`,
        action: "Valider mon terrain",
        stage: 0,
      };
    }
    if (presenceMutationBusy) {
      return {
        mode: "SYNCHRO",
        kicker: "LA PRÉSENCE TERRAIN EST EN COURS DE CONFIRMATION",
        title: presenceMutation === "opening" ? "Entrée sur le terrain…" : "Sortie du terrain…",
        body: "Un seul geste est accepté. L’interface attend la relecture du dernier état réellement enregistré.",
        action: "Confirmation",
        stage: 0,
      };
    }
    if (networkTruth === "syncing") {
      return {
        mode: "SYNCHRO",
        kicker: "LA VÉRITÉ DU TERRAIN EST EN COURS DE LECTURE",
        title: "Un instant, votre terrain se réconcilie.",
        body: "Aucune disponibilité ne change avant la confirmation du réseau.",
        action: "Synchronisation",
        stage: 0,
      };
    }
    if (!available) {
      return {
        mode: "VEILLE",
        kicker: "LE TERRAIN ATTEND VOTRE SIGNAL",
        title: "Passez en ligne lorsque vous êtes réellement prêt.",
        body: "Un geste suffit. Une mission déjà récupérée ne peut jamais être abandonnée.",
        action: "Passer en ligne",
        stage: 0,
      };
    }
    return baseMoment;
  }, [activationProofCount, activationProofs.length, activationReady, available, baseMoment, networkTruth, presenceHydrated, presenceMutation, presenceMutationBusy, priority]);

  async function togglePresence() {
    if (!presenceHydrated || presenceMutationRef.current !== "idle") return;
    if (presenceNetworkLocked) {
      setError("Connexion requise uniquement pour modifier la disponibilité. Les missions restent accessibles.");
      void refreshLiveTruth();
      return;
    }
    const current = await loadCourierPresence<CourierPresenceProfile>();
    if (!courierActivationReady(current)) {
      go("/courier-space");
      return;
    }
    if (Boolean(current?.available) && picked.length > 0) {
      Alert.alert(
        "Mission en cours",
        "Terminez la remise au client avant de quitter le terrain.",
      );
      return;
    }
    const desiredAvailable = !Boolean(current?.available);
    const mutation = desiredAvailable ? "opening" : "closing";
    const next: CourierPresenceProfile = {
      ...current,
      available: desiredAvailable,
      updatedAt: new Date().toISOString(),
    };
    presenceMutationRef.current = mutation;
    setPresenceMutation(mutation);
    try {
      await saveCourierPresence(next);
      const confirmed = await loadCourierPresence<CourierPresenceProfile>();
      if (!confirmed || Boolean(confirmed.available) !== desiredAvailable) {
        throw new Error("presence_commit_mismatch");
      }
      setPresenceProfile(confirmed);
      setAvailable(Boolean(confirmed.available));
    } catch {
      const restored = await loadCourierPresence<CourierPresenceProfile>().catch(() => null);
      if (restored) {
        setPresenceProfile(restored);
        setAvailable(Boolean(restored.available));
      }
      Alert.alert("Statut non confirmé", "Le terrain conserve son dernier état relu. Réessayez dans un instant.");
    } finally {
      presenceMutationRef.current = "idle";
      setPresenceMutation("idle");
    }
  }

  const stageNodes = [
    { label: "Prendre", value: ready.length },
    { label: "Rouler", value: picked.length },
    { label: "Livrer", value: ["picked_up", "on_the_way", "in_transit"].includes(priorityStatus) ? 1 : 0 },
  ];

  async function openPrimary() {
    if (!presenceHydrated || presenceMutationRef.current !== "idle") return;
    if (!priority && !activationReady) {
      go("/courier-space");
      return;
    }
    if (presenceNetworkLocked && !priority) {
      go("/orders");
      void refreshLiveTruth();
      return;
    }
    if (!priority && !available) {
      await togglePresence();
      return;
    }
    if (priority && ["picked_up", "on_the_way", "in_transit"].includes(priorityStatus)) {
      router.push({ pathname: "/courier-real-map" as any, params: { orderId: orderId(priority) } });
      return;
    }
    if (priority && priorityStatus === "ready") {
      if (assignmentAccepted(priority)) {
        router.push({ pathname: "/route-oracle" as any, params: { orderId: orderId(priority) } });
      } else {
        router.push("/orders" as any);
      }
      return;
    }
    go("/orders");
  }

  return (
    <CourierAquaticSignature reduceMotion={reduceMotion}>
      <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        ref={operationScrollRef}
        contentContainerStyle={styles.content}
        onScroll={rememberOperationScroll}
        scrollEventThrottle={160}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#75EFA4"
          />
        }
      >
        <View style={styles.topbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
            <Text style={styles.section}>{homeModeLabel}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.presencePill,
              available && activationReady && !presenceNetworkLocked && !presenceMutationBusy && styles.presencePillLive,
              (!presenceHydrated || !activationReady || presenceNetworkLocked || presenceMutationBusy) && styles.presencePillLocked,
              pressed && !presenceMutationBusy && styles.pressFeedback,
            ]}
            onPress={togglePresence}
            disabled={presenceMutationBusy}
            accessibilityRole="switch"
            accessibilityState={{ checked: available && activationReady && !presenceNetworkLocked && !presenceMutationBusy, disabled: presenceMutationBusy, busy: presenceMutationBusy }}
            accessibilityLabel={!presenceHydrated ? "Synchronisation de la présence terrain" : !activationReady ? "Valider le terrain avant la mise en ligne" : presenceMutationBusy ? "Confirmation de la présence terrain" : presenceNetworkLocked ? "Présence verrouillée jusqu’à la prochaine confirmation réseau" : `Coursier ${presenceLabel.toLowerCase()}`}
            accessibilityHint={!presenceHydrated ? "Le dernier état sécurisé est en cours de lecture" : !activationReady ? "Ouvre l’espace de validation du terrain" : presenceMutationBusy ? "Attendez la confirmation avant une nouvelle action" : presenceNetworkLocked ? "Touchez pour relancer la synchronisation" : "Touchez pour changer votre disponibilité"}
          >
            <Animated.View
              style={[
                styles.presenceDot,
                available && activationReady && !presenceNetworkLocked && !presenceMutationBusy && styles.presenceDotLive,
                {
                  opacity:
                    available && activationReady && !presenceNetworkLocked && !presenceMutationBusy
                      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
                      : 1,
                },
              ]}
            />
            <View>
              <Text style={styles.presenceText}>{presenceLabel}</Text>
              <Text style={styles.presenceHint}>{!presenceHydrated ? "Reprise sécurisée" : !activationReady ? "Compléter le terrain" : presenceMutationBusy ? "Écriture puis relecture" : networkTruth === "syncing" ? "Synchronisation" : presenceNetworkLocked ? `Données conservées · ${lastSync}` : "Touchez pour changer"}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.futureRail}>
          <View style={[styles.futureRailPulse, networkTruth === "live" && styles.futureRailPulseLive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.futureRailKicker}>COURIER TERRAIN LIVE</Text>
            <Text style={styles.futureRailText}>
              {networkTruth === "live"
                ? "Mission, route et remise synchronisées"
                : networkTruth === "stale"
                  ? "Dernières données actives · reconnexion en arrière-plan"
                  : "Synchronisation discrète du terrain"}
            </Text>
          </View>
          <Text style={styles.futureRailMeta}>{networkTruth === "live" ? "LIVE" : networkTruth === "stale" ? "HORS RÉSEAU" : "SYNC"}</Text>
        </View>

        <WaterRouteCurrent
          phase={
            priority
              ? ["picked_up", "on_the_way", "in_transit"].includes(priorityStatus)
                ? "route"
                : priorityStatus === "ready"
                  ? assignmentAccepted(priority)
                    ? "pickup"
                    : "offer"
                  : "offer"
              : delivered.length > 0
                ? "delivery"
                : "idle"
          }
          statusLabel={
            networkTruth === "live"
              ? "LIVE"
              : networkTruth === "stale"
                ? "HORS RÉSEAU"
                : "SYNC"
          }
          headline={
            priority
              ? moment.title
              : activationPassportVisible
                ? "Le terrain attend vos preuves."
                : available
                  ? "Le courant est prêt pour la prochaine mission."
                  : "Le terrain respire."
          }
          body={
            priority
              ? moment.body
              : activationPassportVisible
                ? "Aucune mission ne remonte avant la validation complète du terrain."
                : available
                  ? "Présence confirmée. La prochaine mission prendra place dans le courant sans modifier votre décision."
                  : "Aucun départ automatique. Passez en ligne uniquement lorsque vous êtes réellement prêt."
          }
          orderId={priority ? orderId(priority) : undefined}
          destination={priority ? addressOf(priority) : undefined}
          metrics={[
            { label: "À prendre", value: ready.length },
            { label: "En route", value: picked.length },
            { label: "Livrées", value: delivered.length },
          ]}
          actionLabel={moment.action}
          onOpen={() => {
            void openPrimary();
          }}
        />

        {/* COURIER ACCOUNT DOOR · REAL PKCE */}
        <Pressable
          style={({ pressed }) => [styles.identityDoor, pressed && styles.pressFeedback]}
          onPress={() => go("/auth-session")}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir le compte Courier sécurisé"
          accessibilityHint="Connexion réelle par navigateur système, PKCE et reprise sécurisée de session"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.identityDoorKicker}>IDENTITÉ COURIER</Text>
            <Text style={styles.identityDoorTitle}>Compte & session sécurisée</Text>
            <Text style={styles.identityDoorBody}>Connexion réelle · PKCE · SecureStore · reprise automatique</Text>
          </View>
          <Text style={styles.identityDoorArrow}>→</Text>
        </Pressable>

        {activationPassportVisible ? null : (
          <>
            <Text style={styles.heroTitle}>Mission prioritaire. Route claire.</Text>
            <Text style={styles.heroBody}>
              La prochaine adresse reste dominante. Mission, route et remise gardent le fil, même entre deux synchronisations.
            </Text>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.essentialCard, pressed && styles.pressFeedback]}
          onPress={openPrimary}
          accessibilityRole="button"
          accessibilityLabel={priority ? `${moment.action} · mission ${orderId(priority)}` : moment.action}
          accessibilityHint={priority && ["picked_up", "on_the_way", "in_transit"].includes(priorityStatus) ? "Ouvre la carte Mission Live" : priority && priorityStatus === "ready" ? "Ouvre Route Oracle pour proposer puis confirmer le bon coursier" : priority ? "Ouvre la liste des missions" : activationReady ? "Change la disponibilité du terrain" : "Ouvre la validation du terrain"}
        >
          <View style={styles.cardAura} pointerEvents="none" />

          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardKicker}>{activationPassportVisible ? "ACTIVATION TERRAIN" : priority ? "MISSION EN COURS" : available && activationReady ? "TERRAIN EN LIGNE" : "PRÉSENCE TERRAIN"}</Text>
              <Text style={styles.cardEyebrow}>{moment.kicker}</Text>
            </View>
            <View style={styles.modePill}>
              <Text style={styles.modeText}>{moment.mode}</Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>{moment.title}</Text>
          <Text style={styles.cardBody}>{moment.body}</Text>

          {activationPassportVisible ? (
            <View style={styles.activationPassport}>
              <View style={styles.activationPassportHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activationPassportKicker}>PASSEPORT TERRAIN</Text>
                  <Text style={styles.activationPassportTitle}>
                    {activationProofCount}/{activationProofs.length} preuves confirmées
                  </Text>
                </View>
                <Text style={styles.activationPassportCounter}>{activationProofCount}/{activationProofs.length}</Text>
              </View>
              <View style={styles.activationProofGrid}>
                {activationProofs.map((proof) => (
                  <View
                    key={proof.key}
                    style={[styles.activationProofChip, proof.ready && styles.activationProofChipReady]}
                  >
                    <View style={[styles.activationProofDot, proof.ready && styles.activationProofDotReady]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activationProofLabel, proof.ready && styles.activationProofLabelReady]}>
                        {proof.label}
                      </Text>
                      <Text style={styles.activationProofState}>{proof.ready ? "Confirmé" : "À prouver"}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.stageRail}>
              {stageNodes.map((node, index) => (
                <React.Fragment key={node.label}>
                  <View style={styles.stageNodeWrap}>
                    <Animated.View
                      style={[
                        styles.stageNode,
                        index <= moment.stage && styles.stageNodeActive,
                        index === moment.stage && {
                          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                          transform: [
                            {
                              scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.06] }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Text style={[styles.stageValue, index <= moment.stage && styles.stageValueActive]}>
                        {node.value}
                      </Text>
                    </Animated.View>
                    <Text style={styles.stageLabel}>{node.label}</Text>
                  </View>
                  {index < stageNodes.length - 1 ? (
                    <View style={[styles.stageLine, index < moment.stage && styles.stageLineActive]} />
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          )}

          {networkTruth === "stale" && error && orders.length > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.networkNotice, pressed && styles.pressFeedback]}
              onPress={() => { void load(); }}
              accessibilityRole="button"
              accessibilityLabel="Mode dégradé. Relancer la synchronisation du terrain"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.networkNoticeKicker}>CONNEXION LIMITÉE · DONNÉES CONSERVÉES</Text>
                <Text style={styles.networkNoticeText}>{error}</Text>
                {lastSync !== "—" ? <Text style={styles.networkNoticeMeta}>Dernière synchro {lastSync}</Text> : null}
              </View>
              <Text style={styles.networkNoticeAction}>Relancer</Text>
            </Pressable>
          ) : null}

          {activationPassportVisible ? null : loading ? (
            <View style={styles.inlineState}>
              <ActivityIndicator color="#06351D" />
              <Text style={styles.inlineStateText}>Lecture du terrain…</Text>
            </View>
          ) : error && orders.length === 0 && networkTruth !== "stale" ? (
            <Pressable
              style={({ pressed }) => [styles.inlineError, pressed && styles.pressFeedback]}
              onPress={() => { void load(); }}
              accessibilityRole="button"
              accessibilityLabel="Terrain en mode dégradé. Relancer la synchronisation"
            >
              <Text style={styles.inlineErrorTitle}>Terrain en mode dégradé</Text>
              <Text style={styles.inlineErrorText}>{error}</Text>
              <Text style={styles.inlineErrorRetry}>Relancer la synchronisation</Text>
            </Pressable>
          ) : priority ? (
            <View style={styles.missionSurface}>
              <View style={{ flex: 1 }}>
                <Text style={styles.missionKicker}>
                  {["picked_up", "on_the_way", "in_transit"].includes(priorityStatus)
                    ? "MISSION EN MOUVEMENT"
                    : "MISSION À PRENDRE"}
                </Text>
                <Text style={styles.missionId}>{orderId(priority)}</Text>
                <Text style={styles.missionRestaurant}>{restaurantName(priority)}</Text>
                <Text style={styles.missionClient}>
                  {customerName(priority)} · {firstItem(priority)}
                </Text>
                <Text style={styles.missionAddress} numberOfLines={2}>{addressOf(priority)}</Text>
                <Text style={styles.missionRouteHint}>
                  {["picked_up", "on_the_way", "in_transit"].includes(priorityStatus)
                    ? "Navigation et ETA prêtes"
                    : "Restaurant → client · détails mission"}
                </Text>
              </View>
              <Text style={styles.missionArrow}>→</Text>
            </View>
          ) : (
            <View style={styles.missionSurface}>
              <View style={{ flex: 1 }}>
                <Text style={styles.missionKicker}>{!activationReady ? "ACTIVATION REQUISE" : available ? "TERRAIN DISPONIBLE" : "TERRAIN HORS LIGNE"}</Text>
                <Text style={styles.missionId}>{!activationReady ? "Validez votre terrain pour recevoir des missions." : available ? "La prochaine mission prendra naturellement la place centrale." : "Aucune nouvelle mission ne sera proposée avant votre signal."}</Text>
              </View>
            </View>
          )}

          <View style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{moment.action}</Text>
            <Text style={styles.primaryActionArrow}>→</Text>
          </View>
        </Pressable>

        {priority ? (
          <Pressable
            style={({ pressed }) => [styles.detailShortcut, pressed && styles.pressFeedback]}
            onPress={() => router.push({ pathname: "/mission-detail" as any, params: { orderId: orderId(priority) } })}
            accessibilityRole="button"
            accessibilityLabel={`Vérifier le contenu complet de la mission ${orderId(priority)}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.detailShortcutKicker}>CONTRÔLE COLIS</Text>
              <Text style={styles.detailShortcutTitle}>Voir la commande complète</Text>
              <Text style={styles.detailShortcutMeta}>{firstItem(priority)} · quantités et remise</Text>
            </View>
            <Text style={styles.detailShortcutArrow}>→</Text>
          </Pressable>
        ) : null}

        {activationPassportVisible ? (
          <>
            <View style={styles.activationGuidance}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activationGuidanceKicker}>PROCHAINE ÉTAPE</Text>
                <Text style={styles.activationGuidanceTitle}>
                  {nextActivationProof ? `Prouver : ${nextActivationProof.label}` : "Finaliser le passeport"}
                </Text>
                <Text style={styles.activationGuidanceBody}>
                  Aucune mission ne sera proposée avant la confirmation des quatre preuves.
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.activationGuidanceButton, pressed && styles.pressFeedback]}
                onPress={() => go("/courier-space")}
                accessibilityRole="button"
                accessibilityLabel="Continuer le passeport terrain"
              >
                <Text style={styles.activationGuidanceButtonText}>Continuer</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.previewToggle, pressed && styles.pressFeedback]}
              onPress={() => setShowActivationPreview((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={showActivationPreview ? "Masquer l’aperçu sécurisé de Mission Lens" : "Voir l’aperçu sécurisé de Mission Lens"}
              accessibilityState={{ expanded: showActivationPreview }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.previewToggleKicker}>APERÇU SÉCURISÉ</Text>
                <Text style={styles.previewToggleTitle}>
                  {showActivationPreview ? "Refermer Mission Lens" : "Voir le terrain avant l’activation"}
                </Text>
              </View>
              <Text style={styles.previewToggleIcon}>{showActivationPreview ? "−" : "+"}</Text>
            </Pressable>

            {showActivationPreview ? (
              <View style={styles.safePreview}>
                <View style={styles.safePreviewHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.safePreviewKicker}>SIMULATION · AUCUNE MISSION RÉELLE</Text>
                    <Text style={styles.safePreviewTitle}>Mission Lens</Text>
                    <Text style={styles.safePreviewBody}>
                      Découvrez la lecture terrain sans devenir disponible ni accéder aux missions du réseau.
                    </Text>
                  </View>
                  <View style={styles.safePreviewBadge}>
                    <Text style={styles.safePreviewBadgeText}>LECTURE SEULE</Text>
                  </View>
                </View>

                <View style={styles.safePreviewMission}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.safePreviewMissionKicker}>MISSION PRIORITAIRE</Text>
                    <Text style={styles.safePreviewMissionTitle}>Votre prochaine mission apparaîtra ici.</Text>
                    <Text style={styles.safePreviewMissionBody}>Restaurant → client · route et ETA au même endroit.</Text>
                  </View>
                  <Text style={styles.safePreviewMissionArrow}>→</Text>
                </View>

                <View style={styles.safePreviewMetrics}>
                  {[
                    { label: "À prendre", value: "0" },
                    { label: "En route", value: "0" },
                    { label: "Terminées", value: "0" },
                  ].map((metric) => (
                    <View key={metric.label} style={styles.safePreviewMetric}>
                      <Text style={styles.safePreviewMetricValue}>{metric.value}</Text>
                      <Text style={styles.safePreviewMetricLabel}>{metric.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.safePreviewRoute}>
                  <Text style={styles.safePreviewRouteKicker}>PROCHAINE ADRESSE</Text>
                  <Text style={styles.safePreviewRouteTitle}>Visible dès qu’une mission vous est attribuée.</Text>
                  <Text style={styles.safePreviewRouteBody}>Carte, ETA et action immédiate resteront réunies.</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.safePreviewAction, pressed && styles.pressFeedback]}
                  onPress={() => go("/courier-space")}
                  accessibilityRole="button"
                  accessibilityLabel="Reprendre l’activation du terrain"
                >
                  <Text style={styles.safePreviewActionText}>Reprendre mon activation</Text>
                  <Text style={styles.safePreviewActionArrow}>→</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        {activationReady || priority ? (
          <View style={styles.snapshot}>
            <View style={{ flex: 1 }}>
              <Text style={styles.snapshotKicker}>TERRAIN EN UN REGARD</Text>
              <Text style={styles.snapshotTitle}>
                {ready.length} à prendre · {picked.length} en route
              </Text>
              <Text style={styles.snapshotMeta} numberOfLines={2}>
                {priority ? addressOf(priority) : `${delivered.length} livraison${delivered.length > 1 ? "s" : ""} terminée${delivered.length > 1 ? "s" : ""}`}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.snapshotButton, pressed && styles.pressFeedback]}
              onPress={() => go("/orders")}
              accessibilityRole="button"
              accessibilityLabel="Voir toutes les missions"
              hitSlop={8}
            >
              <Text style={styles.snapshotButtonText}>Tout voir</Text>
            </Pressable>
          </View>
        ) : null}

        {activationReady || priority ? (
          <>
        {/* DA_A5A3A7S16R9A2C_FOREGROUND_POSITION_ROUTE_ETA_V1 */}
        {priority ? (
          <Pressable
            style={({ pressed }) => [
              {
                borderRadius: 26,
                paddingVertical: 18,
                paddingHorizontal: 20,
                marginBottom: 14,
                backgroundColor: "#E9FFF0",
                borderWidth: 1,
                borderColor: "rgba(142,240,179,0.60)",
              },
              pressed && styles.pressFeedback,
            ]}
            onPress={() => router.push("/courier-integrated-map" as any)}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le suivi terrain de la mission"
          >
            <Text style={{ color: "#147040", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 }}>
              MISSION LIVE · CARTE TERRAIN
            </Text>
            <Text style={{ color: "#052013", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 7 }}>
              Suivre la mission en direct
            </Text>
            <Text style={{ color: "rgba(5,32,19,0.72)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 6 }}>
              Position, prochain repère, distance et ETA au premier plan.
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.toolsToggle, pressed && styles.pressFeedback]}
          onPress={toggleOperationTools}
          accessibilityRole="button"
          accessibilityLabel={showTools ? "Refermer les outils du terrain" : "Ouvrir les outils du terrain"}
          accessibilityState={{ expanded: showTools }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.toolsKicker}>OUTILS DU TERRAIN</Text>
            <Text style={styles.toolsTitle}>{showTools ? "Refermer" : "Ouvrir seulement si nécessaire"}</Text>
          </View>
          <Text style={styles.toolsIcon}>{showTools ? "−" : "+"}</Text>
        </Pressable>

        {showTools ? (
          <View style={styles.toolsGrid}>
            <Pressable
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressFeedback]}
              onPress={() => go("/courier-eta")}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir l estimation de la mission"
            >
              <Text style={styles.toolTitle}>ETA mission</Text>
              <Text style={styles.toolText}>Distance et estimation terrain.</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressFeedback]}
              onPress={() => go("/route-oracle")}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir Route Oracle"
            >
              <Text style={styles.toolTitle}>Route Oracle</Text>
              <Text style={styles.toolText}>Score et décision coursier.</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressFeedback]}
              onPress={() => go("/notifications")}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir les alertes utiles"
            >
              <Text style={styles.toolTitle}>Alertes utiles</Text>
              <Text style={styles.toolText}>Missions prêtes et événements terrain.</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressFeedback]}
              onPress={() => go("/courier-space")}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir le profil et la zone"
            >
              <Text style={styles.toolTitle}>Profil & zone</Text>
              <Text style={styles.toolText}>Disponibilité, véhicule et contact.</Text>
            </Pressable>
          </View>
        ) : null}
          </>
        ) : null}
      </ScrollView>
      </SafeAreaView>
    </CourierAquaticSignature>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 76 },
  topbar: { flexDirection: "row", gap: 12, alignItems: "center", marginTop: 8, marginBottom: 22 },
  brand: { color: "#75EFA4", fontSize: 12, fontWeight: "900", letterSpacing: 3.1 },
  section: { color: "#F3FFF7", fontSize: 22, fontWeight: "900", marginTop: 8 },
  presencePill: { minWidth: 116, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: "rgba(117,239,164,0.06)", borderWidth: 1, borderColor: "rgba(117,239,164,0.16)" },
  presencePillLive: { backgroundColor: "rgba(117,239,164,0.11)", borderColor: "rgba(117,239,164,0.30)" },
  presencePillLocked: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" },
  presenceDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "#789A84" },
  presenceDotLive: { backgroundColor: "#75EFA4" },
  presenceText: { color: "#E8FFF0", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  presenceHint: { color: "rgba(227,255,236,0.44)", fontSize: 8, fontWeight: "800", marginTop: 2 },
  heroTitle: { color: "#F4FFF8", fontSize: 42, lineHeight: 47, fontWeight: "900", letterSpacing: -1.4 },
  heroBody: { color: "rgba(227,255,236,0.63)", fontSize: 15, lineHeight: 23, fontWeight: "700", marginTop: 12, marginBottom: 22 },
  essentialCard: { position: "relative", overflow: "hidden", borderRadius: 30, padding: 20, backgroundColor: "#E8FFF0", marginBottom: 14 },
  cardAura: { position: "absolute", width: 250, height: 250, borderRadius: 999, right: -125, top: -145, backgroundColor: "rgba(37,177,96,0.16)" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardKicker: { color: "#207445", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  cardEyebrow: { color: "rgba(3,36,20,0.52)", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 7 },
  modePill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#07331E" },
  modeText: { color: "#BCF8D0", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  cardTitle: { color: "#032414", fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 17 },
  cardBody: { color: "rgba(3,36,20,0.62)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 10 },
  activationPassport: {
    marginTop: 22,
    borderRadius: 22,
    padding: 15,
    backgroundColor: "rgba(3,36,20,0.06)",
    borderWidth: 1,
    borderColor: "rgba(3,36,20,0.08)",
  },
  activationPassportHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  activationPassportKicker: { color: "#207445", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  activationPassportTitle: { color: "#032414", fontSize: 15, fontWeight: "900", marginTop: 5 },
  activationPassportCounter: { color: "#032414", fontSize: 18, fontWeight: "900" },
  activationProofGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 13 },
  activationProofChip: {
    width: "48%",
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 10,
    backgroundColor: "rgba(3,36,20,0.045)",
    borderWidth: 1,
    borderColor: "rgba(3,36,20,0.07)",
  },
  activationProofChipReady: { backgroundColor: "rgba(32,167,93,0.09)", borderColor: "rgba(32,167,93,0.17)" },
  activationProofDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "rgba(3,36,20,0.22)" },
  activationProofDotReady: { backgroundColor: "#20A75D" },
  activationProofLabel: { color: "rgba(3,36,20,0.66)", fontSize: 11, fontWeight: "900" },
  activationProofLabelReady: { color: "#137843" },
  activationProofState: { color: "rgba(3,36,20,0.42)", fontSize: 9, fontWeight: "800", marginTop: 2 },
  stageRail: { flexDirection: "row", alignItems: "flex-start", marginTop: 24 },
  stageNodeWrap: { width: 76, alignItems: "center" },
  stageNode: { width: 44, height: 44, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,36,20,0.08)", borderWidth: 1, borderColor: "rgba(3,36,20,0.10)" },
  stageNodeActive: { backgroundColor: "#20A75D", borderColor: "#20A75D" },
  stageValue: { color: "rgba(3,36,20,0.46)", fontSize: 14, fontWeight: "900" },
  stageValueActive: { color: "#F2FFF7" },
  stageLabel: { color: "rgba(3,36,20,0.54)", fontSize: 10, fontWeight: "900", marginTop: 7 },
  stageLine: { flex: 1, height: 2, marginTop: 21, backgroundColor: "rgba(3,36,20,0.10)" },
  stageLineActive: { backgroundColor: "rgba(32,167,93,0.68)" },
  missionSurface: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 22, borderRadius: 22, padding: 17, backgroundColor: "rgba(3,36,20,0.065)", borderWidth: 1, borderColor: "rgba(3,36,20,0.08)" },
  missionKicker: { color: "#207445", fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  missionId: { color: "#032414", fontSize: 20, lineHeight: 25, fontWeight: "900", marginTop: 6 },
  missionRestaurant: { color: "#0B5B34", fontSize: 13, fontWeight: "900", marginTop: 6 },
  missionClient: { color: "rgba(3,36,20,0.56)", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 4 },
  missionAddress: { color: "#0B5B34", fontSize: 13, lineHeight: 18, fontWeight: "900", marginTop: 9 },
  missionRouteHint: { color: "rgba(3,36,20,0.46)", fontSize: 9, fontWeight: "900", letterSpacing: 1.1, marginTop: 5 },
  missionArrow: { color: "#137843", fontSize: 27, fontWeight: "800" },
  inlineState: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, borderRadius: 20, padding: 16, backgroundColor: "rgba(3,36,20,0.06)" },
  inlineStateText: { color: "rgba(3,36,20,0.62)", fontWeight: "800" },
  inlineError: { marginTop: 22, borderRadius: 20, padding: 16, backgroundColor: "rgba(144,34,24,0.10)" },
  inlineErrorTitle: { color: "#7E2118", fontSize: 15, fontWeight: "900" },
  inlineErrorText: { color: "rgba(92,26,18,0.68)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  inlineErrorRetry: { color: "#7E2118", fontSize: 10, fontWeight: "900", marginTop: 9 },
  networkNotice: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: "rgba(19,120,67,0.07)", borderWidth: 1, borderColor: "rgba(19,120,67,0.13)" },
  networkNoticeKicker: { color: "#137843", fontSize: 8, fontWeight: "900", letterSpacing: 1.35 },
  networkNoticeText: { color: "rgba(3,36,20,0.58)", fontSize: 11, lineHeight: 16, marginTop: 4 },
  networkNoticeMeta: { color: "rgba(3,36,20,0.38)", fontSize: 9, lineHeight: 13, marginTop: 3, fontWeight: "800" },
  networkNoticeAction: { color: "#0B5B34", fontSize: 11, fontWeight: "900" },
  primaryAction: { minHeight: 56, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 15, backgroundColor: "#07331E" },
  primaryActionText: { color: "#E8FFF0", fontSize: 15, fontWeight: "900" },
  primaryActionArrow: { color: "#75EFA4", fontSize: 25, fontWeight: "800" },
  snapshot: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 26, padding: 18, backgroundColor: "#041E12", borderWidth: 1, borderColor: "rgba(117,239,164,0.14)", marginBottom: 14 },
  snapshotKicker: { color: "#75EFA4", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  snapshotTitle: { color: "#F3FFF7", fontSize: 17, fontWeight: "900", marginTop: 7 },
  snapshotMeta: { color: "rgba(227,255,236,0.46)", fontSize: 11, fontWeight: "800", marginTop: 5 },
  snapshotButton: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: "rgba(117,239,164,0.10)" },
  snapshotButtonText: { color: "#A8FBC5", fontSize: 12, fontWeight: "900" },
  toolsToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, borderRadius: 22, padding: 18, backgroundColor: "#062718", borderWidth: 1, borderColor: "rgba(117,239,164,0.13)" },
  toolsKicker: { color: "#75EFA4", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  toolsTitle: { color: "#F3FFF7", fontSize: 16, fontWeight: "900", marginTop: 5 },
  toolsIcon: { color: "#75EFA4", fontSize: 27, fontWeight: "800" },
  toolsGrid: { gap: 10, marginTop: 10 },
  toolCard: { borderRadius: 20, padding: 16, backgroundColor: "#051E14", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  toolTitle: { color: "#F3FFF7", fontSize: 16, fontWeight: "900" },
  toolText: { color: "rgba(227,255,236,0.56)", fontSize: 13, lineHeight: 19, marginTop: 5 },
  activationGuidance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    backgroundColor: "rgba(108,245,169,0.08)",
    borderWidth: 1,
    borderColor: "rgba(108,245,169,0.16)",
  },
  activationGuidanceKicker: { color: "#6CF5A9", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  activationGuidanceTitle: { color: "#F4FFF8", fontSize: 16, fontWeight: "900", marginTop: 5 },
  activationGuidanceBody: { color: "rgba(244,255,248,0.56)", fontSize: 11, lineHeight: 16, marginTop: 4 },
  activationGuidanceButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#6CF5A9",
  },
  activationGuidanceButtonText: { color: "#032414", fontSize: 10, fontWeight: "900" },
  previewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    padding: 17,
    marginBottom: 10,
    backgroundColor: "#062A19",
    borderWidth: 1,
    borderColor: "rgba(108,245,169,0.14)",
  },
  previewToggleKicker: { color: "#6CF5A9", fontSize: 8, fontWeight: "900", letterSpacing: 1.9 },
  previewToggleTitle: { color: "#F4FFF8", fontSize: 15, fontWeight: "900", marginTop: 5 },
  previewToggleIcon: { color: "#6CF5A9", fontSize: 25, fontWeight: "800" },
  safePreview: {
    borderRadius: 28,
    padding: 18,
    marginBottom: 12,
    backgroundColor: "#E3F4E9",
    borderWidth: 1,
    borderColor: "rgba(108,245,169,0.24)",
  },
  safePreviewHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  safePreviewKicker: { color: "#1C7548", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  safePreviewTitle: { color: "#032414", fontSize: 24, lineHeight: 28, fontWeight: "900", marginTop: 7 },
  safePreviewBody: { color: "rgba(3,36,20,0.58)", fontSize: 12, lineHeight: 18, marginTop: 6 },
  safePreviewBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#06351D" },
  safePreviewBadgeText: { color: "#B9FFD6", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  safePreviewMission: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    borderRadius: 21,
    padding: 15,
    backgroundColor: "rgba(3,36,20,0.075)",
  },
  safePreviewMissionKicker: { color: "#1C7548", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  safePreviewMissionTitle: { color: "#032414", fontSize: 16, lineHeight: 21, fontWeight: "900", marginTop: 6 },
  safePreviewMissionBody: { color: "rgba(3,36,20,0.54)", fontSize: 11, lineHeight: 17, marginTop: 5 },
  safePreviewMissionArrow: { color: "#1C7548", fontSize: 22, fontWeight: "900" },
  safePreviewMetrics: { flexDirection: "row", gap: 8, marginTop: 12 },
  safePreviewMetric: {
    flex: 1,
    minHeight: 76,
    justifyContent: "center",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(3,36,20,0.055)",
  },
  safePreviewMetricValue: { color: "#032414", fontSize: 24, fontWeight: "900" },
  safePreviewMetricLabel: { color: "rgba(3,36,20,0.50)", fontSize: 9, fontWeight: "900", marginTop: 4 },
  safePreviewRoute: {
    marginTop: 12,
    borderRadius: 20,
    padding: 15,
    backgroundColor: "rgba(3,36,20,0.07)",
  },
  safePreviewRouteKicker: { color: "#1C7548", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  safePreviewRouteTitle: { color: "#032414", fontSize: 15, fontWeight: "900", marginTop: 6 },
  safePreviewRouteBody: { color: "rgba(3,36,20,0.54)", fontSize: 11, lineHeight: 17, marginTop: 5 },
  safePreviewAction: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    borderRadius: 17,
    paddingHorizontal: 15,
    backgroundColor: "#06351D",
  },
  safePreviewActionText: { color: "#F4FFF8", fontSize: 12, fontWeight: "900" },
  safePreviewActionArrow: { color: "#6CF5A9", fontSize: 19, fontWeight: "900" },
  detailShortcut: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, padding: 18, marginBottom: 14, backgroundColor: "#08291A", borderWidth: 1, borderColor: "rgba(117,239,164,0.22)" },
  detailShortcutKicker: { color: "#75EFA4", fontSize: 10, fontWeight: "900", letterSpacing: 2.1 },
  detailShortcutTitle: { color: "#F3FFF7", fontSize: 18, lineHeight: 23, fontWeight: "900", marginTop: 5 },
  detailShortcutMeta: { color: "rgba(227,255,236,0.58)", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 5 },
  detailShortcutArrow: { color: "#75EFA4", fontSize: 28, fontWeight: "900" },
  futureRail: {
    minHeight: 62,
    marginBottom: 18,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(3,36,20,0.72)",
    borderWidth: 1,
    borderColor: "rgba(117,239,164,0.24)",
  },
  futureRailPulse: { width: 10, height: 10, borderRadius: 99, backgroundColor: "#D9AE68" },
  futureRailPulseLive: { backgroundColor: "#75EFA4" },
  futureRailKicker: { color: "#75EFA4", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  futureRailText: { color: "rgba(227,255,236,0.72)", fontSize: 10.5, lineHeight: 15, fontWeight: "700", marginTop: 3 },
  futureRailMeta: { color: "#BFF7D4", fontSize: 9, fontWeight: "900", letterSpacing: 0.9, maxWidth: 78, textAlign: "right" },
  identityDoor: {
    minHeight: 88,
    marginBottom: 18,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(117,239,164,0.10)",
    borderWidth: 1,
    borderColor: "rgba(117,239,164,0.30)",
  },
  identityDoorKicker: { color: "#75EFA4", fontSize: 9, fontWeight: "900", letterSpacing: 2.0 },
  identityDoorTitle: { color: "#F3FFF7", fontSize: 19, lineHeight: 24, fontWeight: "900", marginTop: 6 },
  identityDoorBody: { color: "rgba(227,255,236,0.60)", fontSize: 11, lineHeight: 17, fontWeight: "700", marginTop: 5 },
  identityDoorArrow: { color: "#75EFA4", fontSize: 30, fontWeight: "900" },
  pressFeedback: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
