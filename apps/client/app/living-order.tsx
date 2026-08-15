import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import type { CanonicalOrderTruth } from "../../../packages/contracts/src/order";

type DemoOrder = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: string;
  restaurant?: string;
  restaurantName?: string;
  merchantName?: string;
  customerName?: string;
  clientName?: string;
  total?: number;
  totalAmount?: number;
  amount?: number;
  totalCents?: number;
  item?: string;
  itemName?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number; price?: number }>;
  createdAt?: string;
  updatedAt?: string;
  deliveredAt?: string;
  timeline?: Array<{ status?: string; label?: string; note?: string; at?: string }>;
};

type OrderResponse = {
  ok?: boolean;
  canonicalSchemaVersion?: number;
  canonicalOrders?: CanonicalOrderTruth[];
  orders?: DemoOrder[];
  items?: DemoOrder[];
  data?: DemoOrder[];
  order?: DemoOrder;
};

type LivingOrder = {
  canonical?: CanonicalOrderTruth;
  legacy?: DemoOrder;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

function normalizeApiBase(value: string): string {
  const clean = String(value || "").replace(/\/+$/, "");
  if (!clean) return "https://api.delishafrica.me/api/v1";
  if (clean.endsWith("/api/v1")) return clean;
  if (clean.endsWith("/api")) return `${clean}/v1`;
  return `${clean}/api/v1`;
}

const API_BASE_URL = normalizeApiBase(RAW_API);

const STATUS_ORDER = ["pending", "accepted", "ready", "picked_up", "delivered"];
const FLOW = [
  { key: "choose", label: "Choisir", hint: "Le plat appelle." },
  { key: "pay", label: "Payer", hint: "Validation bancaire." },
  { key: "cook", label: "Cuisine", hint: "Le restaurant agit." },
  { key: "route", label: "Route", hint: "Le coursier avance." },
  { key: "receive", label: "Recevoir", hint: "Le voyage arrive." },
];

function extractLegacyOrders(payload: OrderResponse): DemoOrder[] {
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.order) return [payload.order];
  return [];
}

function extractLivingOrders(payload: OrderResponse): LivingOrder[] {
  if (
    payload?.canonicalSchemaVersion === 1 &&
    Array.isArray(payload?.canonicalOrders) &&
    payload.canonicalOrders.length > 0
  ) {
    return payload.canonicalOrders.map((canonical) => ({ canonical }));
  }

  return extractLegacyOrders(payload).map((legacy) => ({ legacy }));
}

function statusOf(order?: LivingOrder | null): string {
  return String(
    order?.canonical?.status?.business ||
      order?.legacy?.status ||
      "pending",
  ).toLowerCase();
}

function orderId(order?: LivingOrder | null): string {
  return String(
    order?.canonical?.identity?.publicId ||
      order?.legacy?.publicId ||
      order?.legacy?.orderId ||
      order?.legacy?.id ||
      "DA-LIVE",
  );
}

function restaurantOf(order?: LivingOrder | null): string {
  return String(
    order?.canonical?.restaurant?.name ||
      order?.legacy?.restaurantName ||
      order?.legacy?.merchantName ||
      order?.legacy?.restaurant ||
      "Thieyp",
  );
}

function itemOf(order?: LivingOrder | null): string {
  const canonicalFirst = order?.canonical?.items?.[0];
  const legacyFirst = Array.isArray(order?.legacy?.items)
    ? order?.legacy?.items?.[0]
    : undefined;

  return String(
    canonicalFirst?.name ||
      order?.legacy?.itemName ||
      order?.legacy?.item ||
      legacyFirst?.name ||
      legacyFirst?.title ||
      "Rice and Peace",
  );
}

