import { daOrdersFetch } from "../../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

type Order = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: string;
  customerName?: string;
  clientName?: string;
  customer?: {
    name?: string;
    address?: string;
    city?: string;
    allergenFlags?: unknown[];
    dietaryTags?: unknown[];
    foodSafetyNote?: string;
  };
  allergenFlags?: unknown[];
  dietaryTags?: unknown[];
  foodSafetyNote?: string;
  safety?: {
    allergenFlags?: unknown[];
    dietaryTags?: unknown[];
    note?: string;
    requiresMerchantAcknowledgement?: boolean;
  };
  canonical?: {
    safety?: {
      allergenFlags?: unknown[];
      dietaryTags?: unknown[];
      note?: string;
      requiresMerchantAcknowledgement?: boolean;
    };
  };
  restaurantName?: string;
  restaurant?: string;
  merchantName?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; qty?: number }>;
  total?: number;
  amount?: number;
  deliveryAddress?: string;
};

type LiveLocationRead = {
  freshness?: "live" | "recent" | "stale" | "stopped" | "missing";
  ageSeconds?: number | null;
  location?: { courierName?: string; stage?: "to_restaurant" | "to_customer" } | null;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

function orderId(order: Order) {
  return String(order.publicId || order.orderId || order.id || "DA-ORDER");
}
function statusOf(order: Order) {
  return String(order.status || "pending").toLowerCase();
}
function restaurantName(order: Order) {
  return String(order.restaurantName || order.restaurant || order.merchantName || "Établissement partenaire");
}
function customerName(order: Order) {
  return String(order.customer?.name || order.customerName || order.clientName || "Client DelishAfrica");
}
function firstItem(order: Order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const item = items[0] || null;
  if (!item) return "Commande à préparer";
  const first = `${Number(item.quantity || item.qty || 1)}× ${item.name || item.title || "Plat"}`;
  const remaining = Math.max(0, items.length - 1);
  return remaining > 0 ? `${first} + ${remaining} autre${remaining > 1 ? "s" : ""}` : first;
}
function displayList(values?: unknown[]) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value || '').trim()).filter(Boolean);
}
function safetySignals(order: Order) {
  const safety = order.canonical?.safety || order.safety || {};
  const allergens = displayList(
    safety.allergenFlags || order.allergenFlags || order.customer?.allergenFlags,
  );
  const dietary = displayList(
    safety.dietaryTags || order.dietaryTags || order.customer?.dietaryTags,
  );
  const note = String(safety.note || order.foodSafetyNote || order.customer?.foodSafetyNote || '').trim();
  return {
    allergens,
    dietary,
    note,
    urgent: allergens.length > 0 || Boolean(safety.requiresMerchantAcknowledgement),
  };
}
function money(order: Order) {
  const raw = Number(order.total ?? order.amount ?? 0);
  const euros = Math.abs(raw) >= 100 ? raw / 100 : raw;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}
function extractOrders(payload: any): Order[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data?.orders)) return payload.data.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}
async function postJson(path: string, body: Record<string, unknown> = {}) {
  const response = await daOrdersFetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  return payload;
}
function statusLabel(status: string) {
  if (status === "pending") return "À accepter";
  if (status === "accepted") return "En cuisine";
  if (status === "ready") return "Prête";
  if (status === "picked_up") return "En route";
  if (status === "delivered") return "Livrée";
  return status;
}
function signalLabel(read?: LiveLocationRead) {
  if (read?.freshness === "live") return `Coursier en mouvement${read.ageSeconds ? ` · ${read.ageSeconds}s` : ""}`;
  if (read?.freshness === "recent") return `Signal récent${read.ageSeconds ? ` · ${read.ageSeconds}s` : ""}`;
  if (read?.freshness === "stale") return "Signal à rafraîchir";
  if (read?.freshness === "stopped") return "Partage arrêté";
  return "Signal coursier en attente";
}

function merchantFlowIndex(status: string) {
  if (["picked_up", "delivered"].includes(status)) return 2;
  if (["accepted", "ready"].includes(status)) return 1;
  return 0;
}

function useReduceMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
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

  return reduceMotion;
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
            outputRange: [0.32, 0],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.68],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function HandoffRail({ status, compact = false, reduceMotion = false }: { status: string; compact?: boolean; reduceMotion?: boolean }) {
  const current = merchantFlowIndex(status);
  const steps = ["Commande", "Cuisine", "Remise"];
  return (
    <View style={[styles.handoffRail, compact && styles.handoffRailCompact]}>
      {steps.map((label, index) => {
        const done = index < current || status === "delivered";
        const active = index === current && status !== "delivered";
        return (
          <React.Fragment key={label}>
            <View style={styles.handoffStep}>
              <View style={styles.handoffNodeWrap}>
                <FlowPulse
                  active={active}
                  reduceMotion={reduceMotion}
                  color="rgba(255,155,84,0.48)"
                />
                <View style={[styles.handoffNode, (done || active) && styles.handoffNodeActive]}>
                  <Text style={[styles.handoffNodeText, (done || active) && styles.handoffNodeTextActive]}>
                    {done ? "✓" : index + 1}
                  </Text>
                </View>
              </View>
              <Text style={[styles.handoffLabel, compact && styles.handoffLabelCompact, active && styles.handoffLabelActive]}>
                {label}
              </Text>
            </View>
            {index < steps.length - 1 ? <View style={[styles.handoffLine, index < current && styles.handoffLineActive]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// DA_SPRINT5_REALTIME_HANDOFF_ESSENTIAL_V1
// DA_SPRINT6_MOTION_CONTINUITY_ESSENTIAL_V1
// DA_SPRINT14_OPERATION_ORBITS_V1
// DA_SPRINT30_ACTION_COMMIT_TRUTH_V1
export default function MerchantOrdersFocus() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("Cockpit prêt.");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocationRead>>({});
  const reduceMotion = useReduceMotionPreference();
  const statusMutationRef = useRef<string | null>(null);

  const readOrders = useCallback(async () => {
    const payload = await postJson("/orders/demo/list", {});
    const list = extractOrders(payload);
    setOrders(list);
    return list;
  }, []);

  const load = useCallback(async () => {
    if (statusMutationRef.current) return;
    setRefreshing(true);
    try {
      const list = await readOrders();
      setMessage(`${list.length} commande${list.length > 1 ? "s" : ""} synchronisée${list.length > 1 ? "s" : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Synchronisation indisponible");
    } finally {
      setRefreshing(false);
    }
  }, [readOrders]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!statusMutationRef.current) void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const active = useMemo(
    () => orders.filter((order) => ["pending", "accepted", "ready", "picked_up"].includes(statusOf(order))),
    [orders],
  );
  const history = useMemo(
    () => orders.filter((order) => ["delivered", "cancelled", "canceled"].includes(statusOf(order))),
    [orders],
  );
  const priority = useMemo(() => {
    const score: Record<string, number> = { pending: 0, accepted: 1, ready: 2, picked_up: 3 };
    return [...active].sort((a, b) => (score[statusOf(a)] ?? 9) - (score[statusOf(b)] ?? 9))[0] || null;
  }, [active]);
  const priorityId = priority ? orderId(priority) : "";
  const focusOrder = useMemo(
    () => active.find((order) => orderId(order) === selectedOrderId) || priority,
    [active, priority, selectedOrderId],
  );
  const focusOrderId = focusOrder ? orderId(focusOrder) : "";
  const restaurants = useMemo(() => Array.from(new Set(active.map(restaurantName))), [active]);

  useEffect(() => {
    if (!active.length) {
      if (selectedOrderId !== null) setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !active.some((order) => orderId(order) === selectedOrderId)) {
      setSelectedOrderId(priorityId);
    }
  }, [active, priorityId, selectedOrderId]);

  useEffect(() => {
    let cancelled = false;
    const candidates = active.filter((order) => ["ready", "picked_up"].includes(statusOf(order)));
    async function refreshSignals() {
      if (!candidates.length) {
        if (!cancelled) setLiveLocations({});
        return;
      }
      const rows = await Promise.all(
        candidates.map(async (order) => {
          const id = orderId(order);
          try {
            const payload = await postJson("/orders/demo/location/get", { orderId: id });
            return [id, payload as LiveLocationRead] as const;
          } catch {
            return [id, { freshness: "missing", location: null } as LiveLocationRead] as const;
          }
        }),
      );
      if (!cancelled) setLiveLocations(Object.fromEntries(rows));
    }
    void refreshSignals();
    const timer = setInterval(() => void refreshSignals(), 6000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  async function updateStatus(order: Order, next: "accepted" | "ready") {
    const id = orderId(order);
    if (statusMutationRef.current) return;

    const mutationId = `merchant:${id}:${next}:${Date.now()}`;
    statusMutationRef.current = mutationId;
    setBusyId(id);
    setMessage("Confirmation en cours · écriture puis relecture.");

    try {
      await postJson("/orders/demo/status", {
        orderId: id,
        id,
        status: next,
        clientMutationId: mutationId,
      });

      let confirmedStatus = "missing";
      for (const waitMs of [0, 350, 900]) {
        if (waitMs > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
        }
        const confirmedOrders = await readOrders();
        const confirmedOrder = confirmedOrders.find((candidate) => orderId(candidate) === id);
        confirmedStatus = confirmedOrder ? statusOf(confirmedOrder) : "missing";
        if (confirmedStatus === next) break;
      }

      if (confirmedStatus !== next) {
        setMessage("État non confirmé · dernière vérité restaurée.");
        Alert.alert(
          "Confirmation incomplète",
          "La commande a été relue sans le nouvel état. DelishAfrica conserve la dernière vérité confirmée.",
        );
        return;
      }

      setMessage(`${id} · ${statusLabel(next)} confirmé.`);
    } catch (error) {
      setMessage("Action non confirmée · dernière vérité conservée.");
      Alert.alert("Action impossible", error instanceof Error ? error.message : "Erreur inconnue");
      try {
        await readOrders();
      } catch {
        // La dernière liste déjà affichée reste la seule vérité disponible.
      }
    } finally {
      if (statusMutationRef.current === mutationId) statusMutationRef.current = null;
      setBusyId(null);
    }
  }

  const openOrderDetail = useCallback((order: Order) => {
    const id = orderId(order);
    router.push({ pathname: "/commande/[id]", params: { id } } as any);
  }, []);

  function OrderCard({ order, compact = false }: { order: Order; compact?: boolean }) {
    const id = orderId(order);
    const status = statusOf(order);
    const busy = busyId === id;
    const mutationBusy = busyId !== null;
    const next = status === "pending" ? "accepted" : status === "accepted" ? "ready" : null;
    const textColor = compact ? "#FFF8F1" : "#1E0C05";
    const mutedColor = compact ? "rgba(255,248,241,0.62)" : "rgba(30,12,5,0.62)";
    const safety = safetySignals(order);
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ouvrir la fiche complète de la commande ${id}`}
          accessibilityHint="Affiche tous les articles, le client, la livraison, le paiement et la chronologie"
          onPress={() => openOrderDetail(order)}
          style={({ pressed }) => [styles.cardDetailPress, pressed && styles.cardDetailPressed]}
        >
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardId, { color: textColor }]}>{id}</Text>
              <Text style={[styles.cardRestaurant, { color: mutedColor }]}>{restaurantName(order)}</Text>
            </View>
            <Text style={[styles.status, compact && styles.statusCompact]}>{statusLabel(status)}</Text>
          </View>
          <Text style={[styles.cardItem, { color: textColor }]}>{firstItem(order)}</Text>
          <Text style={[styles.cardMeta, { color: mutedColor }]}>{customerName(order)} · {money(order)}</Text>
          {safety.urgent || safety.dietary.length > 0 || safety.note ? (
            <View style={[styles.foodSafetySignal, compact && styles.foodSafetySignalCompact]}>
              <Text style={[styles.foodSafetySignalTitle, compact && styles.foodSafetySignalTitleCompact]}>
                {safety.urgent ? "⚠ Signal cuisine prioritaire" : "Préférences client"}
              </Text>
              {safety.allergens.length > 0 ? (
                <Text style={[styles.foodSafetySignalText, compact && styles.foodSafetySignalTextCompact]}>
                  Allergènes : {safety.allergens.join(" · ")}
                </Text>
              ) : null}
              {safety.dietary.length > 0 ? (
                <Text style={[styles.foodSafetySignalText, compact && styles.foodSafetySignalTextCompact]}>
                  {safety.dietary.join(" · ")}
                </Text>
              ) : null}
            </View>
          ) : null}
          <HandoffRail status={status} compact={compact} reduceMotion={reduceMotion} />
          {["ready", "picked_up"].includes(status) ? (
            <View style={[styles.signalRow, compact && styles.signalRowCompact]}>
              <View style={[styles.signalDot, ["live", "recent"].includes(String(liveLocations[id]?.freshness)) && styles.signalDotLive]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.signalTitle, compact && styles.signalTitleCompact]}>{signalLabel(liveLocations[id])}</Text>
                <Text style={[styles.signalMeta, compact && styles.signalMetaCompact]}>{liveLocations[id]?.location?.courierName || "Mission Live"}</Text>
              </View>
            </View>
          ) : null}
          <View style={[styles.detailCue, compact && styles.detailCueCompact]}>
            <Text style={[styles.detailCueText, compact && styles.detailCueTextCompact]}>Voir la commande complète</Text>
            <Text style={[styles.detailCueArrow, compact && styles.detailCueTextCompact]}>›</Text>
          </View>
        </Pressable>
        {next ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: mutationBusy, busy }}
            accessibilityLabel={next === "accepted" ? "Lancer la cuisine" : "Remettre au coursier"}
            disabled={mutationBusy}
            style={[styles.action, mutationBusy && styles.disabled]}
            onPress={() => updateStatus(order, next)}
          >
            {busy ? (
              <View style={{ alignItems: "center", gap: 4 }}>
                <ActivityIndicator color="#1A0A04" />
                <Text style={styles.actionText}>Écriture puis relecture</Text>
              </View>
            ) : (
              <Text style={styles.actionText}>{next === "accepted" ? "Lancer la cuisine" : "Remettre au coursier"}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>DELISHAFRICA® · MERCHANT</Text>
            <Text style={styles.title}>Service maintenant</Text>
            <Text style={styles.subtitle}>{Math.max(restaurants.length, 1)} établissement{restaurants.length > 1 ? "s" : ""} · {message}</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={() => router.replace("/")}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metric}><Text style={styles.metricValue}>{orders.filter((o) => statusOf(o) === "pending").length}</Text><Text style={styles.metricLabel}>À accepter</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{orders.filter((o) => statusOf(o) === "accepted").length}</Text><Text style={styles.metricLabel}>Cuisine</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{orders.filter((o) => statusOf(o) === "ready").length}</Text><Text style={styles.metricLabel}>Prêtes</Text></View>
        </View>

        <Text style={styles.sectionKicker}>UNE PRIORITÉ À LA FOIS</Text>
        {focusOrder ? <OrderCard order={focusOrder} /> : <View style={styles.empty}><Text style={styles.emptyTitle}>Aucune action urgente</Text><Text style={styles.emptyText}>Le service est calme. Les nouvelles commandes apparaîtront ici.</Text></View>}

        {active.length > 1 ? (
          <View style={styles.orbitShell}>
            <View style={styles.orbitHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orbitKicker}>SERVICE EN MOUVEMENT</Text>
                <Text style={styles.orbitTitle}>Touchez la prochaine commande.</Text>
              </View>
              <Text style={styles.orbitCount}>{active.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.orbitRail}
              accessibilityRole="tablist"
            >
              {active.map((order) => {
                const id = orderId(order);
                const selected = id === focusOrderId;
                const status = statusOf(order);
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${restaurantName(order)}, ${statusLabel(status)}, commande ${id}`}
                    onPress={() => setSelectedOrderId(id)}
                    style={({ pressed }) => [
                      styles.orbitTab,
                      selected && styles.orbitTabSelected,
                      pressed && styles.orbitTabPressed,
                    ]}
                  >
                    <View style={[styles.orbitDot, selected && styles.orbitDotSelected]} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[styles.orbitRestaurant, selected && styles.orbitRestaurantSelected]}>
                        {restaurantName(order)}
                      </Text>
                      <Text numberOfLines={1} style={[styles.orbitMeta, selected && styles.orbitMetaSelected]}>
                        {statusLabel(status)} · {id.slice(-8)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Pressable style={styles.toggle} onPress={() => setShowHistory((value) => !value)}>
          <View><Text style={styles.toggleKicker}>HISTORIQUE</Text><Text style={styles.toggleTitle}>{history.length} commande{history.length > 1 ? "s" : ""} clôturée{history.length > 1 ? "s" : ""}</Text></View>
          <Text style={styles.toggleIcon}>{showHistory ? "−" : "+"}</Text>
        </Pressable>
        {showHistory ? history.slice(0, 8).map((order) => <OrderCard key={orderId(order)} order={order} compact />) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#120804" },
  page: { padding: 18, paddingBottom: 72 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 8, marginBottom: 18 },
  brand: { color: "#FFB86B", fontSize: 11, fontWeight: "900", letterSpacing: 2.6 },
  title: { color: "#FFF8F1", fontSize: 32, lineHeight: 37, fontWeight: "900", marginTop: 8 },
  subtitle: { color: "rgba(255,248,241,0.60)", fontSize: 13, lineHeight: 19, marginTop: 7, fontWeight: "700" },
  closeButton: { borderRadius: 999, backgroundColor: "rgba(255,184,107,0.12)", borderWidth: 1, borderColor: "rgba(255,184,107,0.24)", paddingHorizontal: 14, paddingVertical: 9 },
  closeText: { color: "#FFC98F", fontSize: 12, fontWeight: "900" },
  metricRow: { flexDirection: "row", gap: 9, marginBottom: 22 },
  metric: { flex: 1, borderRadius: 18, padding: 14, backgroundColor: "#251109", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  metricValue: { color: "#FFF8F1", fontSize: 26, fontWeight: "900" },
  metricLabel: { color: "rgba(255,248,241,0.56)", fontSize: 11, fontWeight: "800", marginTop: 5 },
  sectionKicker: { color: "#FFB86B", fontSize: 10, fontWeight: "900", letterSpacing: 2.5, marginBottom: 9 },
  card: { borderRadius: 28, padding: 20, backgroundColor: "#FFF1E4", borderWidth: 1, borderColor: "#FFB86B", marginBottom: 12 },
  cardCompact: { backgroundColor: "#241109", borderColor: "rgba(255,255,255,0.07)" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardId: { fontSize: 24, fontWeight: "900" },
  cardRestaurant: { fontSize: 13, fontWeight: "800", marginTop: 5 },
  status: { color: "#1E0C05", backgroundColor: "rgba(255,130,50,0.16)", borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 8, fontSize: 11, fontWeight: "900" },
  statusCompact: { color: "#FFD6B6", backgroundColor: "rgba(255,184,107,0.12)" },
  cardItem: { fontSize: 18, lineHeight: 24, fontWeight: "900", marginTop: 18 },
  cardMeta: { fontSize: 13, fontWeight: "800", marginTop: 8 },
  cardDetailPress: { borderRadius: 20 },
  cardDetailPressed: { opacity: 0.88, transform: [{ scale: 0.994 }] },
  detailCue: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(30,12,5,0.10)" },
  detailCueCompact: { borderTopColor: "rgba(255,248,241,0.10)" },
  detailCueText: { color: "#9A3F0C", fontSize: 13, fontWeight: "900" },
  detailCueTextCompact: { color: "#FFC98F" },
  detailCueArrow: { color: "#9A3F0C", fontSize: 24, lineHeight: 24, fontWeight: "900" },
  foodSafetySignal: { borderRadius: 16, padding: 12, backgroundColor: "rgba(166,62,24,0.10)", borderWidth: 1, borderColor: "rgba(166,62,24,0.18)", marginTop: 14 },
  foodSafetySignalCompact: { backgroundColor: "rgba(255,184,107,0.08)", borderColor: "rgba(255,184,107,0.16)" },
  foodSafetySignalTitle: { color: "#8B3216", fontSize: 12, fontWeight: "900" },
  foodSafetySignalTitleCompact: { color: "#FFC98F" },
  foodSafetySignalText: { color: "rgba(89,37,18,0.72)", fontSize: 11, lineHeight: 17, fontWeight: "800", marginTop: 4 },
  foodSafetySignalTextCompact: { color: "rgba(255,248,241,0.68)" },
  handoffRail: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, marginBottom: 2 },
  handoffRailCompact: { opacity: 0.96 },
  handoffStep: { width: 66, alignItems: "center" },
  handoffNodeWrap: { width: 29, height: 29, alignItems: "center", justifyContent: "center" },
  flowPulse: { position: "absolute", width: 27, height: 27, borderRadius: 999 },
  handoffNode: { width: 27, height: 27, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(30,12,5,0.09)", borderWidth: 1, borderColor: "rgba(30,12,5,0.14)" },
  handoffNodeActive: { backgroundColor: "#FF9B54", borderColor: "#FF9B54" },
  handoffNodeText: { color: "rgba(30,12,5,0.52)", fontSize: 11, fontWeight: "900" },
  handoffNodeTextActive: { color: "#1A0A04" },
  handoffLabel: { color: "rgba(30,12,5,0.54)", fontSize: 10, fontWeight: "900", marginTop: 7 },
  handoffLabelCompact: { color: "rgba(255,248,241,0.54)" },
  handoffLabelActive: { color: "#FF9B54" },
  handoffLine: { flex: 1, height: 2, backgroundColor: "rgba(30,12,5,0.10)", marginTop: 13, marginHorizontal: -8 },
  handoffLineActive: { backgroundColor: "#FF9B54" },
  signalRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, padding: 12, backgroundColor: "rgba(18,94,55,0.08)", marginTop: 15 },
  signalRowCompact: { backgroundColor: "rgba(94,230,151,0.07)" },
  signalDot: { width: 9, height: 9, borderRadius: 99, backgroundColor: "#9A8B82" },
  signalDotLive: { backgroundColor: "#19B867" },
  signalTitle: { color: "#174C32", fontSize: 13, fontWeight: "900" },
  signalTitleCompact: { color: "#B8F5CE" },
  signalMeta: { color: "rgba(23,76,50,0.62)", fontSize: 11, marginTop: 3, fontWeight: "700" },
  signalMetaCompact: { color: "rgba(184,245,206,0.60)" },
  action: { borderRadius: 18, alignItems: "center", paddingVertical: 14, backgroundColor: "#FF9B54", marginTop: 18 },
  actionText: { color: "#1A0A04", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  empty: { borderRadius: 26, padding: 20, backgroundColor: "#241109", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 12 },
  emptyTitle: { color: "#FFF8F1", fontSize: 20, fontWeight: "900" },
  emptyText: { color: "rgba(255,248,241,0.60)", marginTop: 7, lineHeight: 20 },
  orbitShell: { borderRadius: 24, padding: 16, backgroundColor: "#1B0D07", borderWidth: 1, borderColor: "rgba(255,184,107,0.14)", marginBottom: 12 },
  orbitHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13 },
  orbitKicker: { color: "#FFB86B", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  orbitTitle: { color: "#FFF8F1", fontSize: 16, lineHeight: 21, fontWeight: "900", marginTop: 5 },
  orbitCount: { minWidth: 36, height: 36, borderRadius: 18, textAlign: "center", textAlignVertical: "center", color: "#1A0A04", backgroundColor: "#FFB86B", fontSize: 14, fontWeight: "900", overflow: "hidden" },
  orbitRail: { gap: 10, paddingRight: 2 },
  orbitTab: { width: 184, minHeight: 68, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#241109", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  orbitTabSelected: { backgroundColor: "#FFF1E4", borderColor: "#FFB86B" },
  orbitTabPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  orbitDot: { width: 9, height: 9, borderRadius: 99, backgroundColor: "rgba(255,248,241,0.24)" },
  orbitDotSelected: { backgroundColor: "#FF9B54" },
  orbitRestaurant: { color: "#FFF8F1", fontSize: 13, fontWeight: "900" },
  orbitRestaurantSelected: { color: "#1E0C05" },
  orbitMeta: { color: "rgba(255,248,241,0.52)", fontSize: 10, fontWeight: "800", marginTop: 4 },
  orbitMetaSelected: { color: "rgba(30,12,5,0.58)" },
  toggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 22, padding: 17, backgroundColor: "#211008", borderWidth: 1, borderColor: "rgba(255,184,107,0.13)", marginTop: 10, marginBottom: 9 },
  toggleKicker: { color: "#FFB86B", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  toggleTitle: { color: "#FFF8F1", fontSize: 17, fontWeight: "900", marginTop: 5 },
  toggleIcon: { color: "#FFB86B", fontSize: 26, fontWeight: "800" },
});
