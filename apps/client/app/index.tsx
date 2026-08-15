import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  clearMarketplaceFocus,
  readMarketplaceFocus,
  writeMarketplaceFocus,
} from "../lib/marketplace-focus-memory";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AquaticSignature } from "../components/aquatic/AquaticSignature";
import {
  GLOBAL_MARKETPLACE_CATALOG,
  type MarketplaceRadarEntry,
} from "../lib/marketplace-discovery-engine";
import { buildMarketplaceOpportunityGraph } from "../lib/marketplace-opportunity-graph";
import { buildMarketplaceLaunchPassports } from "../lib/marketplace-launch-passport";
import { buildMarketplaceCulturalConstellations } from "../lib/marketplace-cultural-constellations";

type MenuItem = { name?: string; category?: string; price?: number; priceEUR?: number };
type Partner = {
  id?: string;
  name?: string;
  slug?: string;
  city?: string;
  area?: string;
  country?: string;
  cuisine?: string;
  cuisines?: string[];
  address?: string;
  rating?: number;
  status?: string;
  featured?: boolean;
  description?: string;
  menu?: MenuItem[];
  menuItems?: MenuItem[];
  delivery?: { prepTimeMinutes?: number; enabled?: boolean };
};
type MarketplacePartner = Partner & {
  marketplaceSource: "live" | "radar";
  radarId?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  sourceKind?: string;
  checkedAt?: string;
  launchWave?: number;
  priority?: string;
};
type Order = {
  id?: string;
  publicId?: string;
  restaurantName?: string;
  itemName?: string;
  status?: string;
  total?: number;
  amount?: number;
  items?: Array<{ name?: string; quantity?: number; qty?: number }>;
  createdAt?: string;
  updatedAt?: string;
};

const API_ORIGIN = "https://api.delishafrica.me";
const API_V1 = "https://api.delishafrica.me/api/v1";

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
    return "Connexion momentanément indisponible. La dernière vérité reste affichée.";
  }
  return "Une partie du réseau ne répond pas encore. La dernière vérité reste affichée.";
}
const FALLBACK_CUISINES = ["Tout", "Sénégalais", "Ivoirien", "Camerounais", "Congolais", "Nigérian", "Éthiopien", "Fusion africaine", "Street food", "Grillades"];

type TastePalette = {
  canvas: string;
  deep: string;
  plate: string;
  sauce: string;
  grain: string;
  accent: string;
  ink: string;
  mist: string;
};

const TASTE_PALETTES: TastePalette[] = [
  { canvas: "#7A321D", deep: "#3A170F", plate: "#F3C66B", sauce: "#A91F1A", grain: "#FFF0C8", accent: "#FFCF72", ink: "#231209", mist: "rgba(255,226,160,0.18)" },
  { canvas: "#1B5A49", deep: "#0A2C25", plate: "#EED9A6", sauce: "#E07B3C", grain: "#FFF7DE", accent: "#8FE2C0", ink: "#09251D", mist: "rgba(143,226,192,0.16)" },
  { canvas: "#4B2C6F", deep: "#241333", plate: "#F0D6A4", sauce: "#C14E7A", grain: "#FFF2D8", accent: "#D7A9FF", ink: "#241333", mist: "rgba(215,169,255,0.17)" },
  { canvas: "#174F6A", deep: "#082A3C", plate: "#F2DBB1", sauce: "#E0563F", grain: "#FFF8E6", accent: "#8DDCFF", ink: "#082A3C", mist: "rgba(141,220,255,0.16)" },
  { canvas: "#6A4A17", deep: "#32230A", plate: "#F6D27D", sauce: "#7C2F1B", grain: "#FFF3CC", accent: "#F5C253", ink: "#2D1D07", mist: "rgba(245,194,83,0.17)" },
  { canvas: "#5D2534", deep: "#2A0F17", plate: "#EAC98F", sauce: "#7B1834", grain: "#FFF0D7", accent: "#F28BAA", ink: "#2A0F17", mist: "rgba(242,139,170,0.16)" },
];

function tastePaletteFor(partner?: Partner): TastePalette {
  const identity = normalized([partner?.name, partner?.slug, partner?.cuisine, ...(partner?.cuisines || [])].join(" "));
  const preferred = identity.includes("thieyp") ? 0
    : identity.includes("malou") ? 1
    : identity.includes("toukoul") ? 4
    : identity.includes("afrikana") ? 5
    : -1;
  if (preferred >= 0) return TASTE_PALETTES[preferred];
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) hash = ((hash << 5) - hash + identity.charCodeAt(index)) | 0;
  return TASTE_PALETTES[Math.abs(hash) % TASTE_PALETTES.length];
}

