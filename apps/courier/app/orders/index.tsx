import { daOrdersFetch } from "../../utils/daOrdersApi";
import { loadCourierPresence, syncCourierPresence } from "../../utils/daPresenceStore";
// DA_A5A3A7S16R8_COURIER_MISSION_DETAIL_REPAIR_V1
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
  customer?: { name?: string; address?: string; city?: string };
  restaurantName?: string;
  restaurant?: string;
  merchantName?: string;
  deliveryAddress?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; qty?: number }>;
  assignmentProposal?: {
    status?: string;
    courierId?: string;
    courierName?: string;
  };
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

function orderId(order: Order) {
  return String(order.publicId || order.orderId || order.id || "DA-MISSION");
}
function statusOf(order: Order) {
  return String(order.status || "ready").toLowerCase();
}
function assignmentStatusOf(order: Order) {
  return String(order.assignmentProposal?.status || "").toLowerCase();
}
function assignmentAccepted(order: Order) {
  return assignmentStatusOf(order) === "accepted" && Boolean(order.assignmentProposal?.courierId);
}
function customerName(order: Order) {
  return String(order.customer?.name || order.customerName || order.clientName || "Client DelishAfrica");
}
function restaurantName(order: Order) {
  return String(order.restaurantName || order.restaurant || order.merchantName || "Restaurant partenaire");
}
function addressOf(order: Order) {
  return String(order.deliveryAddress || order.customer?.address || "Adresse de livraison");
}
function firstItem(order: Order) {
  const items = Array.isArray(order.items) ? order.items : [];
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
  if (status === "ready") return "À récupérer";
  if (status === "picked_up") return "En route";
  if (status === "delivered") return "Livrée";
  return "À venir";
}