function amountRaw(order?: LivingOrder | null): number {
  const canonicalAmount = order?.canonical?.pricing?.total?.amountMinor;

  if (Number.isFinite(canonicalAmount)) {
    return Number(canonicalAmount);
  }

  const legacy = order?.legacy;
  const raw =
    legacy?.totalAmount ??
    legacy?.total ??
    legacy?.amount ??
    legacy?.totalCents ??
    legacy?.items?.reduce(
      (sum, item) =>
        sum + Number(item.price || 0) * Number(item.quantity || 1),
      0,
    ) ??
    0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function formatMoney(value: number): string {
  const euros = Math.abs(value) >= 500 ? value / 100 : value;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}

function statusLabel(status: string): string {
  if (status === "delivered") return "Livrée";
  if (status === "picked_up") return "En route";
  if (status === "ready") return "Prête";
  if (status === "accepted") return "Cuisine";
  return "Reçue";
}

function compactStatus(status: string): string {
  if (status === "picked_up") return "Route";
  if (status === "accepted" || status === "ready") return "Cuisine";
  if (status === "delivered") return "Livrée";
  return "Reçue";
}

function stageIndex(status: string): number {
  if (status === "delivered") return 4;
  if (status === "picked_up") return 3;
  if (status === "ready" || status === "accepted") return 2;
  if (status === "pending") return 1;
  return 0;
}

function isActive(order: LivingOrder): boolean {
  const status = statusOf(order);
  return !["delivered", "completed", "cancelled", "canceled"].includes(status);
}

function latestTimestamp(order: LivingOrder): number {
  const canonicalTimestamp =
    order?.canonical?.timestamps?.updatedAt ||
    order?.canonical?.timestamps?.createdAt;
  const legacyTimestamp =
    order?.legacy?.updatedAt ||
    order?.legacy?.createdAt;

  return Date.parse(String(canonicalTimestamp || legacyTimestamp || 0)) || 0;
}

function latestOrdersFirst(a: LivingOrder, b: LivingOrder): number {
  const positionA = STATUS_ORDER.indexOf(statusOf(a));
  const positionB = STATUS_ORDER.indexOf(statusOf(b));
  const safePositionA = positionA < 0 ? 99 : positionA;
  const safePositionB = positionB < 0 ? 99 : positionB;

  if (safePositionA !== safePositionB) {
    return safePositionA - safePositionB;
  }

  return latestTimestamp(b) - latestTimestamp(a);
}

export default function LivingOrderScreen() {
  const [orders, setOrders] = useState<LivingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "client-living-order-v2a-readonly" }),
      });
      const json = (await response.json().catch(() => ({}))) as OrderResponse;
      if (!response.ok) throw new Error(`Service suivi indisponible (${response.status}).`);
      setOrders(extractLivingOrders(json).sort(latestOrdersFirst));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lecture du voyage impossible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeOrders = useMemo(() => orders.filter(isActive), [orders]);
  const deliveredOrders = useMemo(() => orders.filter((order) => statusOf(order) === "delivered"), [orders]);
  const selected = activeOrders[0] || orders[0] || null;
  const selectedStatus = statusOf(selected);
  const stepIndex = stageIndex(selectedStatus);
  const progress = selected ? Math.max(12, Math.min(100, (stepIndex + 1) * 20)) : 12;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5BE6B" />}
    >
      <View style={styles.orbTop} />
      <View style={styles.orbLeft} />

      <View style={styles.hero}>
        <Text style={styles.kicker}>DELISHAFRICA® LIVING ORDER</Text>
        <Text style={styles.title}>La commande devient un film.</Text>
        <Text style={styles.subtitle}>
          Un plat, un paiement, une cuisine, une route et une réception : tout avance comme un seul souffle.
        </Text>

        <View style={styles.progressShell}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.commandPanel}>
          <View style={styles.commandTopline}>
            <Text style={styles.panelKicker}>{selected ? statusLabel(selectedStatus) : "En attente"}</Text>
            <Text style={styles.panelId}>{selected ? orderId(selected) : "Aucune commande"}</Text>
          </View>
          <Text style={styles.panelTitle}>{itemOf(selected)}</Text>
          <Text style={styles.panelSubline}>
            {restaurantOf(selected)} • {selected ? formatMoney(amountRaw(selected)) : "--"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#F5BE6B" />
          <Text style={styles.loadingText}>Lecture du voyage DelishAfrica…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Signal indisponible</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.metricsRow}>
        <Metric label="Actives" value={String(activeOrders.length)} hint="voyages" />
        <Metric label="Livrées" value={String(deliveredOrders.length)} hint="archives" />
        <Metric label="Statut" value={compactStatus(selectedStatus)} hint="instant" />
      </View>

      <View style={styles.storyCard}>
        <Text style={styles.storyKicker}>STORY MOTION</Text>
        <Text style={styles.storyTitle}>Choisir. Savourer. Suivre. Recevoir.</Text>
        <Text style={styles.storyText}>
          DelishAfrica® rend chaque étape claire : le client sait ce qui se passe, sans jargon ni attente floue.
        </Text>

        <View style={styles.steps}>
          {FLOW.map((step, index) => {
            const active = index <= stepIndex;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={[styles.stepDot, active && styles.stepDotActive]}>
                  <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{index + 1}</Text>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{step.label}</Text>
                  <Text style={styles.stepHint}>{step.hint}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <ActionCard title="Menu signature" text="Voir les plats comme une galerie culturelle." path="/menu" />
      <ActionCard title="Panier intelligent" text="Vérifier montant, adresse et prochaine étape." path="/cart" />
      <ActionCard title="Suivi vivant" text="Lire la commande comme une histoire en mouvement." path="/live-tracking" />
      <ActionCard title="Paiement sécurisé" text="Finaliser avec la validation bancaire DelishAfrica®." path="/checkout-preflight" />

      <Pressable style={styles.primaryButton} onPress={onRefresh}>
        <Text style={styles.primaryButtonText}>Rafraîchir le voyage</Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => router.push("/delishafrica-signature" as any)}>
        <Text style={styles.secondaryButtonText}>Retour Signature</Text>
      </Pressable>

      <Text style={styles.footer}>Signature vivante • paiement préservé • suivi lisible.</Text>
    </ScrollView>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </View>
  );
}