function dishNames(partner?: Partner): string[] {
  if (!partner) return [];
  return menuOf(partner)
    .map((item) => String(item.name || "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function publicPartnerDescription(partner: MarketplacePartner): string {
  const raw = String(partner.description || "").trim();
  const internalCopy = /placeholder|test|démo|demo|onboarding|masqué en démo|avant onboarding/i.test(raw);
  if (raw && !internalCopy) return raw;
  if (orderable(partner)) {
    return "Une cuisine ouverte du réseau DelishAfrica, prête à accueillir votre prochain moment.";
  }
  return "Cette cuisine prépare son arrivée dans le réseau. Son ouverture reste clairement séparée de l’offre disponible.";
}

function normalized(value: unknown): string {
  return String(value || "").trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function menuOf(partner: Partner): MenuItem[] {
  return Array.isArray(partner.menu) ? partner.menu : Array.isArray(partner.menuItems) ? partner.menuItems : [];
}
function cityOf(partner: Partner): string {
  return String(partner.city || partner.area || partner.country || "Réseau DelishAfrica");
}
function countryOf(partner: Partner): string {
  return String(partner.country || "Réseau DelishAfrica");
}
function cuisineOf(partner: Partner): string {
  return String(partner.cuisine || partner.cuisines?.[0] || "Cuisine africaine");
}
function orderable(partner: MarketplacePartner): boolean {
  if (partner.marketplaceSource === "radar") return false;
  const status = normalized(partner.status);
  return (status === "active" || status === "open" || status === "") && menuOf(partner).length > 0;
}
function priceLabel(order?: Order): string {
  const raw = Number(order?.total || order?.amount || 0);
  const euros = Number.isInteger(raw) && raw >= 100 ? raw / 100 : raw;
  return euros > 0 ? euros.toFixed(2).replace(".", ",") + " €" : "";
}
function isActive(order: Order): boolean {
  return !["delivered", "completed", "cancelled"].includes(normalized(order.status));
}
function orderTime(order: Order): number {
  return Date.parse(String(order.updatedAt || order.createdAt || "")) || 0;
}
function orderSummary(order?: Order): string {
  if (!order) return "";
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length) return items.map((item) => `${Number(item.quantity || item.qty || 1)}× ${item.name || "Article"}`).join(" · ");
  return String(order.itemName || "Votre sélection");
}
function stageOf(order?: Order): number {
  const status = normalized(order?.status);
  if (["picked_up", "on_the_way", "in_transit"].includes(status)) return 2;
  if (["ready", "accepted", "preparing", "confirmed"].includes(status)) return 1;
  return 0;
}
function dayMoment(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "MATIN";
  if (hour < 15) return "MIDI";
  if (hour < 18) return "APRÈS-MIDI";
  return "SOIR";
}
function radarPartner(entry: MarketplaceRadarEntry): MarketplacePartner {
  return {
    id: `radar:${entry.id}`,
    name: entry.name,
    city: entry.city,
    country: entry.country,
    cuisine: entry.cuisine,
    cuisines: entry.cuisines,
    description: entry.description,
    status: "watchlist",
    featured: entry.priority === "launch",
    marketplaceSource: "radar",
    radarId: entry.id,
    sourceUrl: entry.sourceUrl,
    sourceLabel: entry.sourceLabel,
    sourceKind: entry.sourceKind,
    checkedAt: entry.checkedAt,
    launchWave: entry.launchWave,
    priority: entry.priority,
  };
}
function identityKey(partner: Partner): string {
  return `${normalized(partner.name)}::${normalized(cityOf(partner))}`;
}
function liveNameKey(partner: Partner): string {
  return normalized(partner.name);
}
function bestPartner(partners: MarketplacePartner[]): MarketplacePartner | undefined {
  return [...partners].sort((a, b) => {
    const orderableDelta = Number(orderable(b)) - Number(orderable(a));
    if (orderableDelta) return orderableDelta;
    const liveDelta = Number(b.marketplaceSource === "live") - Number(a.marketplaceSource === "live");
    if (liveDelta) return liveDelta;
    const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDelta) return featuredDelta;
    const ratingDelta = Number(b.rating || 0) - Number(a.rating || 0);
    if (ratingDelta) return ratingDelta;
    return menuOf(b).length - menuOf(a).length;
  })[0];
}
function clientHorizon(order: Order | undefined, partner: MarketplacePartner | undefined, country: string, city: string, cuisine: string) {
  if (order && isActive(order)) {
    const stage = stageOf(order);
    return {
      live: true,
      eyebrow: "HORIZON PERSONNEL · EN MOUVEMENT",
      title: stage === 2 ? "Votre table devient le prochain point du réseau." : stage === 1 ? "La cuisine construit déjà votre prochain moment." : "Votre expérience vient d’entrer dans le réseau.",
      body: `${order.restaurantName || "Une cuisine partenaire"} · ${orderSummary(order)}`,
      action: "Suivre maintenant",
      axisA: stage === 2 ? "Route" : stage === 1 ? "Cuisine" : "Demande",
      axisB: "Synchronisé",
      axisC: dayMoment(),
    };
  }
  const radar = partner?.marketplaceSource === "radar";
  return {
    live: false,
    eyebrow: radar ? "NOUVELLE ESCALE REPÉRÉE" : "VOTRE PROCHAIN MOMENT",
    title: partner ? `${partner.name || "Une adresse"} correspond au moment.` : "Votre prochaine découverte se dessine déjà.",
    body: partner
      ? radar
        ? `${cityOf(partner)} · ${cuisineOf(partner)} · présence publique repérée, bientôt disponible`
        : `${cityOf(partner)} · ${cuisineOf(partner)} · ${menuOf(partner).length} création${menuOf(partner).length > 1 ? "s" : ""}`
      : "Élargissez l’horizon : la marketplace réinterprète le pays, la ville, l’envie et le moment.",
    action: partner ? (radar ? "Explorer la fiche Discovery" : "Ouvrir cette escale") : "Réouvrir le réseau",
    axisA: city !== "Toutes" ? city : country === "Tous" ? "Monde" : country,
    axisB: cuisine === "Tout" ? "Libre" : cuisine,
    axisC: dayMoment(),
  };
}
function momentCopy(order: Order | undefined, liveCount: number, radarCount: number): string[] {
  if (!order) {
    return [
      `${radarCount} adresse${radarCount > 1 ? "s" : ""} repérée${radarCount > 1 ? "s" : ""}. ${liveCount} partenaire${liveCount > 1 ? "s" : ""} déjà relié${liveCount > 1 ? "s" : ""} au réseau.`,
      "Le Radar dessine le marché avant même que chaque établissement ne soit officialisé.",
      "Une envie devient une ville, une adresse, puis une future histoire à commander.",
    ];
  }
  const restaurant = order.restaurantName || "Une cuisine partenaire";
  const status = normalized(order.status);
  if (["picked_up", "on_the_way", "in_transit"].includes(status)) {
    return [
      `${restaurant} a confié votre commande au réseau terrain.`,
      "Votre repas traverse la ville pendant que son histoire continue.",
      "Cuisine, route et table avancent désormais dans le même tempo.",
    ];
  }
  if (status === "ready") {
    return [
      `${restaurant} vient d’achever votre commande.`,
      "Le passage de la cuisine à la route se prépare maintenant.",
      "Chaque minute utile est partagée entre la cuisine et le coursier.",
    ];
  }
  return [
    `${restaurant} compose votre expérience en ce moment.`,
    "Votre sélection prend vie, geste après geste, derrière le comptoir.",
    "Le réseau prépare déjà la suite avant même que vous ayez à la demander.",
  ];
}

// DELISHAFRICA_AMBIENT_DISCOVERY_V1
// DELISHAFRICA_SIGNATURE_TASTE_CANVAS_V1
// DELISHAFRICA_MARKETPLACE_CONTEXT_MEMORY_V1
// DELISHAFRICA_SPRINT27_NETWORK_GRACE_TRUTH_V1
// DELISHAFRICA_SPRINT28_FRESHNESS_GATE_TRUTH_V1B_TYPE_RESCUE
export default function GlobalMarketplaceHome() {
  const insets = useSafeAreaInsets();
  const initialFocus = useRef(readMarketplaceFocus()).current;
  const [partners, setPartners] = useState<Partner[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [networkTruth, setNetworkTruth] = useState<NetworkTruth>("syncing");
  const [lastConfirmedAt, setLastConfirmedAt] = useState("—");
  const [query, setQuery] = useState(initialFocus.query);
  const [country, setCountry] = useState(initialFocus.country);
  const [city, setCity] = useState(initialFocus.city);
  const [cuisine, setCuisine] = useState(initialFocus.cuisine);
  const [storyIndex, setStoryIndex] = useState(0);
  const [ambientIndex, setAmbientIndex] = useState(initialFocus.ambientIndex);
  const [signatureIndex, setSignatureIndex] = useState(initialFocus.signatureIndex);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const ambientOpacity = useRef(new Animated.Value(1)).current;
  const signatureOpacity = useRef(new Animated.Value(1)).current;
  const marketplaceScrollRef = useRef<ScrollView | null>(null);
  const lastScrollY = useRef(initialFocus.scrollY);
  const restorePending = useRef(initialFocus.scrollY > 0);
  const filterResetReady = useRef(false);
  // DELISHAFRICA_SPRINT26_LIVE_RESUME_TRUTH_V1
  const appStateRef = useRef(AppState.currentState);
  const backgroundAtRef = useRef<number | null>(null);
  const loadFlightRef = useRef<Promise<void> | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    const storyTimer = setInterval(() => setStoryIndex((value) => (value + 1) % 3), 5200);
    return () => {
      loop.stop();
      clearInterval(storyTimer);
    };
  }, [pulse]);

  const load = useCallback(async () => {
    if (loadFlightRef.current) return loadFlightRef.current;
    const flight = (async () => {
      if (!hasLoadedRef.current) {
        setLoading(true);
        setNetworkTruth("syncing");
      }
      const results = await Promise.allSettled([
        fetchNetworkJson(`${API_ORIGIN}/api/partners?t=${Date.now()}`),
        fetchNetworkJson(`${API_V1}/orders/demo/list`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ]);
      const partnerResult = results[0];
      const orderResult = results[1];
      let successCount = 0;
      if (partnerResult.status === "fulfilled") {
        setPartners(Array.isArray(partnerResult.value) ? partnerResult.value : []);
        successCount += 1;
      }
      if (orderResult.status === "fulfilled") {
        setOrders(Array.isArray(orderResult.value?.orders) ? orderResult.value.orders : []);
        successCount += 1;
      }
      if (successCount === 2) {
        setNetworkTruth("live");
        setError("");
        setLastConfirmedAt(
          new Date().toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" }),
        );
      } else {
        const reason = partnerResult.status === "rejected"
          ? partnerResult.reason
          : orderResult.status === "rejected"
            ? orderResult.reason
            : undefined;
        setNetworkTruth("stale");
        setError(networkTruthMessage(reason));
      }
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    })();
    loadFlightRef.current = flight;
    try {
      await flight;
    } finally {
      if (loadFlightRef.current === flight) loadFlightRef.current = null;
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
        if (backgroundAt && Date.now() - backgroundAt >= 12000) void load();
      }
    });
    return () => subscription.remove();
  }, [load]);

  const marketplace = useMemo<MarketplacePartner[]>(() => {
    const live = partners.map((partner) => ({ ...partner, marketplaceSource: "live" as const }));
    const liveExact = new Set(live.map(identityKey));
    const liveNames = new Set(live.map(liveNameKey));
    const radar = GLOBAL_MARKETPLACE_CATALOG
      .map(radarPartner)
      .filter((partner) => !liveExact.has(identityKey(partner)) && !liveNames.has(liveNameKey(partner)));
    return [...live, ...radar];
  }, [partners]);
  const liveCount = partners.length;
  const radarCount = marketplace.filter((partner) => partner.marketplaceSource === "radar").length;
  const countries = useMemo(() => ["Tous", ...Array.from(new Set(marketplace.map(countryOf))).sort((a, b) => a.localeCompare(b, "fr"))], [marketplace]);
  const cities = useMemo(() => {
    const scoped = country === "Tous" ? marketplace : marketplace.filter((partner) => countryOf(partner) === country);
    return ["Toutes", ...Array.from(new Set(scoped.map(cityOf))).sort((a, b) => a.localeCompare(b, "fr"))];
  }, [marketplace, country]);
  const cuisines = useMemo(() => {
    const dynamic = marketplace.flatMap((partner) => [cuisineOf(partner), ...(partner.cuisines || [])]).filter(Boolean);
    return Array.from(new Set([...FALLBACK_CUISINES, ...dynamic])).slice(0, 24);
  }, [marketplace]);
  const filtered = useMemo(() => {
    const q = normalized(query);
    return marketplace.filter((partner) => {
      const text = normalized([partner.name, partner.city, partner.area, partner.country, partner.cuisine, ...(partner.cuisines || []), partner.description].join(" "));
      const countryMatch = country === "Tous" || normalized(countryOf(partner)) === normalized(country);
      const cityMatch = city === "Toutes" || normalized(cityOf(partner)) === normalized(city);
      const cuisineMatch = cuisine === "Tout" || text.includes(normalized(cuisine));
      return (!q || text.includes(q)) && countryMatch && cityMatch && cuisineMatch;
    });
  }, [marketplace, query, country, city, cuisine]);
  const featured = useMemo(() => filtered.filter((partner) => partner.marketplaceSource === "live" ? partner.featured || Number(partner.rating || 0) >= 4.6 : partner.priority === "launch"), [filtered]);
  const displayed = useMemo(() => [...filtered].sort((a, b) => {
    const orderableDelta = Number(orderable(b)) - Number(orderable(a));
    if (orderableDelta) return orderableDelta;
    const liveDelta = Number(b.marketplaceSource === "live") - Number(a.marketplaceSource === "live");
    if (liveDelta) return liveDelta;
    const featuredDelta = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (featuredDelta) return featuredDelta;
    const priorityDelta = Number(b.priority === "launch") - Number(a.priority === "launch");
    if (priorityDelta) return priorityDelta;
    const ratingDelta = Number(b.rating || 0) - Number(a.rating || 0);
    if (ratingDelta) return ratingDelta;
    return String(a.name || "").localeCompare(String(b.name || ""), "fr");
  }), [filtered]);
  const activeOrders = useMemo(() => orders.filter(isActive), [orders]);
  const latestOrder = useMemo(() => [...orders].sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || orderTime(b) - orderTime(a))[0], [orders]);
  const activeStage = stageOf(activeOrders[0] || latestOrder);
  const livingStories = useMemo(() => momentCopy(activeOrders[0] || latestOrder, liveCount, radarCount), [activeOrders, latestOrder, liveCount, radarCount]);
  const horizonPartner = useMemo(() => bestPartner(featured.length ? featured : displayed), [featured, displayed]);
  const horizon = useMemo(
    () => clientHorizon(activeOrders[0] || latestOrder, horizonPartner, country, city, cuisine),
    [activeOrders, latestOrder, horizonPartner, country, city, cuisine],
  );
  const countryCount = useMemo(() => new Set(marketplace.map(countryOf)).size, [marketplace]);
  const cuisineCount = useMemo(() => new Set(marketplace.map(cuisineOf)).size, [marketplace]);
  const opportunityGraph = useMemo(() => buildMarketplaceOpportunityGraph(partners), [partners]);
  const opportunityLead = opportunityGraph[0];
  const launchPassports = useMemo(() => buildMarketplaceLaunchPassports(partners), [partners]);
  const launchPassportLead = launchPassports[0];
  const culturalConstellations = useMemo(() => buildMarketplaceCulturalConstellations(partners), [partners]);
  const culturalConstellationLead = culturalConstellations.find((item) => item.id !== "grand-atlas") || culturalConstellations[0];
  const liveDisplayed = useMemo(() => displayed.filter((partner) => partner.marketplaceSource === "live"), [displayed]);
  const orderNowPartner = useMemo(() => liveDisplayed.find((partner) => orderable(partner)), [liveDisplayed]);
  const radarDisplayed = useMemo(() => displayed.filter((partner) => partner.marketplaceSource === "radar"), [displayed]);
  const ambientSignal = radarDisplayed.length ? radarDisplayed[ambientIndex % radarDisplayed.length] : undefined;
  const signaturePartners = useMemo(() => liveDisplayed.filter((partner) => orderable(partner)).slice(0, 10), [liveDisplayed]);
  const openingPartners = useMemo(() => liveDisplayed.filter((partner) => !orderable(partner)).slice(0, 8), [liveDisplayed]);
  const signaturePartner = signaturePartners.length ? signaturePartners[signatureIndex % signaturePartners.length] : undefined;
  const signaturePalette = useMemo(() => tastePaletteFor(signaturePartner), [signaturePartner]);
  const signatureDishes = useMemo(() => dishNames(signaturePartner), [signaturePartner]);

  useEffect(() => {
    if (!filterResetReady.current) return;
    setAmbientIndex(0);
    ambientOpacity.setValue(1);
  }, [ambientOpacity, country, city, cuisine, query]);

  useEffect(() => {
    if (reduceMotion || radarDisplayed.length < 2) return undefined;
    const timer = setInterval(() => {
      Animated.timing(ambientOpacity, { toValue: 0.18, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setAmbientIndex((value) => (value + 1) % radarDisplayed.length);
        Animated.timing(ambientOpacity, { toValue: 1, duration: 420, useNativeDriver: true }).start();
      });
    }, 5600);
    return () => clearInterval(timer);
  }, [ambientOpacity, radarDisplayed.length, reduceMotion]);

  useEffect(() => {
    if (!filterResetReady.current) {
      filterResetReady.current = true;
      return;
    }
    setSignatureIndex(0);
    signatureOpacity.setValue(1);
  }, [signatureOpacity, country, city, cuisine, query]);

  useEffect(() => {
    writeMarketplaceFocus({
      query,
      country,
      city,
      cuisine,
      ambientIndex,
      signatureIndex,
      scrollY: lastScrollY.current,
    });
  }, [ambientIndex, city, country, cuisine, query, signatureIndex]);

  useEffect(() => {
    if (!restorePending.current || loading || marketplace.length === 0) return undefined;
    const timer = setTimeout(() => {
      marketplaceScrollRef.current?.scrollTo({ y: initialFocus.scrollY, animated: false });
      restorePending.current = false;
    }, 160);
    return () => clearTimeout(timer);
  }, [initialFocus.scrollY, loading, marketplace.length]);

  function rememberMarketplaceScroll(event: { nativeEvent: { contentOffset: { y: number } } }) {
    const nextY = Math.max(0, Number(event.nativeEvent.contentOffset.y || 0));
    lastScrollY.current = nextY;
    writeMarketplaceFocus({ scrollY: nextY });
  }

  function rememberMarketplaceFocus() {
    writeMarketplaceFocus({
      query,
      country,
      city,
      cuisine,
      ambientIndex,
      signatureIndex,
      scrollY: lastScrollY.current,
    });
  }

  useEffect(() => {
    if (reduceMotion || signaturePartners.length < 2) return undefined;
    const timer = setInterval(() => {
      Animated.timing(signatureOpacity, { toValue: 0.16, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setSignatureIndex((value) => (value + 1) % signaturePartners.length);
        Animated.timing(signatureOpacity, { toValue: 1, duration: 460, useNativeDriver: true }).start();
      });
    }, 7200);
    return () => {
      clearInterval(timer);
      signatureOpacity.stopAnimation();
    };
  }, [reduceMotion, signatureOpacity, signaturePartners.length]);

  function selectSignature(nextIndex: number) {
    if (nextIndex === signatureIndex || signaturePartners.length < 2) return;
    if (reduceMotion) {
      setSignatureIndex(nextIndex);
      signatureOpacity.setValue(1);
      return;
    }
    Animated.timing(signatureOpacity, { toValue: 0.16, duration: 150, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      setSignatureIndex(nextIndex);
      Animated.timing(signatureOpacity, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    });
  }

  function openPartner(partner: MarketplacePartner) {
    rememberMarketplaceFocus();
    if (partner.marketplaceSource === "radar" && partner.radarId) {
      router.push({ pathname: "/restaurant-preview" as never, params: { radarId: partner.radarId } } as never);
      return;
    }
    if (!partner.slug) return;
    router.push({ pathname: "/menu" as never, params: { restaurantSlug: partner.slug } } as never);
  }
  function openHorizon() {
    rememberMarketplaceFocus();
    if (horizon.live) {
      router.push("/live-tracking" as never);
      return;
    }
    if (orderNowPartner) {
      openPartner(orderNowPartner);
      return;
    }
    router.push("/restaurants" as never);
  }
  function chooseCountry(value: string) {
    setCountry(value);
    setCity("Toutes");
  }
  function resetFilters() {
    clearMarketplaceFocus();
    lastScrollY.current = 0;
    restorePending.current = false;
    marketplaceScrollRef.current?.scrollTo({ y: 0, animated: !reduceMotion });
    setQuery(""); setCountry("Tous"); setCity("Toutes"); setCuisine("Tout");
    setAmbientIndex(0); setSignatureIndex(0);
  }

  return (
    <AquaticSignature reduceMotion={reduceMotion}>
      <ScrollView
      ref={marketplaceScrollRef}
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 42) }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor="#D9AE68"
        />
      }
      showsVerticalScrollIndicator={false}
      onScroll={rememberMarketplaceScroll}
      scrollEventThrottle={160}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.role}>Commander · Suivre</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.profileButton, pressed && styles.pressFeedback]}
          onPress={() => { rememberMarketplaceFocus(); router.push("/client-space" as never); }}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir mon espace client"
          accessibilityHint="Accède à votre profil, vos adresses et vos commandes"
          hitSlop={8}
        >
          <Text style={styles.profileText}>Mon espace</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>FAIM MAINTENANT</Text>
        <Text style={styles.title}>Trouvez. Choisissez. Commandez.</Text>
        <Text style={styles.subtitle}>Votre prochaine commande commence ici. Recherchez un plat, un restaurant ou une cuisine, puis suivez chaque étape jusqu’à votre porte.</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Restaurant, plat, cuisine, ville, pays…"
            placeholderTextColor="rgba(255,255,255,0.42)"
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            selectionColor="#D9AE68"
            accessibilityLabel="Rechercher dans la marketplace"
            accessibilityHint="Recherchez un restaurant, un plat, une cuisine, une ville ou un pays"
          />
        </View>
      </View>

      <View style={styles.essentialCard}>
        <View style={styles.essentialAura} pointerEvents="none" />
        <View style={styles.essentialHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.essentialKicker}>POUR VOUS · MAINTENANT</Text>
            <Text style={styles.essentialTitle}>{activeOrders.length ? "Votre commande reste au centre." : "Prêt à commander ?"}</Text>
          </View>
          <Animated.View
            style={[
              styles.essentialPulse,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.16] }) }],
              },
            ]}
          />
        </View>
        <Text style={styles.essentialText}>{activeOrders.length ? livingStories[storyIndex] || livingStories[0] : horizon.body}</Text>
        <View style={styles.essentialFacts}>
          <View style={styles.essentialFact}>
            <Text style={styles.essentialFactValue}>{liveCount}</Text>
            <Text style={styles.essentialFactLabel}>partenaires actifs</Text>
          </View>
          <View style={styles.essentialFact}>
            <Text style={styles.essentialFactValue}>{countryCount}</Text>
            <Text style={styles.essentialFactLabel}>pays préparés</Text>
          </View>
          <View style={styles.essentialFact}>
            <Text style={styles.essentialFactValue}>{activeOrders.length ? activeStage + 1 : radarCount}</Text>
            <Text style={styles.essentialFactLabel}>{activeOrders.length ? "étape en cours" : "signaux en veille"}</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.essentialAction, pressed && styles.pressFeedback]}
          onPress={openHorizon}
          accessibilityRole="button"
          accessibilityLabel={horizon.live ? "Suivre ma commande maintenant" : "Commander maintenant"}
          accessibilityHint={horizon.live ? "Ouvre le suivi de votre commande active" : "Ouvre directement un menu disponible"}
        >
          <Text style={styles.essentialActionText}>{horizon.live ? "Suivre maintenant" : "Commander maintenant"}</Text>
          <Text style={styles.essentialActionArrow}>→</Text>
        </Pressable>
      </View>

      {activeOrders[0] ? (
        <Pressable
          style={({ pressed }) => [styles.orderStrip, pressed && styles.pressFeedback]}
          onPress={() => { rememberMarketplaceFocus(); router.push("/live-tracking" as never); }}
          accessibilityRole="button"
          accessibilityLabel={`Suivre la commande chez ${activeOrders[0].restaurantName || "le restaurant partenaire"}`}
          accessibilityHint="Ouvre le suivi en direct de la commande"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.orderStripKicker}>COMMANDE EN MOUVEMENT</Text>
            <Text style={styles.orderStripTitle}>{activeOrders[0].restaurantName || "Restaurant partenaire"}</Text>
            <Text style={styles.orderStripText} numberOfLines={1}>{orderSummary(activeOrders[0])}</Text>
          </View>
          <Text style={styles.orderStripArrow}>→</Text>
        </Pressable>
      ) : null}

      <View style={styles.experienceShelf}>
        <Text style={styles.experienceShelfKicker}>DÉCOUVRIR AUTREMENT</Text>
        <Text style={styles.experienceShelfTitle}>La magie reste disponible, sans ralentir votre commande.</Text>

        <Pressable
          style={({ pressed }) => [styles.experienceItem, pressed && styles.pressFeedback]}
          onPress={() => { rememberMarketplaceFocus(); router.push("/taste-oracle" as never); }}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir Taste Oracle"
          accessibilityHint="Transforme votre humeur en recommandation culinaire"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.experienceItemKicker}>TASTE ORACLE</Text>
            <Text style={styles.experienceItemTitle}>Une envie devient une assiette.</Text>
          </View>
          <Text style={styles.experienceItemArrow}>→</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.experienceItem, pressed && styles.pressFeedback]}
          onPress={() => { rememberMarketplaceFocus(); router.push("/delivery-intelligence" as never); }}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir Delivery Intelligence"
          accessibilityHint="Affiche la progression coordonnée du paiement à la livraison"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.experienceItemKicker}>DELIVERY INTELLIGENCE</Text>
            <Text style={styles.experienceItemTitle}>Une commande, une pulsation partagée.</Text>
          </View>
          <Text style={styles.experienceItemArrow}>→</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.experienceItem, pressed && styles.pressFeedback]}
          onPress={() => { rememberMarketplaceFocus(); router.push("/delishafrica-signature" as never); }}
          accessibilityRole="button"
          accessibilityLabel="Ouvrir DelishAfrica Signature"
          accessibilityHint="Découvre l’univers visuel aquatique de DelishAfrica"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.experienceItemKicker}>SIGNATURE AQUATIQUE</Text>
            <Text style={styles.experienceItemTitle}>L’identité vivante de DelishAfrica.</Text>
          </View>
          <Text style={styles.experienceItemArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.signalDock}>
        <View style={styles.signalDockHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.signalDockKicker}>LE RÉSEAU · DEUX REGARDS</Text>
            <Text style={styles.signalDockTitle}>Comprendre le réseau sans encombrer la marketplace.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.signalDockPulseButton, pressed && styles.pressFeedback]}
            onPress={() => { rememberMarketplaceFocus(); router.push("/market-pulse" as never); }}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le pouls du réseau"
            accessibilityHint="Affiche les signaux de développement de la marketplace"
          >
            <Text style={styles.signalDockPulseText}>Pouls →</Text>
          </Pressable>
        </View>
        <View style={styles.signalDockGrid}>
          {launchPassportLead ? (
            <Pressable
              style={({ pressed }) => [styles.signalDockCell, pressed && styles.pressFeedback]}
              onPress={() => { rememberMarketplaceFocus(); router.push({ pathname: "/market-launch-passport" as never, params: { city: launchPassportLead.city, country: launchPassportLead.country } } as never); }}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir le passeport de lancement de ${launchPassportLead.city}`}
              accessibilityHint="Affiche les preuves et la trajectoire d'ouverture de cette ville"
            >
              <Text style={styles.signalDockCellKicker}>VILLE PRIORITAIRE</Text>
              <Text style={styles.signalDockCellTitle}>{launchPassportLead.city}</Text>
              <Text style={styles.signalDockCellMeta}>{launchPassportLead.readinessScore}/100 · {launchPassportLead.country}</Text>
            </Pressable>
          ) : null}
          {culturalConstellationLead ? (
            <Pressable
              style={({ pressed }) => [styles.signalDockCell, pressed && styles.pressFeedback]}
              onPress={() => { rememberMarketplaceFocus(); router.push({ pathname: "/market-cultural-constellation" as never, params: { constellationId: culturalConstellationLead.id } } as never); }}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir la route culturelle ${culturalConstellationLead.name}`}
              accessibilityHint="Affiche les villes et adresses reliées par cette constellation"
            >
              <Text style={styles.signalDockCellKicker}>ROUTE CULTURELLE</Text>
              <Text style={styles.signalDockCellTitle}>{culturalConstellationLead.name}</Text>
              <Text style={styles.signalDockCellMeta} numberOfLines={1}>{culturalConstellationLead.bridge}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.signalDockTruth}>{radarCount} signaux qualifiés · {launchPassports.length} villes documentées · aucune demande inventée</Text>
      </View>

      <Text style={styles.sectionKicker}>AFFINER LA DÉCOUVERTE</Text>
      <Text style={styles.sectionTitle}>Pays</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {countries.map((item) => (
          <Pressable
            key={item}
            style={({ pressed }) => [styles.chip, country === item && styles.chipActive, pressed && styles.pressFeedback]}
            onPress={() => chooseCountry(item)}
            accessibilityRole="button"
            accessibilityLabel={`Filtrer par pays : ${item}`}
            accessibilityState={{ selected: country === item }}
          >
            <Text style={[styles.chipText, country === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Ville</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {cities.map((item) => (
          <Pressable
            key={item}
            style={({ pressed }) => [styles.chip, city === item && styles.chipActive, pressed && styles.pressFeedback]}
            onPress={() => setCity(item)}
            accessibilityRole="button"
            accessibilityLabel={`Filtrer par ville : ${item}`}
            accessibilityState={{ selected: city === item }}
          >
            <Text style={[styles.chipText, city === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Cuisine</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {cuisines.map((item) => (
          <Pressable
            key={item}
            style={({ pressed }) => [styles.chip, cuisine === item && styles.chipActive, pressed && styles.pressFeedback]}
            onPress={() => setCuisine(item)}
            accessibilityRole="button"
            accessibilityLabel={`Filtrer par cuisine : ${item}`}
            accessibilityState={{ selected: cuisine === item }}
          >
            <Text style={[styles.chipText, cuisine === item && styles.chipTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {networkTruth === "stale" && error ? (
        <Pressable
          style={({ pressed }) => [styles.networkNotice, pressed && styles.networkNoticePressed]}
          onPress={() => { void load(); }}
          accessibilityRole="button"
          accessibilityLabel="Dernière vérité conservée. Réessayer la synchronisation"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.networkNoticeKicker}>DERNIÈRE VÉRITÉ CONSERVÉE</Text>
            <Text style={styles.networkNoticeText}>{error}</Text>
            {lastConfirmedAt !== "—" ? (
              <Text style={styles.networkNoticeMeta}>Dernière confirmation {lastConfirmedAt}</Text>
            ) : null}
          </View>
          <Text style={styles.networkNoticeAction}>Réessayer</Text>
        </Pressable>
      ) : null}
      {loading && marketplace.length === 0 ? <View style={styles.loading}><ActivityIndicator color="#D9AE68" /><Text style={styles.loadingText}>Ouverture du réseau…</Text></View> : null}

      {/* DELISHAFRICA_SIGNATURE_STATUS_TRUTH_V1 */}
      <View style={styles.signatureSection}>
        <View style={styles.signatureSectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.signatureKicker}>CUISINES OUVERTES</Text>
            <Text style={styles.signatureTitle}>Une cuisine. Un instant. Un choix.</Text>
          </View>
          <Text style={styles.signatureCounter}>
            {signaturePartners.length} ouverte{signaturePartners.length > 1 ? "s" : ""}
            {openingPartners.length ? ` · ${openingPartners.length} en préparation` : ""}
          </Text>
        </View>

        {signaturePartner ? (
          <>
            <Animated.View style={{ opacity: signatureOpacity }}>
              <Pressable
                style={({ pressed }) => [styles.signaturePortal, pressed && styles.pressFeedback]}
                onPress={() => openPartner(signaturePartner)}
                disabled={!signaturePartner.slug}
                accessibilityRole="button"
                accessibilityLabel={`${signaturePartner.name || "Restaurant partenaire"} · ${cityOf(signaturePartner)} · ouvrir le menu`}
                accessibilityHint="Ouvre le menu de cette cuisine actuellement disponible"
                accessibilityState={{ disabled: !signaturePartner.slug }}
              >
                <View style={[styles.signaturePortalAura, { backgroundColor: signaturePalette.mist, borderColor: signaturePalette.accent }]} pointerEvents="none" />
                <View style={[styles.signaturePortalVisual, { backgroundColor: signaturePalette.canvas }]}>
                  <View style={[styles.tasteCanvasDeep, { backgroundColor: signaturePalette.deep }]} pointerEvents="none" />
                  <View style={[styles.tasteCanvasMist, { backgroundColor: signaturePalette.mist }]} pointerEvents="none" />
                  <View style={[styles.tasteCanvasPlate, { backgroundColor: signaturePalette.plate, borderColor: signaturePalette.accent }]}>
                    <View style={[styles.tasteCanvasSauce, { backgroundColor: signaturePalette.sauce }]} />
                    <View style={[styles.tasteCanvasGrainA, { backgroundColor: signaturePalette.grain }]} />
                    <View style={[styles.tasteCanvasGrainB, { backgroundColor: signaturePalette.grain }]} />
                    <View style={[styles.tasteCanvasLeaf, { backgroundColor: signaturePalette.accent }]} />
                    <Animated.View
                      style={[
                        styles.tasteCanvasPulse,
                        { backgroundColor: signaturePalette.accent, shadowColor: signaturePalette.accent },
                        reduceMotion ? null : {
                          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0.88] }),
                          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.14] }) }],
                        },
                      ]}
                    />
                    <Text style={[styles.signatureMonogram, { color: signaturePalette.ink }]}>{String(signaturePartner.name || "DA").slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.signatureBadge}>
                    <Text style={styles.signatureBadgeText}>OUVERT</Text>
                  </View>
                </View>

                <View style={styles.signaturePortalBody}>
                  <View style={styles.signatureNameRow}>
                    <Text style={styles.signatureName} numberOfLines={1}>{signaturePartner.name || "Restaurant partenaire"}</Text>
                    <View style={styles.signatureLivePill}>
                      <View style={styles.signatureLiveDot} />
                      <Text style={styles.signatureLiveText}>MAINTENANT</Text>
                    </View>
                  </View>
                  <Text style={styles.signatureMeta} numberOfLines={1}>{cityOf(signaturePartner)} · {countryOf(signaturePartner)} · {cuisineOf(signaturePartner)}</Text>
                  <Text style={styles.signatureDescription} numberOfLines={2}>{publicPartnerDescription(signaturePartner)}</Text>
                  {signatureDishes.length ? (
                    <View style={styles.signatureDishRow}>
                      {signatureDishes.map((dish) => (
                        <View key={dish} style={[styles.signatureDishChip, { borderColor: signaturePalette.accent }]}>
                          <Text style={styles.signatureDishText} numberOfLines={1}>{dish}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.signatureFooter}>
                    <Text style={styles.signatureStats} numberOfLines={1}>
                      {menuOf(signaturePartner).length} créations · {signaturePartner.delivery?.prepTimeMinutes || 25} min
                    </Text>
                    <View style={styles.signatureAction}>
                      <Text style={styles.signatureActionText}>Entrer</Text>
                      <Text style={styles.signatureActionArrow}>→</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {signaturePartners.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.signatureRail}
                accessibilityRole="tablist"
              >
                {signaturePartners.map((partner, index) => {
                  const selected = index === signatureIndex % signaturePartners.length;
                  const nodePalette = tastePaletteFor(partner);
                  return (
                    <Pressable
                      key={partner.id || partner.slug || `${partner.name}-${index}`}
                      style={({ pressed }) => [styles.signatureNode, selected && styles.signatureNodeActive, pressed && styles.pressFeedback]}
                      onPress={() => selectSignature(index)}
                      accessibilityRole="tab"
                      accessibilityLabel={`Afficher ${partner.name || "cette cuisine ouverte"}`}
                      accessibilityState={{ selected }}
                    >
                      <View style={[styles.signatureNodeMonogram, selected && styles.signatureNodeMonogramActive, selected && { backgroundColor: nodePalette.accent }]}>
                        <Text style={[styles.signatureNodeMonogramText, selected && styles.signatureNodeMonogramTextActive, selected && { color: nodePalette.ink }]}>{String(partner.name || "DA").slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={styles.signatureNodeCopy}>
                        <Text style={[styles.signatureNodeName, selected && styles.signatureNodeNameActive]} numberOfLines={1}>{partner.name || "Cuisine ouverte"}</Text>
                        <Text style={styles.signatureNodeMeta} numberOfLines={1}>{cityOf(partner)} · OUVERT</Text>
                      </View>
                      <View style={[styles.signatureNodeDot, selected && styles.signatureNodeDotActive]} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucune cuisine ouverte dans ce filtre.</Text>
            <Text style={styles.emptyText}>Les ouvertures en préparation restent visibles ci-dessous, sans être confondues avec l’offre disponible.</Text>
            <Pressable style={({ pressed }) => [styles.resetButton, pressed && styles.pressFeedback]} onPress={resetFilters} accessibilityRole="button" accessibilityLabel="Réinitialiser les filtres">
              <Text style={styles.resetText}>Voir les cuisines ouvertes</Text>
            </Pressable>
          </View>
        )}

        {openingPartners.length ? (
          <View style={styles.openingCircle}>
            <View style={styles.openingCircleHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.openingCircleKicker}>PROCHAINES SIGNATURES</Text>
                <Text style={styles.openingCircleTitle}>Elles se préparent, sans se faire passer pour ouvertes.</Text>
              </View>
              <Text style={styles.openingCircleCount}>{openingPartners.length}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.openingRail}>
              {openingPartners.map((partner, index) => {
                const nodePalette = tastePaletteFor(partner);
                return (
                  <View key={partner.id || partner.slug || `${partner.name}-opening-${index}`} style={styles.openingNode} accessibilityLabel={`${partner.name || "Cuisine"} · ${cityOf(partner)} · ouverture en préparation`}>
                    <View style={[styles.openingNodeMonogram, { backgroundColor: nodePalette.canvas, borderColor: nodePalette.accent }]}>
                      <Text style={[styles.openingNodeMonogramText, { color: nodePalette.grain }]}>{String(partner.name || "DA").slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.openingNodeCopy}>
                      <Text style={styles.openingNodeName} numberOfLines={1}>{partner.name || "Prochaine cuisine"}</Text>
                      <Text style={styles.openingNodeMeta} numberOfLines={1}>{cityOf(partner)} · EN PRÉPARATION</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {ambientSignal ? (
        <View style={styles.ambientSection}>
          <View style={styles.ambientHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ambientKicker}>À L’HORIZON</Text>
              <Text style={styles.ambientTitle}>Une adresse traverse le radar.</Text>
            </View>
            <Text style={styles.ambientCounter}>{ambientIndex % radarDisplayed.length + 1}/{radarDisplayed.length}</Text>
          </View>
          <Animated.View style={{ opacity: ambientOpacity }}>
            <Pressable
              style={({ pressed }) => [styles.ambientSignalCard, pressed && styles.pressFeedback]}
              onPress={() => openPartner(ambientSignal)}
              accessibilityRole="button"
              accessibilityLabel={`${ambientSignal.name || "Adresse"} · ${cityOf(ambientSignal)} · adresse en veille`}
              accessibilityHint="Ouvre la fiche transparente de cette adresse repérée"
            >
              <Animated.View
                style={[
                  styles.ambientOrb,
                  reduceMotion ? null : {
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.92] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.08] }) }],
                  },
                ]}
              />
              <View style={styles.ambientCopy}>
                <Text style={styles.ambientName} numberOfLines={1}>{ambientSignal.name || "Nouvelle adresse"}</Text>
                <Text style={styles.ambientMeta} numberOfLines={1}>{cityOf(ambientSignal)} · {countryOf(ambientSignal)} · {cuisineOf(ambientSignal)}</Text>
              </View>
              <View style={styles.ambientBadge}><Text style={styles.ambientBadgeText}>EN VEILLE</Text></View>
            </Pressable>
          </Animated.View>
          <Text style={styles.ambientTruth}>Signal public qualifié · validation humaine obligatoire · aucune commande ouverte.</Text>
        </View>
      ) : null}

      {!loading && liveDisplayed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{radarDisplayed.length ? "Aucun partenaire actif ici pour l’instant." : "Une nouvelle escale arrive."}</Text>
          <Text style={styles.emptyText}>{radarDisplayed.length ? `${radarDisplayed.length} adresse${radarDisplayed.length > 1 ? "s sont" : " est"} déjà en veille dans cette sélection.` : "Élargissez le pays, la ville ou la cuisine pour poursuivre votre exploration."}</Text>
          <Pressable
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressFeedback]}
            onPress={resetFilters}
            accessibilityRole="button"
            accessibilityLabel="Réinitialiser les filtres"
          ><Text style={styles.resetText}>Voir tout le réseau</Text></Pressable>
        </View>
      ) : null}

      <Text style={styles.networkWhisper}>
        {liveCount} partenaires actifs · {radarCount} signaux en veille · {countryCount} pays préparés · vérité commerciale préservée.
      </Text>
      </ScrollView>
    </AquaticSignature>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 20, paddingBottom: 68 },
  glowTop: { position: "absolute", width: 300, height: 300, borderRadius: 999, backgroundColor: "rgba(92,210,210,0.12)", right: -145, top: -145 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#D9AE68", fontSize: 11, fontWeight: "900", letterSpacing: 2.3 },
  role: { color: "rgba(255,248,234,0.50)", fontSize: 11, fontWeight: "700", marginTop: 4 },
  profileButton: { minHeight: 44, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  profileText: { color: "#FFF8EA", fontSize: 11, fontWeight: "900" },
  hero: { marginTop: 22 },
  eyebrow: { color: "#B77A4C", fontSize: 9, fontWeight: "900", letterSpacing: 2.2 },
  title: { color: "#FFF8EA", fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -1.0, marginTop: 10, maxWidth: 345 },
  subtitle: { color: "rgba(255,248,234,0.64)", fontSize: 15, lineHeight: 23, marginTop: 13, maxWidth: 350 },
  searchBox: { minHeight: 56, marginTop: 20, borderRadius: 20, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, backgroundColor: "rgba(0,0,0,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  searchIcon: { color: "#D9AE68", fontSize: 23, marginRight: 10 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 15, paddingVertical: 15 },
  signatureGateway: { position: "relative", overflow: "hidden", minHeight: 112, marginTop: 14, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(7,35,34,0.90)", borderWidth: 1, borderColor: "rgba(111,223,218,0.28)" },
  signatureGatewayGlow: { position: "absolute", width: 168, height: 168, borderRadius: 999, right: -76, top: -92, backgroundColor: "rgba(92,210,210,0.14)", borderWidth: 1, borderColor: "rgba(143,226,192,0.16)" },
  signatureGatewayCopy: { flex: 1, minWidth: 0 },
  signatureGatewayKicker: { color: "#8FE2C0", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  signatureGatewayTitle: { color: "#FFF8EA", fontSize: 18, lineHeight: 22, fontWeight: "900", marginTop: 6 },
  signatureGatewayText: { color: "rgba(255,248,234,0.56)", fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 6 },
  signatureGatewayAction: { minWidth: 72, minHeight: 44, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#D9AE68" },
  signatureGatewayActionText: { color: "#17251C", fontSize: 10, fontWeight: "900" },
  signatureGatewayArrow: { color: "#17251C", fontSize: 16, fontWeight: "900" },
  liveRibbon: { marginTop: 14, borderRadius: 26, padding: 16, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(217,174,104,0.16)", flexDirection: "row", alignItems: "center", gap: 12 },
  liveOrb: { width: 14, height: 14, borderRadius: 99, backgroundColor: "#F2B45E", shadowColor: "#F2B45E", shadowOpacity: 0.85, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  liveCopy: { flex: 1 },
  liveEyebrow: { color: "#D9AE68", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  liveTitle: { color: "#FFF8EA", fontSize: 15, fontWeight: "900", marginTop: 4 },
  liveText: { color: "rgba(255,248,234,0.50)", fontSize: 11, marginTop: 4 },
  liveAction: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(217,174,104,0.13)" },
  liveActionText: { color: "#E9C98F", fontSize: 10, fontWeight: "900" },
  ecosystemCard: { marginTop: 14, borderRadius: 28, padding: 18, backgroundColor: "#0A1D15", borderWidth: 1, borderColor: "rgba(217,174,104,0.18)" },
  ecosystemHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  ecosystemKicker: { color: "#D9AE68", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  ecosystemTitle: { color: "#FFF8EA", fontSize: 20, lineHeight: 25, fontWeight: "900", marginTop: 7 },
  ecosystemPulse: { width: 12, height: 12, borderRadius: 99, backgroundColor: "#E9C27E", shadowColor: "#E9C27E", shadowOpacity: 0.75, shadowRadius: 10 },
  ecosystemTrack: { flexDirection: "row", alignItems: "flex-start", marginTop: 20 },
  ecosystemNodeWrap: { width: 74, alignItems: "center" },
  ecosystemNode: { width: 34, height: 34, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  ecosystemNodeActive: { backgroundColor: "#E9C27E", borderColor: "#FFE4AF" },
  ecosystemNodeIndex: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "900" },
  ecosystemNodeIndexActive: { color: "#15231B" },
  ecosystemNodeLabel: { color: "#FFF8EA", fontSize: 11, fontWeight: "900", marginTop: 8, textAlign: "center" },
  ecosystemNodeDetail: { color: "rgba(255,248,234,0.47)", fontSize: 9, fontWeight: "700", marginTop: 3, textAlign: "center" },
  ecosystemLine: { flex: 1, height: 2, marginTop: 16, backgroundColor: "rgba(255,255,255,0.08)" },
  ecosystemLineActive: { backgroundColor: "rgba(233,194,126,0.68)" },
  storySurface: { marginTop: 18, borderRadius: 20, padding: 15, backgroundColor: "rgba(217,174,104,0.08)", borderWidth: 1, borderColor: "rgba(217,174,104,0.12)" },
  storyNow: { color: "#D9AE68", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  storyText: { color: "#F9EEDB", fontSize: 15, lineHeight: 22, fontWeight: "800", marginTop: 8, minHeight: 44 },
  storyDots: { flexDirection: "row", gap: 6, marginTop: 12 },
  storyDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.16)" },
  storyDotActive: { width: 18, backgroundColor: "#D9AE68" },
  horizonCard: { position: "relative", marginTop: 14, borderRadius: 28, padding: 20, overflow: "hidden", backgroundColor: "#F2E6CD" },
  horizonGlow: { position: "absolute", width: 190, height: 190, borderRadius: 999, right: -72, top: -86, backgroundColor: "rgba(180,102,53,0.18)" },
  horizonHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  horizonEyebrow: { flex: 1, color: "#7D4C2B", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  horizonState: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(23,37,28,0.08)" },
  horizonStateLive: { backgroundColor: "#163C28" },
  horizonStateText: { color: "#5D4935", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  horizonStateTextLive: { color: "#CFF8D9" },
  horizonTitle: { color: "#17251C", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 13, maxWidth: 310 },
  horizonBody: { color: "rgba(23,37,28,0.66)", fontSize: 13, lineHeight: 20, fontWeight: "700", marginTop: 9 },
  horizonRail: { height: 3, borderRadius: 99, marginTop: 18, marginRight: 112, backgroundColor: "rgba(23,37,28,0.12)", overflow: "hidden" },
  horizonSignal: { width: 44, height: 3, borderRadius: 99, backgroundColor: "#B76836" },
  horizonAxes: { flexDirection: "row", gap: 8, marginTop: 16 },
  horizonAxis: { flex: 1 },
  horizonAxisLabel: { color: "rgba(23,37,28,0.42)", fontSize: 7, fontWeight: "900", letterSpacing: 1.3 },
  horizonAxisValue: { color: "#17251C", fontSize: 12, fontWeight: "900", marginTop: 4 },
  horizonAction: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, marginTop: 17, backgroundColor: "#17251C" },
  horizonActionText: { color: "#F8EBD2", fontSize: 11, fontWeight: "900" },
  continueCard: { marginTop: 14, borderRadius: 24, padding: 18, backgroundColor: "#D9AE68", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  continueKicker: { color: "rgba(27,19,8,0.58)", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  continueTitle: { color: "#1A1207", fontSize: 19, fontWeight: "900", marginTop: 6 },
  continueText: { color: "rgba(27,19,8,0.72)", marginTop: 5, maxWidth: 270 },
  continueArrow: { color: "#1A1207", fontSize: 30, fontWeight: "600" },
  radarCard: { position: "relative", overflow: "hidden", marginTop: 16, borderRadius: 32, padding: 21, backgroundColor: "#10283A", borderWidth: 1, borderColor: "rgba(109,205,255,0.18)" },
  radarOrbit: { position: "absolute", width: 240, height: 240, borderRadius: 999, borderWidth: 1, borderColor: "rgba(109,205,255,0.12)", right: -105, top: -112 },
  radarHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  radarKicker: { color: "#82D7FF", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  radarTitle: { color: "#F4FAFF", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 8 },
  radarBeacon: { width: 14, height: 14, borderRadius: 99, backgroundColor: "#82D7FF", shadowColor: "#82D7FF", shadowOpacity: 0.85, shadowRadius: 12 },
  radarText: { color: "rgba(236,247,255,0.64)", fontSize: 13, lineHeight: 20, marginTop: 13 },
  radarStats: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 20 },
  radarValue: { color: "#F4FAFF", fontSize: 25, fontWeight: "900" },
  radarLabel: { color: "rgba(236,247,255,0.47)", fontSize: 9, lineHeight: 13, fontWeight: "800", marginTop: 4, maxWidth: 92 },
  radarTruth: { marginTop: 18, borderRadius: 16, padding: 11, backgroundColor: "rgba(130,215,255,0.08)" },
  radarTruthText: { color: "#A9E4FF", fontSize: 8, lineHeight: 13, fontWeight: "900", letterSpacing: 1.2 },
  constellationCard: { position: "relative", overflow: "hidden", marginTop: 16, borderRadius: 32, padding: 21, backgroundColor: "#0C1D29", borderWidth: 1, borderColor: "rgba(159,225,255,0.15)" },
  constellationHalo: { position: "absolute", width: 230, height: 230, borderRadius: 999, right: -112, top: -116, borderWidth: 1, borderColor: "rgba(159,225,255,0.14)", backgroundColor: "rgba(130,215,255,0.035)" },
  constellationHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  constellationKicker: { color: "#9FE1FF", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  constellationTitle: { color: "#F4FAFF", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 8, maxWidth: 315 },
  constellationSignal: { width: 14, height: 14, borderRadius: 99, backgroundColor: "#9FE1FF", shadowColor: "#9FE1FF", shadowOpacity: 0.8, shadowRadius: 12 },
  constellationLeadName: { color: "#D9AE68", fontSize: 13, fontWeight: "900", letterSpacing: 1.1, marginTop: 18 },
  constellationBridge: { color: "#F4FAFF", fontSize: 20, lineHeight: 26, fontWeight: "900", marginTop: 6 },
  constellationText: { color: "rgba(236,247,255,0.58)", fontSize: 13, lineHeight: 20, marginTop: 10 },
  constellationStats: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 20 },
  constellationValue: { color: "#F4FAFF", fontSize: 24, fontWeight: "900" },
  constellationLabel: { color: "rgba(236,247,255,0.42)", fontSize: 9, lineHeight: 13, fontWeight: "800", marginTop: 3, maxWidth: 86 },
  constellationAction: { marginTop: 18, borderRadius: 16, padding: 11, backgroundColor: "rgba(159,225,255,0.08)" },
  constellationActionText: { color: "#A9E4FF", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  signalLensCard: { position: "relative", overflow: "hidden", marginTop: 16, borderRadius: 30, padding: 20, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "rgba(217,174,104,0.17)" },
  signalLensHalo: { position: "absolute", width: 220, height: 220, borderRadius: 999, right: -120, top: -130, backgroundColor: "rgba(217,174,104,0.055)", borderWidth: 1, borderColor: "rgba(217,174,104,0.10)" },
  signalLensHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  signalLensKicker: { color: "#D9AE68", fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  signalLensTitle: { color: "#FFF8EA", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 8 },
  signalLensText: { color: "rgba(255,248,234,0.56)", fontSize: 13, lineHeight: 20, marginTop: 10 },
  signalLensPulse: { width: 12, height: 12, borderRadius: 99, backgroundColor: "#D9AE68", shadowColor: "#D9AE68", shadowOpacity: 0.8, shadowRadius: 10 },
  signalLensRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  signalLensIndex: { width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(217,174,104,0.13)" },
  signalLensIndexText: { color: "#E9C98F", fontSize: 11, fontWeight: "900" },
  signalLensRowKicker: { color: "rgba(233,201,143,0.72)", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  signalLensRowTitle: { color: "#FFF8EA", fontSize: 16, fontWeight: "900", marginTop: 4 },
  signalLensRowMeta: { color: "rgba(255,248,234,0.46)", fontSize: 11, marginTop: 4 },
  signalLensArrow: { color: "#D9AE68", fontSize: 23, fontWeight: "700" },
  signalLensTruth: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  signalLensTruthText: { color: "rgba(255,248,234,0.42)", fontSize: 9, lineHeight: 14, fontWeight: "800", letterSpacing: 0.5 },
  essentialCard: { position: "relative", overflow: "hidden", marginTop: 16, borderRadius: 32, padding: 21, backgroundColor: "#F2E6CD" },
  essentialAura: { position: "absolute", width: 230, height: 230, borderRadius: 999, right: -118, top: -132, backgroundColor: "rgba(183,104,54,0.16)" },
  essentialHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  essentialKicker: { color: "#8B5532", fontSize: 9, fontWeight: "900", letterSpacing: 1.9 },
  essentialTitle: { color: "#17251C", fontSize: 29, lineHeight: 34, fontWeight: "900", marginTop: 9, maxWidth: 305 },
  essentialPulse: { width: 14, height: 14, borderRadius: 99, backgroundColor: "#B76836", shadowColor: "#B76836", shadowOpacity: 0.55, shadowRadius: 10 },
  essentialText: { color: "rgba(23,37,28,0.66)", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 13 },
  essentialFacts: { flexDirection: "row", gap: 9, marginTop: 19 },
  essentialFact: { flex: 1, minHeight: 72, borderRadius: 19, padding: 12, backgroundColor: "rgba(23,37,28,0.055)" },
  essentialFactValue: { color: "#17251C", fontSize: 22, fontWeight: "900" },
  essentialFactLabel: { color: "rgba(23,37,28,0.52)", fontSize: 9, lineHeight: 13, fontWeight: "800", marginTop: 4 },
  essentialAction: { marginTop: 18, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#17251C", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  essentialActionText: { color: "#F8EBD2", fontSize: 13, fontWeight: "900" },
  essentialActionArrow: { color: "#F8EBD2", fontSize: 22, fontWeight: "700" },
  orderStrip: { marginTop: 12, borderRadius: 22, padding: 16, backgroundColor: "#D9AE68", flexDirection: "row", alignItems: "center", gap: 12 },
  orderStripKicker: { color: "rgba(27,19,8,0.58)", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 },
  orderStripTitle: { color: "#1A1207", fontSize: 17, fontWeight: "900", marginTop: 5 },
  orderStripText: { color: "rgba(27,19,8,0.68)", fontSize: 11, marginTop: 4 },
  orderStripArrow: { color: "#1A1207", fontSize: 27, fontWeight: "700" },
  signalDock: { display: "none", marginTop: 12, borderRadius: 26, padding: 17, backgroundColor: "#0D2118", borderWidth: 1, borderColor: "rgba(217,174,104,0.16)" },
  signalDockHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  signalDockKicker: { color: "#D9AE68", fontSize: 8, fontWeight: "900", letterSpacing: 1.7 },
  signalDockTitle: { color: "#FFF8EA", fontSize: 17, lineHeight: 22, fontWeight: "900", marginTop: 7 },
  signalDockPulseButton: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "rgba(217,174,104,0.12)" },
  signalDockPulseText: { color: "#E9C98F", fontSize: 9, fontWeight: "900" },
  signalDockGrid: { flexDirection: "row", gap: 9, marginTop: 14 },
  signalDockCell: { flex: 1, minHeight: 112, borderRadius: 19, padding: 13, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  signalDockCellKicker: { color: "rgba(233,201,143,0.70)", fontSize: 7, fontWeight: "900", letterSpacing: 1.2 },
  signalDockCellTitle: { color: "#FFF8EA", fontSize: 15, lineHeight: 19, fontWeight: "900", marginTop: 7 },
  signalDockCellMeta: { color: "rgba(255,248,234,0.46)", fontSize: 9, lineHeight: 13, marginTop: 6 },
  signalDockTruth: { color: "rgba(255,248,234,0.40)", fontSize: 8, lineHeight: 13, fontWeight: "800", marginTop: 12 },
  sectionKicker: { color: "#B77A4C", fontSize: 9, fontWeight: "900", letterSpacing: 2.1, marginTop: 26 },
  sectionTitle: { color: "#FFF8EA", fontSize: 24, fontWeight: "900", marginTop: 6, marginBottom: 12 },
  chips: { gap: 8, paddingRight: 18, paddingBottom: 4 },
  chip: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.035)" },
  chipActive: { backgroundColor: "#D9AE68", borderColor: "#D9AE68" },
  chipText: { color: "rgba(255,248,234,0.66)", fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: "#171006" },
  networkNotice: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 18, backgroundColor: "rgba(217,174,104,0.08)", borderWidth: 1, borderColor: "rgba(217,174,104,0.16)" },
  networkNoticePressed: { opacity: 0.78, transform: [{ scale: 0.995 }] },
  networkNoticeKicker: { color: "#D9AE68", fontSize: 8, fontWeight: "900", letterSpacing: 1.45 },
  networkNoticeText: { color: "rgba(255,248,234,0.58)", fontSize: 11, lineHeight: 16, marginTop: 4 },
  networkNoticeMeta: { color: "rgba(255,248,234,0.38)", fontSize: 9, lineHeight: 13, marginTop: 3, fontWeight: "800" },
  networkNoticeAction: { color: "#FFF1CD", fontSize: 11, fontWeight: "900" },
  loading: { paddingVertical: 26, alignItems: "center", gap: 10 },
  loadingText: { color: "rgba(255,255,255,0.52)" },
  signatureSection: { marginTop: 4 },
  signatureSectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  signatureKicker: { color: "#B77A4C", fontSize: 9, fontWeight: "900", letterSpacing: 2.1, marginTop: 24 },
  signatureTitle: { color: "#FFF8EA", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 7, maxWidth: 310 },
  signatureCounter: { color: "rgba(255,248,234,0.38)", fontSize: 9, fontWeight: "900", marginBottom: 4 },
  signaturePortal: { position: "relative", overflow: "hidden", borderRadius: 30, backgroundColor: "#102219", borderWidth: 1, borderColor: "rgba(217,174,104,0.20)" },
  signaturePortalAura: { position: "absolute", width: 260, height: 260, borderRadius: 999, right: -156, top: -158, backgroundColor: "rgba(217,174,104,0.055)", borderWidth: 1, borderColor: "rgba(217,174,104,0.09)" },
  signaturePortalVisual: { position: "relative", minHeight: 162, padding: 18, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tasteCanvasDeep: { position: "absolute", width: 220, height: 220, borderRadius: 999, left: -96, bottom: -142, opacity: 0.72 },
  tasteCanvasMist: { position: "absolute", width: 190, height: 190, borderRadius: 999, right: -70, top: -110 },
  tasteCanvasPlate: { width: 120, height: 120, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1.5, shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  tasteCanvasSauce: { position: "absolute", width: 62, height: 43, borderRadius: 999, transform: [{ rotate: "-18deg" }] },
  tasteCanvasGrainA: { position: "absolute", width: 22, height: 12, borderRadius: 99, left: 26, top: 26, transform: [{ rotate: "24deg" }] },
  tasteCanvasGrainB: { position: "absolute", width: 28, height: 14, borderRadius: 99, right: 20, bottom: 29, transform: [{ rotate: "-24deg" }] },
  tasteCanvasLeaf: { position: "absolute", width: 19, height: 40, borderRadius: 99, right: 24, top: 24, transform: [{ rotate: "38deg" }], opacity: 0.9 },
  tasteCanvasPulse: { position: "absolute", width: 15, height: 15, borderRadius: 999, left: 17, bottom: 24, shadowOpacity: 0.7, shadowRadius: 10 },
  signatureMonogram: { fontSize: 30, fontWeight: "900", letterSpacing: -1.5, zIndex: 2 },
  signatureBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: "rgba(7,19,14,0.66)" },
  signatureBadgeText: { color: "#F5D9A7", fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  signaturePortalBody: { padding: 18 },
  signatureNameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  signatureName: { flex: 1, color: "#FFF8EA", fontSize: 26, lineHeight: 31, fontWeight: "900" },
  signatureLivePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: "rgba(143,226,192,0.10)", borderWidth: 1, borderColor: "rgba(143,226,192,0.18)" },
  signatureLiveDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#8FE2C0", shadowColor: "#8FE2C0", shadowOpacity: 0.72, shadowRadius: 6 },
  signatureLiveText: { color: "#A8EBD0", fontSize: 7, fontWeight: "900", letterSpacing: 1.0 },
  signatureMeta: { color: "#C99864", fontSize: 12, fontWeight: "800", marginTop: 5 },
  signatureDescription: { color: "rgba(255,248,234,0.57)", fontSize: 13, lineHeight: 20, marginTop: 12 },
  signatureDishRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 },
  signatureDishChip: { maxWidth: "100%", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1 },
  signatureDishText: { color: "rgba(255,248,234,0.72)", fontSize: 9, fontWeight: "800" },
  signatureFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 },
  signatureStats: { flex: 1, color: "rgba(255,248,234,0.46)", fontSize: 10, fontWeight: "800" },
  signatureAction: { minWidth: 96, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#D9AE68" },
  signatureActionSoon: { backgroundColor: "rgba(217,174,104,0.13)" },
  signatureActionText: { color: "#1A1207", fontSize: 11, fontWeight: "900" },
  signatureActionTextSoon: { color: "rgba(233,201,143,0.62)" },
  signatureActionArrow: { color: "#1A1207", fontSize: 16, fontWeight: "900" },
  signatureRail: { gap: 9, paddingTop: 12, paddingRight: 18, paddingBottom: 4 },
  signatureNode: { width: 154, minHeight: 64, borderRadius: 20, padding: 10, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255,255,255,0.025)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  signatureNodeActive: { backgroundColor: "rgba(217,174,104,0.10)", borderColor: "rgba(217,174,104,0.32)" },
  signatureNodeMonogram: { width: 34, height: 34, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.055)" },
  signatureNodeMonogramActive: { backgroundColor: "#D9AE68" },
  signatureNodeMonogramText: { color: "rgba(255,248,234,0.62)", fontSize: 10, fontWeight: "900" },
  signatureNodeMonogramTextActive: { color: "#17251C" },
  signatureNodeCopy: { flex: 1, minWidth: 0 },
  signatureNodeName: { color: "rgba(255,248,234,0.72)", fontSize: 11, fontWeight: "900" },
  signatureNodeNameActive: { color: "#FFF8EA" },
  signatureNodeMeta: { color: "rgba(255,248,234,0.36)", fontSize: 8, fontWeight: "700", marginTop: 4 },
  signatureNodeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.13)" },
  signatureNodeDotActive: { backgroundColor: "#8FE2C0", shadowColor: "#8FE2C0", shadowOpacity: 0.72, shadowRadius: 6 },
  openingCircle: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  openingCircleHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 10 },
  openingCircleKicker: { color: "rgba(233,201,143,0.70)", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  openingCircleTitle: { color: "rgba(255,248,234,0.72)", fontSize: 14, lineHeight: 19, fontWeight: "900", marginTop: 5, maxWidth: 310 },
  openingCircleCount: { color: "rgba(255,248,234,0.34)", fontSize: 10, fontWeight: "900" },
  openingRail: { gap: 9, paddingRight: 18, paddingBottom: 4 },
  openingNode: { width: 188, minHeight: 66, borderRadius: 20, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(217,174,104,0.035)", borderWidth: 1, borderColor: "rgba(217,174,104,0.10)" },
  openingNodeMonogram: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  openingNodeMonogramText: { fontSize: 10, fontWeight: "900" },
  openingNodeCopy: { flex: 1, minWidth: 0 },
  openingNodeName: { color: "rgba(255,248,234,0.80)", fontSize: 11, fontWeight: "900" },
  openingNodeMeta: { color: "rgba(233,201,143,0.46)", fontSize: 7, fontWeight: "900", letterSpacing: 0.35, marginTop: 5 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
  count: { color: "rgba(255,248,234,0.45)", marginBottom: 14, fontSize: 11, fontWeight: "800" },
  restaurantCard: { borderRadius: 27, overflow: "hidden", marginBottom: 14, backgroundColor: "#102219", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  restaurantCardRadar: { borderColor: "rgba(130,215,255,0.16)" },
  restaurantVisual: { height: 116, padding: 18, justifyContent: "space-between", flexDirection: "row", backgroundColor: "#5E3424" },
  restaurantVisualRadar: { backgroundColor: "#19344A" },
  visualMonogram: { color: "rgba(255,242,220,0.90)", fontSize: 42, fontWeight: "900", letterSpacing: -2 },
  visualBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(7,18,14,0.60)" },
  visualBadgeRadar: { backgroundColor: "rgba(6,23,35,0.76)", borderWidth: 1, borderColor: "rgba(130,215,255,0.18)" },
  visualBadgeText: { color: "#F5D9A7", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  restaurantBody: { padding: 18 },
  restaurantTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  restaurantNameWrap: { flex: 1 },
  restaurantName: { color: "#FFF8EA", fontSize: 22, fontWeight: "900" },
  restaurantMeta: { color: "#C99864", marginTop: 5, fontWeight: "800", fontSize: 12 },
  rating: { color: "#F1C978", fontWeight: "900", fontSize: 13 },
  radarMini: { color: "#82D7FF", fontWeight: "900", fontSize: 8, letterSpacing: 1.3, marginTop: 4 },
  restaurantDescription: { color: "rgba(255,248,234,0.59)", marginTop: 12, lineHeight: 20 },
  restaurantFooter: { marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  restaurantStats: { color: "rgba(255,248,234,0.48)", fontSize: 11, fontWeight: "700", flex: 1 },
  orderPill: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "#D9AE68" },
  orderPillSoon: { backgroundColor: "rgba(217,174,104,0.15)" },
  orderPillRadar: { backgroundColor: "rgba(130,215,255,0.10)", borderWidth: 1, borderColor: "rgba(130,215,255,0.16)" },
  orderPillText: { color: "#1A1207", fontWeight: "900", fontSize: 11 },
  orderPillTextRadar: { color: "#A9E4FF", fontSize: 9 },
  ambientSection: { marginTop: 8, marginBottom: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  ambientHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 10 },
  ambientKicker: { color: "rgba(130,215,255,0.72)", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  ambientTitle: { color: "rgba(255,248,234,0.78)", fontSize: 15, fontWeight: "900", marginTop: 5 },
  ambientCounter: { color: "rgba(255,248,234,0.32)", fontSize: 9, fontWeight: "900" },
  ambientSignalCard: { minHeight: 74, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(130,215,255,0.035)", borderWidth: 1, borderColor: "rgba(130,215,255,0.12)" },
  ambientOrb: { width: 10, height: 10, borderRadius: 99, backgroundColor: "#82D7FF", shadowColor: "#82D7FF", shadowOpacity: 0.48, shadowRadius: 8 },
  ambientCopy: { flex: 1, minWidth: 0 },
  ambientName: { color: "#FFF8EA", fontSize: 15, fontWeight: "900" },
  ambientMeta: { color: "rgba(255,248,234,0.46)", fontSize: 10, fontWeight: "700", marginTop: 5 },
  ambientBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: "rgba(130,215,255,0.08)" },
  ambientBadgeText: { color: "#A9E4FF", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  ambientTruth: { color: "rgba(255,248,234,0.30)", fontSize: 8, lineHeight: 12, marginTop: 8 },
  empty: { padding: 24, borderRadius: 26, alignItems: "center", backgroundColor: "#102219" },
  emptyTitle: { color: "#FFF8EA", fontSize: 21, fontWeight: "900" },
  emptyText: { color: "rgba(255,248,234,0.58)", textAlign: "center", lineHeight: 20, marginTop: 8 },
  resetButton: { marginTop: 16, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: "#D9AE68" },
  resetText: { color: "#1A1207", fontWeight: "900" },
  networkWhisper: { marginTop: 20, color: "rgba(255,248,234,0.28)", fontSize: 8, lineHeight: 13, textAlign: "center", fontWeight: "800", letterSpacing: 0.35 },
  networkCard: { marginTop: 22, borderRadius: 30, padding: 22, backgroundColor: "#EBD7B0" },
  networkKicker: { color: "#7F4D28", fontWeight: "900", fontSize: 9, letterSpacing: 2.1 },
  networkTitle: { color: "#17251C", fontWeight: "900", fontSize: 25, lineHeight: 30, marginTop: 10 },
  networkText: { color: "rgba(23,37,28,0.68)", lineHeight: 21, marginTop: 10 },
  networkStats: { marginTop: 20, flexDirection: "row", justifyContent: "space-between", gap: 8 },
  networkValue: { color: "#17251C", fontSize: 25, fontWeight: "900" },
  networkLabel: { color: "rgba(23,37,28,0.55)", fontSize: 10, fontWeight: "800", marginTop: 3, maxWidth: 90 },
  radarLead: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 22, padding: 15, marginTop: 17, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  radarLeadKicker: { color: "#8CE6B8", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 },
  radarLeadTitle: { color: "#FFF8EA", fontSize: 17, fontWeight: "900", marginTop: 5 },
  radarLeadText: { color: "rgba(255,248,234,0.48)", fontSize: 10, fontWeight: "800", marginTop: 4 },
  radarLeadScore: { width: 60, height: 60, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "#D9AE68" },
  radarLeadScoreValue: { color: "#17251C", fontSize: 20, fontWeight: "900" },
  radarLeadScoreLabel: { color: "rgba(23,37,28,0.55)", fontSize: 8, fontWeight: "900" },

  experienceShelf: {
    display: "none",
    marginBottom: 18,
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(4,25,30,0.78)",
    borderWidth: 1,
    borderColor: "rgba(155,239,225,0.16)",
  },
  experienceShelfKicker: { color: "#9BEFE1", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  experienceShelfTitle: { color: "#FFF9EC", fontSize: 18, lineHeight: 23, fontWeight: "900", marginTop: 7 },
  experienceItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 13,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  experienceItemKicker: { color: "#F5BE67", fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
  experienceItemTitle: { color: "rgba(255,249,236,0.82)", fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 4 },
  experienceItemArrow: { color: "#9BEFE1", fontSize: 22, fontWeight: "900" },

  pressFeedback: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