function courierFlowIndex(status: string) {
  if (status === "delivered") return 2;
  if (status === "picked_up") return 1;
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
  const current = courierFlowIndex(status);
  const steps = ["Prendre", "Rouler", "Livrer"];
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
                  color="rgba(117,239,164,0.48)"
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
export default function CourierOrdersFocus() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("Terrain prêt.");
  const [sessionRequired, setSessionRequired] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const reduceMotion = useReduceMotionPreference();
  const statusMutationRef = useRef<string | null>(null);

  const readOrders = useCallback(async () => {
    const profile = await loadCourierPresence<Record<string, any>>();
    if (profile?.available) await syncCourierPresence(profile);
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
      setSessionRequired(false);
      setMessage(`${list.length} mission${list.length > 1 ? "s" : ""} synchronisée${list.length > 1 ? "s" : ""}.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Synchronisation indisponible";
      const needsSession = reason.includes('courier_oidc_session_required') || reason.includes('Session courier indisponible');
      setSessionRequired(needsSession);
      setMessage(needsSession ? "Compte Courier à connecter." : reason);
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

  const ready = useMemo(() => orders.filter((order) => statusOf(order) === "ready"), [orders]);
  const picked = useMemo(() => orders.filter((order) => statusOf(order) === "picked_up"), [orders]);
  const upcoming = useMemo(() => orders.filter((order) => ["pending", "accepted"].includes(statusOf(order))), [orders]);
  const history = useMemo(() => orders.filter((order) => statusOf(order) === "delivered"), [orders]);
  const missionPool = useMemo(() => [...picked, ...ready, ...upcoming], [picked, ready, upcoming]);
  const lockedMission = picked[0] || null;
  const priority = lockedMission || ready[0] || upcoming[0] || null;
  const priorityId = priority ? orderId(priority) : "";
  const focusMission = useMemo(
    () => lockedMission || missionPool.find((order) => orderId(order) === selectedMissionId) || priority,
    [lockedMission, missionPool, priority, selectedMissionId],
  );
  const focusMissionId = focusMission ? orderId(focusMission) : "";
  const lockedMissionId = lockedMission ? orderId(lockedMission) : "";
  const restaurants = useMemo(() => Array.from(new Set(missionPool.map(restaurantName))), [missionPool]);

  useEffect(() => {
    if (!missionPool.length) {
      if (selectedMissionId !== null) setSelectedMissionId(null);
      return;
    }
    if (lockedMissionId) {
      if (selectedMissionId !== lockedMissionId) setSelectedMissionId(lockedMissionId);
      return;
    }
    if (!selectedMissionId || !missionPool.some((order) => orderId(order) === selectedMissionId)) {
      setSelectedMissionId(priorityId);
    }
  }, [lockedMissionId, missionPool, priorityId, selectedMissionId]);

  async function updateStatus(order: Order, next: "picked_up" | "delivered") {
    const id = orderId(order);
    if (statusMutationRef.current) return;

    if (next === "picked_up" && !assignmentAccepted(order)) {
      setMessage("Acceptez d’abord l’offre DelishAfrica avant le retrait au restaurant.");
      return;
    }

    const mutationId = `courier:${id}:${next}:${Date.now()}`;
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
          "La mission a été relue sans le nouvel état. DelishAfrica conserve la dernière vérité confirmée.",
        );
        return;
      }

      setMessage(`${id} · ${statusLabel(next)} ${next === "delivered" ? "confirmée" : "confirmé"}.`);
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

  async function decideOffer(order: Order, decision: "accept" | "reject") {
    const id = orderId(order);
    if (statusMutationRef.current) return;
    const mutationId = `courier:${id}:offer:${decision}:${Date.now()}`;
    statusMutationRef.current = mutationId;
    setBusyId(id);
    setMessage(decision === "accept" ? "Acceptation de l’offre…" : "Refus de l’offre…");
    try {
      await postJson(`/orders/demo/courier/offers/${decision}`, { orderId: id, id });
      await readOrders();
      setMessage(decision === "accept" ? `${id} · mission acceptée.` : `${id} · offre refusée.`);
    } catch (error) {
      setMessage("Décision non confirmée · dernière vérité conservée.");
      Alert.alert("Décision impossible", error instanceof Error ? error.message : "Erreur inconnue");
      await readOrders().catch(() => undefined);
    } finally {
      if (statusMutationRef.current === mutationId) statusMutationRef.current = null;
      setBusyId(null);
    }
  }

  function MissionCard({ order, compact = false }: { order: Order; compact?: boolean }) {
    const id = orderId(order);
    const status = statusOf(order);
    const busy = busyId === id;
    const mutationBusy = busyId !== null;
    const proposalStatus = assignmentStatusOf(order);
    const accepted = assignmentAccepted(order);
    const offered = status === "ready" && proposalStatus === "proposed";
    const next = status === "ready" && accepted ? "picked_up" : status === "picked_up" ? "delivered" : null;
    const textColor = compact ? "#F3FFF7" : "#03170C";
    const mutedColor = compact ? "rgba(227,255,236,0.62)" : "rgba(3,23,12,0.62)";
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardKicker, compact && styles.cardKickerCompact]}>{status === "picked_up" ? "VERS LE CLIENT" : status === "ready" ? "VERS LE RESTAURANT" : "MISSION"}</Text>
            <Text style={[styles.cardId, { color: textColor }]}>{id}</Text>
          </View>
          <Text style={[styles.status, compact && styles.statusCompact]}>{statusLabel(status)}</Text>
        </View>
        <Text style={[styles.restaurant, { color: textColor }]}>{restaurantName(order)}</Text>
        <Text style={[styles.client, { color: mutedColor }]}>{customerName(order)}</Text>
        <Text style={[styles.address, { color: mutedColor }]}>📍 {addressOf(order)}</Text>
        <Text style={[styles.item, { color: textColor }]}>{firstItem(order)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Vérifier le contenu complet de la mission ${id}`}
          style={[styles.detailButton, compact && styles.detailButtonCompact]}
          onPress={() => router.push({ pathname: "/mission-detail" as any, params: { orderId: id } })}
        >
          <Text style={[styles.detailButtonText, compact && styles.detailButtonTextCompact]}>Voir la commande complète</Text>
          <Text style={[styles.detailButtonArrow, compact && styles.detailButtonTextCompact]}>→</Text>
        </Pressable>
        <HandoffRail status={status} compact={compact} reduceMotion={reduceMotion} />
        {status === "picked_up" || (status === "ready" && accepted) ? (
          <Pressable style={styles.mapButton} onPress={() => router.push({ pathname: "/courier-real-map" as any, params: { orderId: id } })}>
            <Text style={styles.mapButtonText}>{status === "picked_up" ? "Voir le trajet vivant" : "Voir le guidage vers le restaurant"}</Text>
          </Pressable>
        ) : null}
        {offered ? (
          <View style={styles.offerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Accepter l’offre ${id}`}
              disabled={mutationBusy}
              style={[styles.action, styles.offerAccept, mutationBusy && styles.disabled]}
              onPress={() => decideOffer(order, "accept")}
            >
              <Text style={styles.actionText}>Accepter la mission</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Refuser l’offre ${id}`}
              disabled={mutationBusy}
              style={[styles.mapButton, mutationBusy && styles.disabled]}
              onPress={() => decideOffer(order, "reject")}
            >
              <Text style={styles.mapButtonText}>Pas maintenant</Text>
            </Pressable>
          </View>
        ) : null}
        {next ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: mutationBusy, busy }}
            accessibilityLabel={next === "picked_up" ? "Commande récupérée" : "Commande remise"}
            disabled={mutationBusy}
            style={[styles.action, mutationBusy && styles.disabled]}
            onPress={() => updateStatus(order, next)}
          >
            {busy ? (
              <View style={{ alignItems: "center", gap: 4 }}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.actionText}>Écriture puis relecture</Text>
              </View>
            ) : (
              <Text style={styles.actionText}>{next === "picked_up" ? "Commande récupérée" : "Commande remise"}</Text>
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
            <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
            <Text style={styles.title}>Mission maintenant</Text>
            <Text style={styles.subtitle}>{sessionRequired ? "Identité Courier requise pour les missions" : `${Math.max(restaurants.length, 1)} restaurant${restaurants.length > 1 ? "s" : ""} · ${message}`}</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={() => router.replace("/")}><Text style={styles.closeText}>Fermer</Text></Pressable>
        </View>

        {sessionRequired ? (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionKicker}>IDENTITÉ COURIER REQUISE</Text>
            <Text style={styles.sessionTitle}>Connectez le compte Courier réel.</Text>
            <Text style={styles.sessionText}>Aucune session de secours n’est substituée à votre identité. Les missions restent protégées jusqu’à la connexion sécurisée.</Text>
            <Pressable style={styles.sessionButton} onPress={() => router.push('/auth-session' as any)}>
              <Text style={styles.sessionButtonText}>Connecter le compte Courier</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.metricRow}>
          <View style={styles.metric}><Text style={styles.metricValue}>{ready.length}</Text><Text style={styles.metricLabel}>À récupérer</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{picked.length}</Text><Text style={styles.metricLabel}>En route</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{history.length}</Text><Text style={styles.metricLabel}>Terminées</Text></View>
        </View>

        <Text style={styles.sectionKicker}>UNE MISSION À LA FOIS</Text>
        {focusMission ? <MissionCard order={focusMission} /> : <View style={styles.empty}><Text style={styles.emptyEmoji}>🛵</Text><Text style={styles.emptyTitle}>Aucune mission active</Text><Text style={styles.emptyText}>Les commandes prêtes apparaîtront ici automatiquement.</Text></View>}

        {missionPool.length > 1 ? (
          <View style={styles.orbitShell}>
            <View style={styles.orbitHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orbitKicker}>{lockedMission ? "TRAJET VERROUILLÉ" : "MISSIONS À PORTÉE"}</Text>
                <Text style={styles.orbitTitle}>
                  {lockedMission ? "Le trajet en cours reste au premier plan." : "Touchez la mission à préparer."}
                </Text>
              </View>
              <Text style={styles.orbitCount}>{missionPool.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.orbitRail}
              accessibilityRole="tablist"
            >
              {missionPool.map((order) => {
                const id = orderId(order);
                const selected = id === focusMissionId;
                const status = statusOf(order);
                const disabled = Boolean(lockedMissionId && id !== lockedMissionId);
                return (
                  <Pressable
                    key={id}
                    disabled={disabled}
                    accessibilityRole="tab"
                    accessibilityState={{ selected, disabled }}
                    accessibilityLabel={`${restaurantName(order)}, ${statusLabel(status)}, mission ${id}`}
                    onPress={() => setSelectedMissionId(id)}
                    style={({ pressed }) => [
                      styles.orbitTab,
                      selected && styles.orbitTabSelected,
                      disabled && styles.orbitTabDisabled,
                      pressed && !disabled && styles.orbitTabPressed,
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
          <View><Text style={styles.toggleKicker}>HISTORIQUE</Text><Text style={styles.toggleTitle}>{history.length} livraison{history.length > 1 ? "s" : ""} terminée{history.length > 1 ? "s" : ""}</Text></View>
          <Text style={styles.toggleIcon}>{showHistory ? "−" : "+"}</Text>
        </Pressable>
        {showHistory ? history.slice(0, 8).map((order) => <MissionCard key={orderId(order)} order={order} compact />) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#00140B" },
  page: { padding: 18, paddingBottom: 72 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 8, marginBottom: 18 },
  brand: { color: "#75EFA4", fontSize: 11, fontWeight: "900", letterSpacing: 2.6 },
  title: { color: "#F3FFF7", fontSize: 32, lineHeight: 37, fontWeight: "900", marginTop: 8 },
  subtitle: { color: "rgba(227,255,236,0.60)", fontSize: 13, lineHeight: 19, marginTop: 7, fontWeight: "700" },
  closeButton: { borderRadius: 999, backgroundColor: "rgba(117,239,164,0.10)", borderWidth: 1, borderColor: "rgba(117,239,164,0.24)", paddingHorizontal: 14, paddingVertical: 9 },
  closeText: { color: "#A8FBC5", fontSize: 12, fontWeight: "900" },
  sessionCard: { borderRadius: 24, padding: 18, marginBottom: 18, backgroundColor: "#052417", borderWidth: 1, borderColor: "rgba(117,239,164,0.28)" },
  sessionKicker: { color: "#75EFA4", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  sessionTitle: { color: "#F3FFF7", fontSize: 22, lineHeight: 28, fontWeight: "900", marginTop: 10 },
  sessionText: { color: "rgba(227,255,236,0.62)", fontSize: 14, lineHeight: 21, marginTop: 8 },
  sessionButton: { minHeight: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#75EFA4", marginTop: 15 },
  sessionButtonText: { color: "#00160D", fontSize: 15, fontWeight: "900" },
  metricRow: { flexDirection: "row", gap: 9, marginBottom: 22 },
  metric: { flex: 1, borderRadius: 18, padding: 14, backgroundColor: "#072318", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  metricValue: { color: "#F3FFF7", fontSize: 26, fontWeight: "900" },
  metricLabel: { color: "rgba(227,255,236,0.56)", fontSize: 11, fontWeight: "800", marginTop: 5 },
  sectionKicker: { color: "#75EFA4", fontSize: 10, fontWeight: "900", letterSpacing: 2.5, marginBottom: 9 },
  card: { borderRadius: 28, padding: 20, backgroundColor: "#EFFFF4", borderWidth: 1, borderColor: "#75EFA4", marginBottom: 12 },
  cardCompact: { backgroundColor: "#072318", borderColor: "rgba(255,255,255,0.06)" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardKicker: { color: "#21623B", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  cardKickerCompact: { color: "#75EFA4" },
  cardId: { fontSize: 26, fontWeight: "900", marginTop: 7 },
  status: { color: "#EFFFF4", backgroundColor: "#0B6A36", borderRadius: 999, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 8, fontSize: 11, fontWeight: "900" },
  statusCompact: { color: "#A8FBC5", backgroundColor: "rgba(117,239,164,0.10)" },
  restaurant: { fontSize: 22, fontWeight: "900", marginTop: 18 },
  client: { fontSize: 14, fontWeight: "900", marginTop: 6 },
  address: { fontSize: 14, lineHeight: 20, fontWeight: "800", marginTop: 10 },
  item: { fontSize: 16, fontWeight: "900", marginTop: 15 },
  handoffRail: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, marginBottom: 2 },
  handoffRailCompact: { opacity: 0.96 },
  handoffStep: { width: 64, alignItems: "center" },
  handoffNodeWrap: { width: 29, height: 29, alignItems: "center", justifyContent: "center" },
  flowPulse: { position: "absolute", width: 27, height: 27, borderRadius: 999 },
  handoffNode: { width: 27, height: 27, borderRadius: 99, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,23,12,0.09)", borderWidth: 1, borderColor: "rgba(3,23,12,0.14)" },
  handoffNodeActive: { backgroundColor: "#75EFA4", borderColor: "#75EFA4" },
  handoffNodeText: { color: "rgba(3,23,12,0.52)", fontSize: 11, fontWeight: "900" },
  handoffNodeTextActive: { color: "#03170C" },
  handoffLabel: { color: "rgba(3,23,12,0.54)", fontSize: 10, fontWeight: "900", marginTop: 7 },
  handoffLabelCompact: { color: "rgba(227,255,236,0.54)" },
  handoffLabelActive: { color: "#0B9C50" },
  handoffLine: { flex: 1, height: 2, backgroundColor: "rgba(3,23,12,0.10)", marginTop: 13, marginHorizontal: -7 },
  handoffLineActive: { backgroundColor: "#75EFA4" },
  mapButton: { borderRadius: 18, alignItems: "center", paddingVertical: 13, backgroundColor: "rgba(11,106,54,0.10)", borderWidth: 1, borderColor: "rgba(11,106,54,0.20)", marginTop: 16 },
  mapButtonText: { color: "#0B6A36", fontSize: 15, fontWeight: "900" },
  action: { borderRadius: 18, alignItems: "center", paddingVertical: 14, backgroundColor: "#0B9C50", marginTop: 10 },
  actionText: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  offerActions: { gap: 10, marginTop: 12 },
  offerAccept: { marginTop: 0 },
  disabled: { opacity: 0.55 },
  empty: { borderRadius: 26, padding: 22, backgroundColor: "#072318", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center", marginBottom: 12 },
  emptyEmoji: { fontSize: 34 },
  emptyTitle: { color: "#F3FFF7", fontSize: 21, fontWeight: "900", marginTop: 11 },
  emptyText: { color: "rgba(227,255,236,0.60)", textAlign: "center", lineHeight: 20, marginTop: 7 },
  orbitShell: { borderRadius: 24, padding: 16, backgroundColor: "#052016", borderWidth: 1, borderColor: "rgba(117,239,164,0.14)", marginBottom: 12 },
  orbitHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13 },
  orbitKicker: { color: "#75EFA4", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  orbitTitle: { color: "#F3FFF7", fontSize: 16, lineHeight: 21, fontWeight: "900", marginTop: 5 },
  orbitCount: { minWidth: 36, height: 36, borderRadius: 18, textAlign: "center", textAlignVertical: "center", color: "#03170C", backgroundColor: "#75EFA4", fontSize: 14, fontWeight: "900", overflow: "hidden" },
  orbitRail: { gap: 10, paddingRight: 2 },
  orbitTab: { width: 184, minHeight: 68, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#072318", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  orbitTabSelected: { backgroundColor: "#EFFFF4", borderColor: "#75EFA4" },
  orbitTabDisabled: { opacity: 0.38 },
  orbitTabPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  orbitDot: { width: 9, height: 9, borderRadius: 99, backgroundColor: "rgba(227,255,236,0.24)" },
  orbitDotSelected: { backgroundColor: "#0B9C50" },
  orbitRestaurant: { color: "#F3FFF7", fontSize: 13, fontWeight: "900" },
  orbitRestaurantSelected: { color: "#03170C" },
  orbitMeta: { color: "rgba(227,255,236,0.52)", fontSize: 10, fontWeight: "800", marginTop: 4 },
  orbitMetaSelected: { color: "rgba(3,23,12,0.58)" },
  detailButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, marginTop: 14, backgroundColor: "rgba(3,23,12,0.08)", borderWidth: 1, borderColor: "rgba(3,23,12,0.14)" },
  detailButtonCompact: { backgroundColor: "rgba(117,239,164,0.08)", borderColor: "rgba(117,239,164,0.18)" },
  detailButtonText: { color: "#06351D", fontSize: 13, fontWeight: "900" },
  detailButtonTextCompact: { color: "#75EFA4" },
  detailButtonArrow: { color: "#06351D", fontSize: 20, fontWeight: "900" },
  toggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 22, padding: 17, backgroundColor: "#062718", borderWidth: 1, borderColor: "rgba(117,239,164,0.13)", marginTop: 10, marginBottom: 9 },
  toggleKicker: { color: "#75EFA4", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  toggleTitle: { color: "#F3FFF7", fontSize: 17, fontWeight: "900", marginTop: 5 },
  toggleIcon: { color: "#75EFA4", fontSize: 26, fontWeight: "800" },
});
