import { daOrdersFetch } from "../utils/daOrdersApi";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

declare const process: {
  env?: Record<string, string | undefined>;
};

type DemoOrder = {
  id?: string;
  orderId?: string;
  status?: string;
  restaurant?: unknown;
  restaurantName?: string;
  customer?: unknown;
  customerName?: string;
  deliveryAddress?: string;
  address?: string;
  total?: number | string;
  totalAmount?: number | string;
  currency?: string;
  items?: unknown[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

const ENV = typeof process !== "undefined" && process.env ? process.env : {};

const API_BASE_URL = normalizeApiBase(
  ENV.EXPO_PUBLIC_API_BASE_URL ||
    ENV.EXPO_PUBLIC_API_URL ||
    "https://api.delishafrica.me/api/v1"
);

const STEPS = [
  { key: "pending", label: "Envoyée", detail: "Le restaurant doit accepter." },
  { key: "accepted", label: "Acceptée", detail: "La cuisine prépare." },
  { key: "ready", label: "Prête", detail: "Le coursier peut récupérer." },
  { key: "picked_up", label: "En route", detail: "La livraison est en cours." },
  { key: "delivered", label: "Livrée", detail: "Commande terminée." },
];

function normalizeApiBase(value: string) {
  let base = String(value || "https://api.delishafrica.me/api/v1").trim();
  base = base.replace(/\/+$/, "");
  if (!base.endsWith("/api/v1")) {
    if (base.endsWith("/api")) base = `${base}/v1`;
    else base = `${base}/api/v1`;
  }
  return base;
}

function safeText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.fullName === "string") return obj.fullName;
    if (typeof obj.label === "string") return obj.label;
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function orderKey(order: DemoOrder) {
  return safeText(order.orderId || order.id, "unknown");
}

function shortOrderId(order: DemoOrder) {
  const id = orderKey(order);
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}…${id.slice(-5)}`;
}

function statusOf(order?: DemoOrder) {
  return safeText(order?.status, "pending").toLowerCase();
}

function statusLabel(status: string) {
  if (status === "pending") return "En attente";
  if (status === "accepted") return "Acceptée";
  if (status === "ready") return "Prête";
  if (status === "picked_up") return "En route";
  if (status === "delivered") return "Livrée";
  return status.toUpperCase();
}

function stepIndex(status: string) {
  const idx = STEPS.findIndex((step) => step.key === status);
  return idx >= 0 ? idx : 0;
}

function pickOrders(payload: unknown): DemoOrder[] {
  if (Array.isArray(payload)) return payload as DemoOrder[];

  const obj = payload as Record<string, unknown>;
  const candidates = [
    obj?.orders,
    obj?.data,
    obj?.items,
    obj?.results,
    obj?.list,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as DemoOrder[];
  }

  return [];
}

async function postJson(path: string, body: Record<string, unknown> = {}) {
  const res = await daOrdersFetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const message =
      typeof json === "object" && json && "message" in json
        ? safeText((json as Record<string, unknown>).message, `HTTP ${res.status}`)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return json;
}


function isActiveOrderForClient(order?: DemoOrder): boolean {
const s = statusOf(order);
return !!order && s !== "delivered" && s !== "completed" && s !== "cancelled";
}

function orderTimestampForClient(order?: DemoOrder): number {
if (!order) return 0;

const anyOrder = order as any;
const candidates = [
anyOrder.updatedAt,
anyOrder.createdAt,
anyOrder.paidAt,
anyOrder.acceptedAt,
anyOrder.readyAt,
anyOrder.pickedUpAt,
anyOrder.deliveredAt,
];

for (const value of candidates) {
const t = Date.parse(String(value || ""));
if (Number.isFinite(t)) return t;
}

const id = String(anyOrder.orderId || anyOrder.publicId || anyOrder.id || "");
const compact = id.replace(/[^0-9]/g, "");
return compact ? Number(compact.slice(-10)) : 0;
}

function sortOrdersForClient(orders: DemoOrder[]): DemoOrder[] {
return [...orders].sort((a, b) => {
const activeDelta = Number(isActiveOrderForClient(b)) - Number(isActiveOrderForClient(a));
if (activeDelta !== 0) return activeDelta;
return orderTimestampForClient(b) - orderTimestampForClient(a);
});
}

function pickLatestActive(orders: DemoOrder[]) {
  const active = orders.filter((order) => statusOf(order) !== "delivered");
  if (active.length > 0) return active[active.length - 1];
  if (orders.length > 0) return orders[orders.length - 1];
  return undefined;
}

function money(order: DemoOrder) {
  const raw =
    order.total ??
    order.totalAmount ??
    order.amount ??
    order.amountCents ??
    order.totalCents ??
    order.subtotal ??
    order.basketTotal;

  if (raw === null || raw === undefined || raw === "") {
    return "—";
  }

  const rawText = String(raw).trim();

  const numericText = rawText
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const numeric = Number(numericText);

  if (!Number.isFinite(numeric)) {
    return rawText;
  }

  const looksLikeCents =
    Number.isInteger(numeric) &&
    Math.abs(numeric) >= 100 &&
    !rawText.includes(",") &&
    !rawText.includes(".");

  const euros = looksLikeCents ? numeric / 100 : numeric;

  try {
    return new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(euros);
  } catch {
    return euros.toFixed(2).replace(".", ",") + " €";
  }
}

function Timeline({ order }: { order: DemoOrder }) {
  const current = stepIndex(statusOf(order));

  return (
    <View style={styles.timeline}>
      {STEPS.map((step, index) => {
        const done = index <= current;
        const currentStep = index === current;

        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={[styles.stepDot, done ? styles.stepDotDone : null]}>
              <Text style={styles.stepDotText}>{done ? "✓" : ""}</Text>
            </View>

            <View style={[styles.stepBody, currentStep ? styles.stepBodyCurrent : null]}>
              <Text style={[styles.stepTitle, done ? styles.stepTitleDone : null]}>
                {step.label}
              </Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ItemsList({ order }: { order: DemoOrder }) {
  const items = Array.isArray(order.items) ? order.items : [];

  if (!items.length) {
    return <Text style={styles.muted}>Aucun détail panier reçu.</Text>;
  }

  return (
    <View style={styles.itemsBox}>
      {items.map((item, index) => (
        <Text key={`${index}`} style={styles.itemText}>
          • {safeText(item, "Plat")}
        </Text>
      ))}
    </View>
  );
}

export default function OrderTrackingScreen() {
 const insets = useSafeAreaInsets();
  const router = useRouter();
  const [orders, setOrders] = React.useState<DemoOrder[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedOrder = React.useMemo(() => {
    if (!orders.length) return undefined;
    const found = selectedKey ? orders.find((order) => orderKey(order) === selectedKey) : undefined;
    return found || pickLatestActive(orders);
  }, [orders, selectedKey]);

  const loadOrders = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const json = await postJson("/orders/demo/list", {});
      const nextOrders = pickOrders(json);
      setOrders(nextOrders);

      const preferred = pickLatestActive(nextOrders);
      if (preferred) {
        setSelectedKey((current) => {
          const stillExists = current && nextOrders.some((order) => orderKey(order) === current);
          return stillExists ? current : orderKey(preferred);
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadOrders();
    }, [loadOrders])
  );

  const status = statusOf(selectedOrder);
  const activeCount = orders.filter((order) => statusOf(order) !== "delivered").length;
  const recentOrders = sortOrdersForClient(orders).slice(0, 5);

  return (
    <SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 14, 54) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadOrders}
            tintColor="#75adff"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.brand}>DELISHAFRICA® · CLIENT</Text>
          <Text style={styles.title}>Suivi live</Text>
          <Text style={styles.subtitle}>
            Retrouvez votre commande en cours et suivez chaque étape en direct.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Connexion sécurisée</Text>
            <Text style={styles.apiText}>Service DelishAfrica® synchronisé</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{orders.length}</Text>
              <Text style={styles.statLabel}>commandes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{activeCount}</Text>
              <Text style={styles.statLabel}>en cours</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity activeOpacity={0.86} style={styles.refreshButton} onPress={loadOrders}>
          <Text style={styles.refreshText}>
            {loading ? "Actualisation..." : "Actualiser le suivi"}
          </Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Suivi momentanément indisponible</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !selectedOrder ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator color="#75adff" />
            <Text style={styles.emptyText}>Synchronisation du suivi...</Text>
          </View>
        ) : null}

        {!selectedOrder && !loading ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aucune commande en cours</Text>
            <Text style={styles.emptyText}>
              Lancez une commande depuis un restaurant partenaire pour suivre chaque étape ici.
            </Text>

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.primaryButton}
              onPress={() => router.push("/checkout-preflight" as never)}
            >
              <Text style={styles.primaryButtonText}>Commander</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedOrder ? (
          <>
            <View style={styles.orderCard}>
              <View style={styles.orderTop}>
                <View>
                  <Text style={styles.cardLabel}>VOTRE COMMANDE</Text>
                  <Text style={styles.orderTitle}>{shortOrderId(selectedOrder)}</Text>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{statusLabel(status)}</Text>
                </View>
              </View>

              <Text style={styles.fullId}>{orderKey(selectedOrder)}</Text>

              <View style={styles.infoGrid}>
                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Restaurant</Text>
                  <Text style={styles.infoValue}>
                    {safeText(selectedOrder.restaurantName || selectedOrder.restaurant, "Thieyp")}
                  </Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Client</Text>
                  <Text style={styles.infoValue}>
                    {safeText(selectedOrder.customerName || selectedOrder.customer, "Client DelishAfrica®")}
                  </Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Total</Text>
                  <Text style={styles.infoValue}>{money(selectedOrder)}</Text>
                </View>
              </View>

              <Text style={styles.blockTitle}>Panier</Text>
              <ItemsList order={selectedOrder} />

              <Text style={styles.blockTitle}>Étapes de livraison</Text>
              <Timeline order={selectedOrder} />
            </View>

            {recentOrders.length > 1 ? (
              <View style={styles.recentCard}>
                <Text style={styles.recentTitle}>Commandes récentes</Text>
                <Text style={styles.recentSubtitle}>
                  Touchez une commande pour afficher son suivi.
                </Text>

                {recentOrders.map((order) => {
                  const key = orderKey(order);
                  const selected = key === orderKey(selectedOrder);

                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.86}
                      style={[styles.recentRow, selected ? styles.recentRowSelected : null]}
                      onPress={() => setSelectedKey(key)}
                    >
                      <View>
                        <Text style={styles.recentId}>{shortOrderId(order)}</Text>
                        <Text style={styles.recentFull}>{statusLabel(statusOf(order))}</Text>
                      </View>
                      <Text style={styles.recentArrow}>{selected ? "✓" : "→"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.secondaryButton}
          onPress={() => router.push("/checkout-preflight" as never)}
        >
          <Text style={styles.secondaryButtonText}>Commander à nouveau</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const COLORS = {
  bg: "#06111f",
  panel: "#101b2d",
  panel2: "#16243b",
  panel3: "#1d2d49",
  blue: "#3f83f8",
  blue2: "#75adff",
  text: "#f7fbff",
  muted: "#b6c5dc",
  line: "rgba(255,255,255,0.14)",
  green: "#33d17a",
  red: "#ff6b6b",
};

const styles = StyleSheet.create({
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(98, 202, 255, 0.020)", borderWidth: 1, borderColor: "rgba(220, 245, 255, 0.050)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(218, 246, 255, 0.038)" },
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(88, 211, 255, 0.020)", borderWidth: 1, borderColor: "rgba(200, 242, 255, 0.050)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 242, 255, 0.040)" },
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
paddingHorizontal: 22,
paddingTop: 0,
paddingBottom: 72,
},
  header: {
    marginBottom: 22,
  },
  brand: {
    color: COLORS.blue2,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 7,
    marginBottom: 18,
  },
  title: {
    color: COLORS.text,
    fontSize: 38,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.3,
    marginBottom: 10,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },
  summaryCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.line,
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    marginBottom: 14,
  },
  summaryLabel: {
    color: COLORS.blue2,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 7,
  },
  apiText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.panel2,
    borderRadius: 18,
    padding: 14,
  },
  statNumber: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "900",
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  refreshButton: {
    borderColor: COLORS.blue2,
    borderWidth: 1.5,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  refreshText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  errorBox: {
    backgroundColor: "rgba(255,107,107,0.12)",
    borderColor: "rgba(255,107,107,0.42)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 6,
  },
  errorText: {
    color: COLORS.red,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  emptyBox: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.line,
    borderWidth: 1,
    borderRadius: 26,
    padding: 20,
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: 10,
  },
  orderCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.line,
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },
  cardLabel: {
    color: COLORS.blue2,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 8,
  },
  orderTitle: {
    color: COLORS.text,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "900",
    marginBottom: 6,
  },
  fullId: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  statusPill: {
    backgroundColor: "rgba(63,131,248,0.18)",
    borderColor: "rgba(117,173,255,0.48)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  statusText: {
    color: COLORS.blue2,
    fontSize: 13,
    fontWeight: "900",
  },
  infoGrid: {
    gap: 10,
    marginBottom: 18,
  },
  infoBlock: {
    backgroundColor: COLORS.panel2,
    borderRadius: 17,
    padding: 13,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "800",
  },
  blockTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 7,
    marginBottom: 11,
  },
  muted: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: "700",
  },
  itemsBox: {
    backgroundColor: COLORS.panel2,
    borderRadius: 17,
    padding: 13,
    marginBottom: 8,
  },
  itemText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
  },
  timeline: {
    gap: 10,
  },
  stepRow: {
    flexDirection: "row",
    gap: 11,
    alignItems: "flex-start",
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderColor: COLORS.line,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginTop: 8,
  },
  stepDotDone: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  stepDotText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  stepBody: {
    flex: 1,
    backgroundColor: COLORS.panel2,
    borderRadius: 17,
    padding: 13,
    borderColor: "transparent",
    borderWidth: 1,
  },
  stepBodyCurrent: {
    borderColor: COLORS.blue2,
  },
  stepTitle: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 3,
  },
  stepTitleDone: {
    color: COLORS.text,
  },
  stepDetail: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  recentCard: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.line,
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
  },
  recentTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 4,
  },
  recentSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  recentRow: {
    backgroundColor: COLORS.panel2,
    borderColor: "transparent",
    borderWidth: 1,
    borderRadius: 17,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentRowSelected: {
    borderColor: COLORS.blue2,
  },
  recentId: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  recentFull: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 3,
  },
  recentArrow: {
    color: COLORS.blue2,
    fontSize: 20,
    fontWeight: "900",
  },
  primaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    borderColor: COLORS.blue2,
    borderWidth: 1.5,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
});
