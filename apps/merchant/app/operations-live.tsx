import { daOrdersFetch } from "../utils/daOrdersApi";
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
import { MerchantAquaticSignature } from "../components/aquatic/MerchantAquaticSignature";
import { WaterKitchenTide } from "../ui/water/WaterKitchenTide";
// DA_SPRINT19_ADAPTIVE_HOME_ORCHESTRATION_V1
import {
  loadPartnerPresence,
  readPartnerPresenceCache,
  savePartnerPresence,
} from "../utils/daPresenceStore";
import {
  clearMerchantOperationFocus,
  readMerchantOperationFocus,
  writeMerchantOperationFocus,
} from "../utils/daOperationFocusMemory";

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
    return "Connexion momentanément indisponible. Le dernier état opérationnel reste disponible.";
  }
  return "Une partie du réseau ne répond pas encore. Le dernier état opérationnel reste disponible.";
}

type Order = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: string;
  restaurant?: string;
  restaurantName?: string;
  merchantName?: string;
  total?: number;
  amount?: number;
  createdAt?: string;
  updatedAt?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; qty?: number }>;
};

type PresenceProof = {
  token?: string;
  verifiedAt?: string;
  expiresAt?: string;
  destination?: string;
};

type PartnerPresenceProfile = {
  restaurantName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  serviceOpen?: boolean;
  addressTruth?: { deliverable?: boolean; formattedAddress?: string };
  territory?: { city?: string; countryCode?: string };
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

function partnerActivationReady(profile: PartnerPresenceProfile | null) {
  if (!profile) return false;
  const phone = cleanPresence(profile.phone);
  const email = cleanPresence(profile.email).toLowerCase();
  const address = cleanPresence(profile.address);
  const addressReady = Boolean(
    profile.addressTruth?.deliverable &&
      cleanPresence(profile.addressTruth.formattedAddress) === address &&
      cleanPresence(profile.territory?.city) &&
      cleanPresence(profile.territory?.countryCode),
  );
  return (
    addressReady &&
    proofIsCurrent(profile.proofs?.phone, phone) &&
    proofIsCurrent(profile.proofs?.email, email) &&
    profile.trust?.status === "screened"
  );
}

type ActivationProof = {
  key: "identity" | "place" | "phone" | "email";
  label: string;
  ready: boolean;
};

function partnerActivationProofs(profile: PartnerPresenceProfile | null): ActivationProof[] {
  const phone = cleanPresence(profile?.phone);
  const email = cleanPresence(profile?.email).toLowerCase();
  const address = cleanPresence(profile?.address);
  const placeReady = Boolean(
    profile?.addressTruth?.deliverable &&
      cleanPresence(profile.addressTruth.formattedAddress) === address &&
      cleanPresence(profile.territory?.city) &&
      cleanPresence(profile.territory?.countryCode),
  );

  return [
    { key: "identity", label: "Identité", ready: profile?.trust?.status === "screened" },
    { key: "place", label: "Lieu", ready: placeReady },
    { key: "phone", label: "Téléphone", ready: proofIsCurrent(profile?.proofs?.phone, phone) },
    { key: "email", label: "Email", ready: proofIsCurrent(profile?.proofs?.email, email) },
  ];
}

type ServiceMoment = {
  code: "DÉCIDER" | "PRODUIRE" | "REMETTRE" | "PRÊT" | "SYNCHRO" | "VEILLE";
  kicker: string;
  title: string;
  body: string;
  action: string;
  activeStage: number;
};

function go(path: string) {
  router.push(path as any);
}

function orderId(order?: Order | null) {
  return String(order?.publicId || order?.orderId || order?.id || "Commande");
}

function statusOf(order?: Order | null) {
  return String(order?.status || "pending").toLowerCase();
}

function restaurantName(order?: Order | null) {
  return String(
    order?.restaurantName ||
      order?.restaurant ||
      order?.merchantName ||
      "Établissement partenaire",
  );
}

function money(value: unknown) {
  const raw = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(raw) || raw === 0) return "—";
  const euros = Math.abs(raw) >= 100 ? raw / 100 : raw;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}

function itemSummary(order?: Order | null) {
  const items = Array.isArray(order?.items) ? order?.items : [];
  if (!items.length) return "Commande à préparer";
  return items
    .slice(0, 2)
    .map(
      (item) =>
        `${Number(item.quantity || item.qty || 1)}× ${item.name || item.title || "Plat"}`,
    )
    .join(" · ");
}