function ActionCard({ title, text, path }: { title: string; text: string; path: string }) {
  return (
    <Pressable style={styles.actionCard} onPress={() => router.push(path as any)}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000D0A",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 54,
  },
  orbTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(245,190,107,0.22)",
  },
  orbLeft: {
    position: "absolute",
    top: 420,
    left: -120,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(45,211,193,0.18)",
  },
  hero: {
    borderWidth: 1,
    borderColor: "rgba(245,190,107,0.42)",
    borderRadius: 34,
    padding: 26,
    backgroundColor: "rgba(0,28,20,0.86)",
    overflow: "hidden",
  },
  kicker: {
    color: "#F5BE6B",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 6,
    lineHeight: 22,
  },
  title: {
    marginTop: 34,
    color: "#FFF9EA",
    fontSize: 51,
    lineHeight: 55,
    fontWeight: "900",
    letterSpacing: -2.2,
  },
  subtitle: {
    marginTop: 28,
    color: "rgba(255,249,234,0.72)",
    fontSize: 20,
    lineHeight: 32,
    fontWeight: "700",
  },
  progressShell: {
    marginTop: 26,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,249,234,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: 12,
    borderRadius: 999,
    backgroundColor: "#F5BE6B",
  },
  commandPanel: {
    marginTop: 22,
    borderRadius: 30,
    padding: 22,
    backgroundColor: "rgba(255,249,234,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,249,234,0.14)",
  },
  commandTopline: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  panelKicker: {
    color: "#F5BE6B",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  panelId: {
    color: "rgba(255,249,234,0.58)",
    fontSize: 12,
    fontWeight: "900",
  },
  panelTitle: {
    marginTop: 12,
    color: "#FFF9EA",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
  panelSubline: {
    marginTop: 12,
    color: "rgba(255,249,234,0.7)",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
  },
  loadingCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(255,249,234,0.08)",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  loadingText: {
    color: "rgba(255,249,234,0.72)",
    fontWeight: "800",
  },
  errorCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(245,90,74,0.13)",
    borderWidth: 1,
    borderColor: "rgba(245,90,74,0.28)",
  },
  errorTitle: {
    color: "#FFF9EA",
    fontWeight: "900",
    fontSize: 18,
  },
  errorText: {
    marginTop: 8,
    color: "rgba(255,249,234,0.68)",
    fontWeight: "700",
    lineHeight: 21,
  },
  metricsRow: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minHeight: 122,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,249,234,0.16)",
    backgroundColor: "rgba(255,249,234,0.08)",
    justifyContent: "space-between",
  },
  metricLabel: {
    color: "rgba(255,249,234,0.58)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#FFF9EA",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  metricHint: {
    color: "rgba(255,249,234,0.55)",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  storyCard: {
    marginTop: 26,
    borderRadius: 34,
    padding: 26,
    backgroundColor: "#F5BE6B",
  },
  storyKicker: {
    color: "#0A0A08",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "900",
    letterSpacing: 7,
  },
  storyTitle: {
    marginTop: 28,
    color: "#070807",
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900",
    letterSpacing: -1.8,
  },
  storyText: {
    marginTop: 24,
    color: "rgba(7,8,7,0.72)",
    fontSize: 22,
    lineHeight: 34,
    fontWeight: "900",
  },
  steps: {
    marginTop: 28,
    gap: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  stepDot: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,8,7,0.18)",
    borderWidth: 1,
    borderColor: "rgba(7,8,7,0.2)",
  },
  stepDotActive: {
    backgroundColor: "#070807",
    borderColor: "#070807",
  },
  stepNumber: {
    color: "rgba(7,8,7,0.5)",
    fontSize: 21,
    fontWeight: "900",
  },
  stepNumberActive: {
    color: "#F5BE6B",
  },
  stepCopy: {
    flex: 1,
  },
  stepLabel: {
    color: "rgba(7,8,7,0.48)",
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  stepLabelActive: {
    color: "#070807",
  },
  stepHint: {
    marginTop: 5,
    color: "rgba(7,8,7,0.62)",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  actionCard: {
    marginTop: 18,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,249,234,0.16)",
    backgroundColor: "rgba(255,249,234,0.07)",
  },
  actionTitle: {
    color: "#FFF9EA",
    fontSize: 27,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  actionText: {
    marginTop: 12,
    color: "rgba(255,249,234,0.62)",
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "800",
  },
  primaryButton: {
    marginTop: 24,
    borderRadius: 999,
    paddingVertical: 20,
    paddingHorizontal: 22,
    backgroundColor: "#FFF9EA",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#00140F",
    fontSize: 18,
    fontWeight: "900",
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 19,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "rgba(245,190,107,0.42)",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#F5BE6B",
    fontSize: 17,
    fontWeight: "900",
  },
  footer: {
    marginTop: 22,
    color: "rgba(255,249,234,0.38)",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },
});