function timeLabel(order?: Order | null) {
  const raw = order?.updatedAt || order?.createdAt;
  if (!raw) return "À l’instant";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "À l’instant";
  return date.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
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

function buildMoment(
  priority: Order | null,
  stats: { pending: number; cooking: number; ready: number; route: number },
): ServiceMoment {
  if (stats.pending > 0) {
    return {
      code: "DÉCIDER",
      kicker: "UNE DÉCISION, PUIS LE SERVICE AVANCE",
      title: `${stats.pending} commande${stats.pending > 1 ? "s" : ""} attend${
        stats.pending > 1 ? "ent" : ""
      } votre feu vert.`,
      body: priority
        ? `${orderId(priority)} · ${itemSummary(priority)}`
        : "La prochaine commande attend votre décision.",
      action: "Décider maintenant",
      activeStage: 0,
    };
  }

  if (stats.ready > 0) {
    return {
      code: "REMETTRE",
      kicker: "LA CUISINE A TERMINÉ, LE TERRAIN PREND LE RELAIS",
      title: `${stats.ready} commande${stats.ready > 1 ? "s sont prêtes" : " est prête"}.`,
      body: priority
        ? `${orderId(priority)} · remise sans attente inutile`
        : "La remise devient la seule priorité.",
      action: "Organiser la remise",
      activeStage: 2,
    };
  }

  if (stats.cooking > 0) {
    return {
      code: "PRODUIRE",
      kicker: "UNE CADENCE LISIBLE, SANS BRUIT",
      title: `${stats.cooking} commande${stats.cooking > 1 ? "s avancent" : " avance"} en cuisine.`,
      body: priority
        ? `${orderId(priority)} · ${itemSummary(priority)} · ${timeLabel(priority)}`
        : "La cuisine garde une cadence simple et maîtrisée.",
      action: "Suivre la cuisine",
      activeStage: 1,
    };
  }

  return {
    code: "PRÊT",
    kicker: "LE CALME FAIT AUSSI PARTIE DU SERVICE",
    title: "Prêt pour la prochaine commande.",
    body: "Aucune alerte inventée. Le cockpit reste disponible et laisse la place au prochain geste utile.",
    action: "Préparer le service",
    activeStage: 0,
  };
}

// DA_SPRINT16_PRESENCE_CONTINUITY_V1
// DA_SPRINT18_ACTIVATION_PASSPORT_TRUTH_V1
// DELISHAFRICA_SPRINT27_NETWORK_GRACE_TRUTH_V1
// DELISHAFRICA_SPRINT28_FRESHNESS_GATE_TRUTH_V1B_TYPE_RESCUE
// DELISHAFRICA_SPRINT29_PRESENCE_COMMIT_TRUTH_V1
export default function MerchantHome() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkTruth, setNetworkTruth] = useState<NetworkTruth>("syncing");
  const [lastSync, setLastSync] = useState("—");
  // DELISHAFRICA_SPRINT25_OPERATION_CONTEXT_MEMORY_V1
  const initialOperationFocus = readMerchantOperationFocus();
  const [showTools, setShowTools] = useState(initialOperationFocus.showTools);
  const [showActivationPreview, setShowActivationPreview] = useState(false);
  const operationScrollRef = useRef<ScrollView | null>(null);
  const operationScrollY = useRef(initialOperationFocus.scrollY);
  const operationToolsOpen = useRef(initialOperationFocus.showTools);
  const initialPresence = readPartnerPresenceCache<PartnerPresenceProfile>();
  const [presenceProfile, setPresenceProfile] = useState<PartnerPresenceProfile | null>(initialPresence);
  const [serviceOpen, setServiceOpen] = useState(() => Boolean(initialPresence?.serviceOpen));
  const [presenceHydrated, setPresenceHydrated] = useState(false);
  const [presenceMutation, setPresenceMutation] = useState<"idle" | "opening" | "closing">("idle");
  const presenceMutationRef = useRef<"idle" | "opening" | "closing">("idle");
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  // DELISHAFRICA_SPRINT26_LIVE_RESUME_TRUTH_V1
  const appStateRef = useRef(AppState.currentState);
  const backgroundAtRef = useRef<number | null>(null);
  const loadFlightRef = useRef<Promise<void> | null>(null);
  const hasLoadedRef = useRef(false);

  const syncPresence = useCallback(async () => {
    if (presenceMutationRef.current !== "idle") return;
    const profile = await loadPartnerPresence<PartnerPresenceProfile>();
    if (profile && !partnerActivationReady(profile) && profile.serviceOpen) {
      const locked = { ...profile, serviceOpen: false, updatedAt: new Date().toISOString() };
      try { await savePartnerPresence(locked); } catch { /* L'interface reste verrouillée hors ligne. */ }
      setPresenceProfile(locked);
      setServiceOpen(false);
    } else {
      setPresenceProfile(profile);
      setServiceOpen(Boolean(profile?.serviceOpen));
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
      writeMerchantOperationFocus({ scrollY: nextY, showTools: operationToolsOpen.current });
    },
    [],
  );

  const toggleOperationTools = useCallback(() => {
    setShowTools((current) => {
      const next = !current;
      operationToolsOpen.current = next;
      writeMerchantOperationFocus({ scrollY: operationScrollY.current, showTools: next });
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const focus = readMerchantOperationFocus();
      setShowTools(focus.showTools);
      operationToolsOpen.current = focus.showTools;
      operationScrollY.current = focus.scrollY;
      const frame = requestAnimationFrame(() => {
        operationScrollRef.current?.scrollTo({ y: focus.scrollY, animated: false });
      });
      return () => {
        cancelAnimationFrame(frame);
        writeMerchantOperationFocus({
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
        const next = await fetchOrders();
        setOrders(next);
        setNetworkTruth("live");
        setError(null);
        hasLoadedRef.current = true;
        setLastSync(
          new Date().toLocaleTimeString("fr-BE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
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
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduceMotion(value);
      })
      .catch(() => {
        if (active) setReduceMotion(false);
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["pending", "accepted", "preparing", "confirmed", "ready", "picked_up"].includes(
          statusOf(order),
        ),
      ),
    [orders],
  );

  const orderedActive = useMemo(() => {
    const score: Record<string, number> = {
      pending: 0,
      accepted: 1,
      preparing: 1,
      confirmed: 1,
      ready: 2,
      picked_up: 3,
    };
    return [...activeOrders].sort(
      (a, b) => (score[statusOf(a)] ?? 9) - (score[statusOf(b)] ?? 9),
    );
  }, [activeOrders]);

  const priority = orderedActive[0] || null;
  const priorityKey = priority ? orderId(priority) : "";
  const nextOrder = orderedActive[1] || null;

  const stats = useMemo(
    () => ({
      pending: orders.filter((order) => statusOf(order) === "pending").length,
      cooking: orders.filter((order) =>
        ["accepted", "preparing", "confirmed"].includes(statusOf(order)),
      ).length,
      ready: orders.filter((order) => statusOf(order) === "ready").length,
      route: orders.filter((order) => statusOf(order) === "picked_up").length,
    }),
    [orders],
  );

  const restaurants = useMemo(
    () => Array.from(new Set(activeOrders.map(restaurantName).filter(Boolean))),
    [activeOrders],
  );

  const activationReady = useMemo(() => partnerActivationReady(presenceProfile), [presenceProfile]);
  const activationProofs = useMemo(() => partnerActivationProofs(presenceProfile), [presenceProfile]);
  const activationProofCount = activationProofs.filter((proof) => proof.ready).length;
  const nextActivationProof = activationProofs.find((proof) => !proof.ready) || null;
  const activationPassportVisible = presenceHydrated && !activationReady && !priority;

  useEffect(() => {
    const focus = readMerchantOperationFocus();
    const priorityChanged = Boolean(priorityKey && focus.priorityKey && focus.priorityKey !== priorityKey);
    if (activationPassportVisible || priorityChanged) {
      clearMerchantOperationFocus();
      operationScrollY.current = 0;
      operationToolsOpen.current = false;
      setShowTools(false);
      const frame = requestAnimationFrame(() => {
        operationScrollRef.current?.scrollTo({ y: 0, animated: false });
      });
      writeMerchantOperationFocus({ priorityKey });
      return () => cancelAnimationFrame(frame);
    }
    writeMerchantOperationFocus({ priorityKey });
    return undefined;
  }, [activationPassportVisible, priorityKey]);
  const presenceMutationBusy = presenceMutation !== "idle";
  const homeModeLabel = !presenceHydrated
    ? "Reprise sécurisée"
    : presenceMutationBusy
      ? "Confirmation du service"
      : activationPassportVisible
        ? "Ouverture guidée"
      : priority
        ? "Priorité service"
        : networkTruth === "syncing"
          ? "Synchronisation"
          : serviceOpen
            ? "Service en cours"
            : "Service essentiel";
  const presenceNetworkLocked = networkTruth !== "live";
  const presenceLabel = !presenceHydrated
    ? "SYNCHRO"
    : !activationReady
      ? "À VALIDER"
      : presenceMutation === "opening"
        ? "OUVERTURE"
        : presenceMutation === "closing"
          ? "FERMETURE"
          : networkTruth === "syncing"
            ? "SYNCHRO"
            : presenceNetworkLocked
          ? "HORS RÉSEAU"
          : serviceOpen
          ? "EN LIGNE"
          : "HORS LIGNE";
  const baseMoment = useMemo(() => buildMoment(priority, stats), [priority, stats]);
  const moment = useMemo<ServiceMoment>(() => {
    if (!presenceHydrated) {
      return {
        code: "PRÊT",
        kicker: "REPRISE SÉCURISÉE DU SERVICE",
        title: "Votre présence est relue avant toute nouvelle commande.",
        body: "Le dernier état confirmé revient sans réinitialisation ni disponibilité fantôme.",
        action: "Synchronisation",
        activeStage: 0,
      };
    }
    if (priority) return baseMoment;
    if (!activationReady) {
      return {
        code: "PRÊT",
        kicker: "IDENTITÉ, ADRESSE ET CONTACTS DOIVENT ÊTRE PROUVÉS",
        title: "Validez l’établissement avant d’ouvrir le service.",
        body: `${activationProofCount}/${activationProofs.length} preuves prêtes. La mise en ligne reste verrouillée jusqu’à la validation complète.`,
        action: "Valider l’établissement",
        activeStage: 0,
      };
    }
    if (presenceMutationBusy) {
      return {
        code: "SYNCHRO",
        kicker: "LA PRÉSENCE EST EN COURS DE CONFIRMATION",
        title: presenceMutation === "opening" ? "Ouverture du service…" : "Fermeture du service…",
        body: "Un seul geste est accepté. L’interface attend la relecture du dernier état réellement enregistré.",
        action: "Confirmation",
        activeStage: 0,
      };
    }
    if (networkTruth === "syncing") {
      return {
        code: "SYNCHRO",
        kicker: "LA VÉRITÉ DU SERVICE EST EN COURS DE LECTURE",
        title: "Un instant, votre service se réconcilie.",
        body: "Aucune présence ne change avant la confirmation du réseau.",
        action: "Synchronisation",
        activeStage: 0,
      };
    }
    if (!serviceOpen) {
      return {
        code: "PRÊT",
        kicker: "LE SERVICE ATTEND VOTRE SIGNAL",
        title: "Ouvrez lorsque la cuisine est réellement prête.",
        body: "Un geste suffit. Les commandes en cours restent toujours accessibles.",
        action: "Ouvrir le service",
        activeStage: 0,
      };
    }
    return baseMoment;
  }, [activationProofCount, activationProofs.length, activationReady, baseMoment, networkTruth, presenceHydrated, presenceMutation, presenceMutationBusy, priority, serviceOpen]);

  async function togglePresence() {
    if (!presenceHydrated || presenceMutationRef.current !== "idle") return;
    if (presenceNetworkLocked) {
      setError("Connexion requise uniquement pour modifier la présence. Le cockpit reste disponible.");
      void refreshLiveTruth();
      return;
    }
    const current = await loadPartnerPresence<PartnerPresenceProfile>();
    if (!partnerActivationReady(current)) {
      go("/partner-space");
      return;
    }
    const desiredOpen = !Boolean(current?.serviceOpen);
    const mutation = desiredOpen ? "opening" : "closing";
    const next: PartnerPresenceProfile = {
      ...current,
      serviceOpen: desiredOpen,
      updatedAt: new Date().toISOString(),
    };
    presenceMutationRef.current = mutation;
    setPresenceMutation(mutation);
    try {
      await savePartnerPresence(next);
      const confirmed = await loadPartnerPresence<PartnerPresenceProfile>();
      if (!confirmed || Boolean(confirmed.serviceOpen) !== desiredOpen) {
        throw new Error("presence_commit_mismatch");
      }
      setPresenceProfile(confirmed);
      setServiceOpen(Boolean(confirmed.serviceOpen));
    } catch {
      const restored = await loadPartnerPresence<PartnerPresenceProfile>().catch(() => null);
      if (restored) {
        setPresenceProfile(restored);
        setServiceOpen(Boolean(restored.serviceOpen));
      }
      Alert.alert("Statut non confirmé", "Le service conserve son dernier état relu. Réessayez dans un instant.");
    } finally {
      presenceMutationRef.current = "idle";
      setPresenceMutation("idle");
    }
  }

  async function openPrimary() {
    if (!presenceHydrated || presenceMutationRef.current !== "idle") return;
    if (!priority && !activationReady) {
      go("/partner-space");
      return;
    }
    if (presenceNetworkLocked && !priority) {
      go("/orders");
      void refreshLiveTruth();
      return;
    }
    if (!priority && !serviceOpen) {
      await togglePresence();
      return;
    }
    go("/orders");
  }

  const stages = [
    { label: "À accepter", value: stats.pending },
    { label: "En cuisine", value: stats.cooking },
    { label: "À remettre", value: stats.ready + stats.route },
  ];

  return (
    <MerchantAquaticSignature reduceMotion={reduceMotion}>
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
            tintColor="#F4B56B"
          />
        }
      >
        <View style={styles.topbar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>DELISHAFRICA® · MERCHANT</Text>
            <Text style={styles.pageTitle}>{homeModeLabel}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.presencePill,
              serviceOpen && activationReady && !presenceNetworkLocked && !presenceMutationBusy && styles.presencePillLive,
              (!presenceHydrated || !activationReady || presenceNetworkLocked || presenceMutationBusy) && styles.presencePillLocked,
              pressed && !presenceMutationBusy && styles.pressFeedback,
            ]}
            onPress={togglePresence}
            disabled={presenceMutationBusy}
            accessibilityRole="switch"
            accessibilityState={{ checked: serviceOpen && activationReady && !presenceNetworkLocked && !presenceMutationBusy, disabled: presenceMutationBusy, busy: presenceMutationBusy }}
            accessibilityLabel={!presenceHydrated ? "Synchronisation de la présence du service" : !activationReady ? "Valider l’établissement avant la mise en ligne" : presenceMutationBusy ? "Confirmation de la présence du service" : presenceNetworkLocked ? "Présence verrouillée jusqu’à la prochaine confirmation réseau" : `Service ${presenceLabel.toLowerCase()}`}
            accessibilityHint={!presenceHydrated ? "Le dernier état sécurisé est en cours de lecture" : !activationReady ? "Ouvre l’espace de validation de l’établissement" : presenceMutationBusy ? "Attendez la confirmation avant une nouvelle action" : presenceNetworkLocked ? "Touchez pour relancer la synchronisation" : "Touchez pour changer la disponibilité du service"}
          >
            <Animated.View
              style={[
                styles.presenceDot,
                serviceOpen && activationReady && !presenceNetworkLocked && !presenceMutationBusy && styles.presenceDotLive,
                {
                  opacity:
                    serviceOpen && activationReady && !presenceNetworkLocked && !presenceMutationBusy
                      ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] })
                      : 1,
                },
              ]}
            />
            <View>
              <Text style={styles.presenceText}>{presenceLabel}</Text>
              <Text style={styles.presenceHint}>{!presenceHydrated ? "Reprise sécurisée" : !activationReady ? "Compléter l’espace" : presenceMutationBusy ? "Écriture puis relecture" : networkTruth === "syncing" ? "Synchronisation" : presenceNetworkLocked ? `Données conservées · ${lastSync}` : `Synchro ${lastSync}`}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.futureRail}>
          <View style={[styles.futureRailPulse, networkTruth === "live" && styles.futureRailPulseLive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.futureRailKicker}>MERCHANT COMMAND CENTER</Text>
            <Text style={styles.futureRailText}>
              {networkTruth === "live"
                ? "Commandes, cuisine et remise synchronisées"
                : networkTruth === "stale"
                  ? "Données locales actives · reconnexion en arrière-plan"
                  : "Synchronisation discrète du service"}
            </Text>
          </View>
          <Text style={styles.futureRailMeta}>{networkTruth === "live" ? "LIVE" : networkTruth === "stale" ? "HORS RÉSEAU" : "SYNC"}</Text>
        </View>

        {activationPassportVisible ? null : (
          <WaterKitchenTide
            pending={stats.pending}
            cooking={stats.cooking}
            ready={stats.ready}
            route={stats.route}
            networkTruth={networkTruth}
            serviceOpen={serviceOpen && activationReady}
            priority={
              priority
                ? {
                    id: orderId(priority),
                    restaurant: restaurantName(priority),
                    summary: itemSummary(priority),
                    updated: timeLabel(priority),
                  }
                : null
            }
            reduceMotion={reduceMotion}
            onOpenQueue={() => go("/orders")}
          />
        )}

        {activationPassportVisible ? null : (
          <>
            <Text style={styles.manifesto}>Le service, en un regard.</Text>
            <Text style={styles.manifestoBody}>
              Commandes, cuisine et remise restent réunies dans un même geste. Le cockpit met l’action utile devant tout le reste.
            </Text>
          </>
        )}

        <Pressable
          style={({ pressed }) => [styles.hero, pressed && styles.pressFeedback]}
          onPress={openPrimary}
          accessibilityRole="button"
          accessibilityLabel={priority ? `Ouvrir la priorité ${orderId(priority)}` : moment.action}
          accessibilityHint={priority ? "Accède à la file opérationnelle du service" : activationReady ? "Change la présence du service" : "Ouvre la validation de l’établissement"}
        >
          <View style={styles.heroHalo} pointerEvents="none" />
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>{activationPassportVisible ? "OUVERTURE GUIDÉE" : serviceOpen && activationReady ? "SERVICE EN COURS" : "PRÉSENCE DU SERVICE"}</Text>
              <Text style={styles.heroEyebrow}>{moment.kicker}</Text>
            </View>
            <View style={styles.modePill}>
              <Text style={styles.modeText}>{moment.code}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{moment.title}</Text>
          <Text style={styles.heroBody}>{moment.body}</Text>

          {activationPassportVisible ? (
            <View style={styles.activationPassport}>
              <View style={styles.activationPassportHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activationPassportKicker}>PASSEPORT D’OUVERTURE</Text>
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
              {stages.map((stage, index) => (
                <View key={stage.label} style={styles.stageColumn}>
                  <View
                    style={[
                      styles.stageLine,
                      index <= moment.activeStage && styles.stageLineActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.stageValue,
                      index <= moment.activeStage && styles.stageValueActive,
                    ]}
                  >
                    {stage.value}
                  </Text>
                  <Text style={styles.stageLabel}>{stage.label}</Text>
                </View>
              ))}
            </View>
          )}

          {networkTruth === "stale" && error && orders.length > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.networkNotice, pressed && styles.pressFeedback]}
              onPress={() => { void load(); }}
              accessibilityRole="button"
              accessibilityLabel="Mode dégradé. Relancer la synchronisation du service"
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
            <View style={styles.stateSurface}>
              <ActivityIndicator color="#2A1308" />
              <Text style={styles.stateText}>Lecture du service…</Text>
            </View>
          ) : error && orders.length === 0 && networkTruth !== "stale" ? (
            <Pressable
              style={({ pressed }) => [styles.errorSurface, pressed && styles.pressFeedback]}
              onPress={() => { void load(); }}
              accessibilityRole="button"
              accessibilityLabel="Cockpit en mode dégradé. Relancer la synchronisation du service"
            >
              <Text style={styles.errorTitle}>Cockpit en mode dégradé</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorRetry}>Relancer la synchronisation</Text>
            </Pressable>
          ) : priority ? (
            <View style={styles.prioritySurface}>
              <View style={{ flex: 1 }}>
                <Text style={styles.priorityKicker}>PRIORITÉ MAINTENANT</Text>
                <Text style={styles.priorityTitle}>{orderId(priority)}</Text>
                <Text style={styles.priorityText}>{itemSummary(priority)}</Text>
                <Text style={styles.priorityRestaurant}>{restaurantName(priority)}</Text>
              </View>
              <View style={styles.priorityMeta}>
                <Text style={styles.priorityAmount}>{money(priority.total ?? priority.amount)}</Text>
                <Text style={styles.priorityTime}>{timeLabel(priority)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.stateSurface}>
              <View style={{ flex: 1 }}>
                <Text style={styles.priorityKicker}>{!activationReady ? "ACTIVATION REQUISE" : serviceOpen ? "SERVICE DISPONIBLE" : "SERVICE HORS LIGNE"}</Text>
                <Text style={styles.priorityTitle}>{!activationReady ? "Validez l’établissement pour ouvrir le service." : serviceOpen ? "La prochaine commande prendra naturellement la place centrale." : "La cuisine reste invisible aux nouvelles commandes jusqu’à votre signal."}</Text>
              </View>
            </View>
          )}

          <View style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{moment.action}</Text>
            <Text style={styles.primaryArrow}>→</Text>
          </View>
        </Pressable>

        {activationPassportVisible ? (
          <>
            <View style={styles.activationGuidance}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activationGuidanceKicker}>PROCHAINE ÉTAPE</Text>
                <Text style={styles.activationGuidanceTitle}>
                  {nextActivationProof ? `Prouver : ${nextActivationProof.label}` : "Finaliser le passeport"}
                </Text>
                <Text style={styles.activationGuidanceBody}>
                  Le service restera fermé jusqu’à la confirmation des quatre preuves.
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.activationGuidanceButton, pressed && styles.pressFeedback]}
                onPress={() => go("/partner-space")}
                accessibilityRole="button"
                accessibilityLabel="Continuer le passeport d'ouverture"
              >
                <Text style={styles.activationGuidanceButtonText}>Continuer</Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.previewToggle, pressed && styles.pressFeedback]}
              onPress={() => setShowActivationPreview((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={showActivationPreview ? "Masquer l’aperçu sécurisé du cockpit" : "Voir l’aperçu sécurisé du cockpit"}
              accessibilityState={{ expanded: showActivationPreview }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.previewToggleKicker}>APERÇU SÉCURISÉ</Text>
                <Text style={styles.previewToggleTitle}>
                  {showActivationPreview ? "Refermer le futur cockpit" : "Voir le cockpit avant l’ouverture"}
                </Text>
              </View>
              <Text style={styles.previewToggleIcon}>{showActivationPreview ? "−" : "+"}</Text>
            </Pressable>

            {showActivationPreview ? (
              <View style={styles.safePreview}>
                <View style={styles.safePreviewHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.safePreviewKicker}>SIMULATION · AUCUNE DONNÉE RÉELLE</Text>
                    <Text style={styles.safePreviewTitle}>Service Command Center</Text>
                    <Text style={styles.safePreviewBody}>
                      Cette vue montre l’ergonomie future sans ouvrir le restaurant ni exposer de commande.
                    </Text>
                  </View>
                  <View style={styles.safePreviewBadge}>
                    <Text style={styles.safePreviewBadgeText}>LECTURE SEULE</Text>
                  </View>
                </View>

                <View style={styles.safePreviewMetrics}>
                  {[
                    { label: "À accepter", value: "0" },
                    { label: "En cuisine", value: "0" },
                    { label: "À remettre", value: "0" },
                  ].map((metric) => (
                    <View key={metric.label} style={styles.safePreviewMetric}>
                      <Text style={styles.safePreviewMetricValue}>{metric.value}</Text>
                      <Text style={styles.safePreviewMetricLabel}>{metric.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.safePreviewPriority}>
                  <Text style={styles.safePreviewPriorityKicker}>PROCHAINE ACTION</Text>
                  <Text style={styles.safePreviewPriorityTitle}>Votre première commande apparaîtra ici.</Text>
                  <Text style={styles.safePreviewPriorityBody}>
                    Accepter, préparer puis remettre : une seule priorité restera visible à la fois.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.safePreviewAction, pressed && styles.pressFeedback]}
                  onPress={() => go("/partner-space")}
                  accessibilityRole="button"
                  accessibilityLabel="Reprendre l’activation de l’établissement"
                >
                  <Text style={styles.safePreviewActionText}>Reprendre mon activation</Text>
                  <Text style={styles.safePreviewActionArrow}>→</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        {activationReady || priority ? (
          <View style={styles.serviceStrip}>
            <View style={styles.serviceStripText}>
              <Text style={styles.serviceStripKicker}>FILE ACTIVE · {serviceOpen ? "SERVICE OUVERT" : "SERVICE FERMÉ"}</Text>
              <Text style={styles.serviceStripTitle}>
                {stats.pending} à accepter · {stats.cooking} en cuisine · {stats.ready} à remettre
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.allOrdersButton, pressed && styles.pressFeedback]}
              onPress={() => go("/orders")}
              accessibilityRole="button"
              accessibilityLabel="Voir toutes les commandes"
              hitSlop={8}
            >
              <Text style={styles.allOrdersText}>Tout voir</Text>
            </Pressable>
          </View>
        ) : null}

        {nextOrder ? (
          <Pressable
            style={({ pressed }) => [styles.nextCard, pressed && styles.pressFeedback]}
            onPress={() => go("/orders")}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir la commande suivante ${orderId(nextOrder)}`}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.nextKicker}>JUSTE APRÈS</Text>
              <Text style={styles.nextTitle}>{orderId(nextOrder)}</Text>
              <Text style={styles.nextBody}>{itemSummary(nextOrder)}</Text>
            </View>
            <Text style={styles.nextStatus}>
              {statusOf(nextOrder) === "pending"
                ? "Décider"
                : statusOf(nextOrder) === "ready"
                  ? "Remettre"
                  : statusOf(nextOrder) === "picked_up"
                    ? "Terrain"
                    : "Cuisine"}
            </Text>
          </Pressable>
        ) : null}

        {activationReady || priority ? (
          <>
        <Pressable
          style={({ pressed }) => [styles.toolsToggle, pressed && styles.pressFeedback]}
          onPress={toggleOperationTools}
          accessibilityRole="button"
          accessibilityLabel={showTools ? "Refermer les outils du service" : "Ouvrir les outils du service"}
          accessibilityState={{ expanded: showTools }}
        >
          <View>
            <Text style={styles.toolsKicker}>OUTILS DU SERVICE</Text>
            <Text style={styles.toolsTitle}>{showTools ? "Refermer les outils" : "Ouvrir seulement si nécessaire"}</Text>
          </View>
          <Text style={styles.toolsIcon}>{showTools ? "−" : "+"}</Text>
        </Pressable>

        {showTools ? (
          <View style={styles.toolsGrid}>
            <Pressable
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressFeedback]}
              onPress={() => go("/partner-space")}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir l'espace établissement"
            >
              <Text style={styles.toolTitle}>Établissement</Text>
              <Text style={styles.toolBody}>Équipe, identité et présence réseau.</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressFeedback]}
              onPress={() => go("/ops-dashboard")}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir le pilotage du service"
            >
              <Text style={styles.toolTitle}>Pilotage</Text>
              <Text style={styles.toolBody}>Volumes, qualité et historique du service.</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.toolCard, pressed && styles.pressFeedback]}
              onPress={() => go("/kitchen-pulse")}
              accessibilityRole="button"
              accessibilityLabel="Ouvrir le détail de la cuisine"
            >
              <Text style={styles.toolTitle}>Cuisine</Text>
              <Text style={styles.toolBody}>Lecture détaillée de la file active.</Text>
            </Pressable>
          </View>
        ) : null}
          </>
        ) : null}
      </ScrollView>
      </SafeAreaView>
    </MerchantAquaticSignature>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 76 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    marginBottom: 22,
  },
  brand: { color: "#F4B56B", fontSize: 11, fontWeight: "900", letterSpacing: 2.8 },
  pageTitle: { color: "#FFF8F1", fontSize: 18, fontWeight: "900", marginTop: 7 },
  presencePill: {
    minWidth: 112,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,181,107,0.08)",
    borderWidth: 1,
    borderColor: "rgba(244,181,107,0.20)",
  },
  presencePillLive: { backgroundColor: "rgba(110,245,164,0.09)", borderColor: "rgba(110,245,164,0.24)" },
  presencePillLocked: { backgroundColor: "rgba(255,255,255,0.045)", borderColor: "rgba(255,255,255,0.10)" },
  presenceDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "#F4B56B" },
  presenceDotLive: { backgroundColor: "#72F5A7" },
  presenceText: { color: "#FFF8F1", fontSize: 9, fontWeight: "900", letterSpacing: 1.15 },
  presenceHint: { color: "rgba(255,248,241,0.46)", fontSize: 8, fontWeight: "800", marginTop: 2 },
  manifesto: { color: "#FFF8F1", fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -0.8 },
  manifestoBody: {
    color: "rgba(255,248,241,0.62)",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 20,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 30,
    padding: 20,
    backgroundColor: "#F3E5D4",
    marginBottom: 14,
  },
  heroHalo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    right: -135,
    top: -165,
    backgroundColor: "rgba(231,114,49,0.16)",
  },
  heroHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  heroKicker: { color: "#8B4D2B", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  heroEyebrow: {
    color: "rgba(57,23,10,0.54)",
    fontSize: 9,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.35,
    marginTop: 7,
  },
  modePill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#2A1308" },
  modeText: { color: "#FFD8AD", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { color: "#251006", fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 17 },
  heroBody: { color: "rgba(37,16,6,0.60)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 10 },
  activationPassport: {
    marginTop: 22,
    borderRadius: 22,
    padding: 15,
    backgroundColor: "rgba(37,16,6,0.06)",
    borderWidth: 1,
    borderColor: "rgba(37,16,6,0.08)",
  },
  activationPassportHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  activationPassportKicker: { color: "#8B4D2B", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  activationPassportTitle: { color: "#251006", fontSize: 15, fontWeight: "900", marginTop: 5 },
  activationPassportCounter: { color: "#251006", fontSize: 18, fontWeight: "900" },
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
    backgroundColor: "rgba(37,16,6,0.045)",
    borderWidth: 1,
    borderColor: "rgba(37,16,6,0.07)",
  },
  activationProofChipReady: { backgroundColor: "rgba(35,133,75,0.09)", borderColor: "rgba(35,133,75,0.16)" },
  activationProofDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "rgba(37,16,6,0.24)" },
  activationProofDotReady: { backgroundColor: "#23854B" },
  activationProofLabel: { color: "rgba(37,16,6,0.68)", fontSize: 11, fontWeight: "900" },
  activationProofLabelReady: { color: "#1C633A" },
  activationProofState: { color: "rgba(37,16,6,0.42)", fontSize: 9, fontWeight: "800", marginTop: 2 },
  stageRail: { flexDirection: "row", gap: 8, marginTop: 24 },
  stageColumn: { flex: 1 },
  stageLine: { height: 4, borderRadius: 99, backgroundColor: "rgba(37,16,6,0.10)", marginBottom: 9 },
  stageLineActive: { backgroundColor: "#C86E38" },
  stageValue: { color: "rgba(37,16,6,0.38)", fontSize: 21, fontWeight: "900" },
  stageValueActive: { color: "#2A1308" },
  stageLabel: { color: "rgba(37,16,6,0.50)", fontSize: 10, fontWeight: "900", marginTop: 3 },
  prioritySurface: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 22,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(37,16,6,0.065)",
    borderWidth: 1,
    borderColor: "rgba(37,16,6,0.08)",
  },
  stateSurface: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(37,16,6,0.065)",
  },
  stateText: { color: "rgba(37,16,6,0.62)", fontWeight: "800" },
  errorSurface: { marginTop: 22, borderRadius: 22, padding: 16, backgroundColor: "rgba(144,34,24,0.10)" },
  errorTitle: { color: "#7E2118", fontSize: 15, fontWeight: "900" },
  errorText: { color: "rgba(92,26,18,0.68)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  errorRetry: { color: "#71301F", fontSize: 10, fontWeight: "900", marginTop: 9 },
  networkNotice: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: "rgba(139,78,28,0.07)", borderWidth: 1, borderColor: "rgba(139,78,28,0.13)" },
  networkNoticeKicker: { color: "#8B4E1C", fontSize: 8, fontWeight: "900", letterSpacing: 1.35 },
  networkNoticeText: { color: "rgba(65,34,18,0.58)", fontSize: 11, lineHeight: 16, marginTop: 4 },
  networkNoticeMeta: { color: "rgba(65,34,18,0.38)", fontSize: 9, lineHeight: 13, marginTop: 3, fontWeight: "800" },
  networkNoticeAction: { color: "#6B3219", fontSize: 11, fontWeight: "900" },
  priorityKicker: { color: "#98502B", fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  priorityTitle: { color: "#241006", fontSize: 20, lineHeight: 25, fontWeight: "900", marginTop: 6 },
  priorityText: { color: "rgba(37,16,6,0.58)", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 5 },
  priorityRestaurant: { color: "rgba(139,77,43,0.70)", fontSize: 10, fontWeight: "900", marginTop: 7 },
  priorityMeta: { alignItems: "flex-end" },
  priorityAmount: { color: "#321208", fontSize: 15, fontWeight: "900" },
  priorityTime: { color: "rgba(37,16,6,0.45)", fontSize: 10, fontWeight: "800", marginTop: 5 },
  primaryAction: {
    minHeight: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#2A1308",
  },
  primaryActionText: { color: "#FFF5EA", fontSize: 13, fontWeight: "900" },
  primaryArrow: { color: "#F4B56B", fontSize: 20, fontWeight: "900" },
  serviceStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 24,
    padding: 17,
    backgroundColor: "#211008",
    borderWidth: 1,
    borderColor: "rgba(244,181,107,0.13)",
    marginBottom: 10,
  },
  serviceStripText: { flex: 1 },
  serviceStripKicker: { color: "#F4B56B", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  serviceStripTitle: { color: "#FFF8F1", fontSize: 15, lineHeight: 21, fontWeight: "900", marginTop: 5 },
  allOrdersButton: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "rgba(244,181,107,0.11)" },
  allOrdersText: { color: "#FFD09F", fontWeight: "900", fontSize: 10 },
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 15,
    backgroundColor: "#1C0D07",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    marginBottom: 10,
  },
  nextKicker: { color: "#F4B56B", fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  nextTitle: { color: "#FFF8F1", fontSize: 16, fontWeight: "900", marginTop: 5 },
  nextBody: { color: "rgba(255,248,241,0.58)", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 4 },
  nextStatus: {
    color: "#241006",
    backgroundColor: "#FFCC96",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 9,
    fontWeight: "900",
  },
  toolsToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    padding: 18,
    marginTop: 14,
    backgroundColor: "#2A140C",
    borderWidth: 1,
    borderColor: "rgba(244,181,107,0.14)",
  },
  toolsKicker: { color: "#F4B56B", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  toolsTitle: { color: "#FFF8F1", fontSize: 16, fontWeight: "900", marginTop: 5 },
  toolsIcon: { color: "#F4B56B", fontSize: 27, fontWeight: "800" },
  toolsGrid: { gap: 10, marginTop: 10 },
  toolCard: { borderRadius: 20, padding: 16, backgroundColor: "#1D0D08", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  toolTitle: { color: "#FFF8F1", fontSize: 16, fontWeight: "900" },
  toolBody: { color: "rgba(255,248,241,0.56)", marginTop: 5, fontSize: 13, lineHeight: 19 },
  activationGuidance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    backgroundColor: "rgba(244,181,107,0.10)",
    borderWidth: 1,
    borderColor: "rgba(244,181,107,0.18)",
  },
  activationGuidanceKicker: { color: "#F4B56B", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  activationGuidanceTitle: { color: "#FFF8F1", fontSize: 16, fontWeight: "900", marginTop: 5 },
  activationGuidanceBody: { color: "rgba(255,248,241,0.56)", fontSize: 11, lineHeight: 16, marginTop: 4 },
  activationGuidanceButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F4B56B",
  },
  activationGuidanceButtonText: { color: "#2A1308", fontSize: 10, fontWeight: "900" },
  previewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    padding: 17,
    marginBottom: 10,
    backgroundColor: "#211008",
    borderWidth: 1,
    borderColor: "rgba(244,181,107,0.14)",
  },
  previewToggleKicker: { color: "#F4B56B", fontSize: 8, fontWeight: "900", letterSpacing: 1.9 },
  previewToggleTitle: { color: "#FFF8F1", fontSize: 15, fontWeight: "900", marginTop: 5 },
  previewToggleIcon: { color: "#F4B56B", fontSize: 25, fontWeight: "800" },
  safePreview: {
    borderRadius: 28,
    padding: 18,
    marginBottom: 12,
    backgroundColor: "#F3E5D4",
    borderWidth: 1,
    borderColor: "rgba(244,181,107,0.22)",
  },
  safePreviewHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  safePreviewKicker: { color: "#8B4D2B", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  safePreviewTitle: { color: "#251006", fontSize: 23, lineHeight: 28, fontWeight: "900", marginTop: 7 },
  safePreviewBody: { color: "rgba(37,16,6,0.58)", fontSize: 12, lineHeight: 18, marginTop: 6 },
  safePreviewBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#2A1308" },
  safePreviewBadgeText: { color: "#FFD8AD", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  safePreviewMetrics: { flexDirection: "row", gap: 8, marginTop: 18 },
  safePreviewMetric: {
    flex: 1,
    minHeight: 78,
    justifyContent: "center",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(37,16,6,0.055)",
  },
  safePreviewMetricValue: { color: "#251006", fontSize: 24, fontWeight: "900" },
  safePreviewMetricLabel: { color: "rgba(37,16,6,0.50)", fontSize: 9, fontWeight: "900", marginTop: 4 },
  safePreviewPriority: {
    marginTop: 12,
    borderRadius: 20,
    padding: 15,
    backgroundColor: "rgba(37,16,6,0.07)",
  },
  safePreviewPriorityKicker: { color: "#98502B", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  safePreviewPriorityTitle: { color: "#251006", fontSize: 16, fontWeight: "900", marginTop: 6 },
  safePreviewPriorityBody: { color: "rgba(37,16,6,0.56)", fontSize: 11, lineHeight: 17, marginTop: 5 },
  safePreviewAction: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    borderRadius: 17,
    paddingHorizontal: 15,
    backgroundColor: "#2A1308",
  },
  safePreviewActionText: { color: "#FFF5EA", fontSize: 12, fontWeight: "900" },
  safePreviewActionArrow: { color: "#F4B56B", fontSize: 19, fontWeight: "900" },
  futureRail: {
    minHeight: 62,
    marginBottom: 18,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(45,18,7,0.74)",
    borderWidth: 1,
    borderColor: "rgba(244,181,107,0.24)",
  },
  futureRailPulse: { width: 10, height: 10, borderRadius: 99, backgroundColor: "#D47A49" },
  futureRailPulseLive: { backgroundColor: "#F4B56B" },
  futureRailKicker: { color: "#F4B56B", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  futureRailText: { color: "rgba(255,245,234,0.72)", fontSize: 10.5, lineHeight: 15, fontWeight: "700", marginTop: 3 },
  futureRailMeta: { color: "#FFD8AD", fontSize: 9, fontWeight: "900", letterSpacing: 0.9, maxWidth: 78, textAlign: "right" },
  pressFeedback: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
