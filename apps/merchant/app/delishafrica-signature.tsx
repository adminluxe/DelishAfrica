import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

type DemoOrder = Record<string, any>;

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

function normalizeApiBase(value: string): string {
  const cleaned = String(value || "").replace(/\/+$/, "");
  if (!cleaned) return "https://api.delishafrica.me/api/v1";
  return cleaned.endsWith("/api/v1") ? cleaned : `${cleaned}/api/v1`;
}

const API_BASE_URL = normalizeApiBase(RAW_API);

function safeText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

function statusOf(order?: DemoOrder | null): string {
  return String(order?.status || order?.state || "pending").toLowerCase();
}

function statusLabel(status?: string): string {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return "Reçue";
  if (s === "accepted") return "Cuisine";
  if (s === "ready") return "Prête";
  if (s === "picked_up") return "En route";
  if (s === "delivered") return "Livrée";
  return s ? s.replace(/_/g, " ") : "Reçue";
}

function publicId(order?: DemoOrder | null): string {
  return safeText(order?.publicId || order?.orderPublicId || order?.id || order?.orderId, "Commande active");
}

function firstItemName(order?: DemoOrder | null): string {
  const items = Array.isArray(order?.items) ? order?.items : [];
  const first = items[0] || {};
  return safeText(first.name || first.title || order?.itemName || order?.dishName, "Commande DelishAfrica®");
}

function amountValue(order?: DemoOrder | null): number {
  const candidates = [
    order?.totalCents,
    order?.amountCents,
    order?.cartTotalCents,
    order?.totalAmountCents,
    order?.total,
    order?.amount,
    order?.cartTotal,
    order?.totalAmount,
    order?.price,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") continue;
    const n = Number(candidate);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function money(orderOrValue?: DemoOrder | number | string | null): string {
  const raw = typeof orderOrValue === "object" && orderOrValue !== null ? amountValue(orderOrValue) : Number(orderOrValue || 0);
  if (!Number.isFinite(raw) || raw <= 0) return "—";
  const euros = Math.abs(raw) >= 100 ? raw / 100 : raw;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

function priority(status: string): number {
  if (status === "picked_up") return 0;
  if (status === "ready") return 1;
  if (status === "accepted") return 2;
  if (status === "pending") return 3;
  if (status === "delivered") return 4;
  return 5;
}

function pickPriorityOrder(orders: DemoOrder[]): DemoOrder | null {
  if (!orders.length) return null;
  return [...orders].sort((a, b) => priority(statusOf(a)) - priority(statusOf(b)))[0] || null;
}

function useOrders(scope: string) {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/orders/demo/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = await response.json().catch(() => ({}));
      const list = Array.isArray(json?.orders)
        ? json.orders
        : Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json?.data)
        ? json.data
        : [];
      setOrders(list);
    } catch (err: any) {
      setError(err?.message || "Lecture indisponible");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  return { orders, loading, error, load };
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={2} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
      {hint ? <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricHint}>{hint}</Text> : null}
    </View>
  );
}

function ActionCard({ title, body, to }: { title: string; body: string; to: string }) {
  return (
    <Pressable style={styles.actionCard} onPress={() => router.push(to as any)}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionBody}>{body}</Text>
    </Pressable>
  );
}

export default function DelishAfricaSignatureMerchant() {
  const { orders, loading, error, load } = useOrders("merchant-kitchen-intelligence-polish-v1c-readonly");
  const selected = useMemo(() => pickPriorityOrder(orders), [orders]);
  const pending = orders.filter((order) => statusOf(order) === "pending").length;
  const kitchen = orders.filter((order) => ["accepted", "ready", "picked_up"].includes(statusOf(order))).length;
  const ready = orders.filter((order) => statusOf(order) === "ready").length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.orb, { backgroundColor: "#C56B2D" }]} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#F4B66A" />}
      >
        <View style={[styles.hero, { borderColor: "rgba(197,107,45,0.52)", backgroundColor: "rgba(26,10,4,0.96)" }]}>
          <Text style={[styles.kicker, { color: "#F4B66A" }]}>DELISHAFRICA® MERCHANT</Text>
          <Text style={styles.title}>Kitchen Intelligence.</Text>
          <Text style={styles.subtitle}>Le restaurant ne subit pas les commandes. Il voit la prochaine meilleure action en un regard.</Text>
          <View style={styles.metricsRow}>
            <Metric label="NOUV." value={String(pending)} hint="à lire" />
            <Metric label="CUISINE" value={String(kitchen)} hint="actives" />
            <Metric label="PRÊTES" value={String(ready)} hint="départ" />
          </View>
          {loading ? <ActivityIndicator style={styles.loader} color="#F4B66A" /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={[styles.primaryPanel, { backgroundColor: "#FFF4DE" }]}>
          <Text style={[styles.panelKicker, { color: "#8A3E22" }]}>Prochaine meilleure action</Text>
          <Text style={[styles.panelTitle, { color: "#1B0902" }]}>{firstItemName(selected)}</Text>
          <Text style={[styles.panelMeta, { color: "#4A342A" }]}>{publicId(selected)} · {statusLabel(statusOf(selected))} · {money(selected)}</Text>
          <View style={styles.insightGrid}>
            <View style={styles.insight}><Text style={styles.insightLabel}>Clarté</Text><Text style={styles.insightValue}>98</Text></View>
            <View style={styles.insight}><Text style={styles.insightLabel}>Risque retard</Text><Text style={styles.insightValue}>Faible</Text></View>
            <View style={styles.insight}><Text style={styles.insightLabel}>Focus</Text><Text style={styles.insightValue}>Service</Text></View>
          </View>
        </View>

        <ActionCard title="Voir les commandes" body="Piloter la file cuisine sans bruit technique." to="/orders" />
        <ActionCard title="Ops & suivi" body="Lire la qualité de service et garder le restaurant prêt." to="/ops-dashboard" />
        <ActionCard title="Espace partenaire" body="Retrouver le profil restaurant et la session progressive." to="/partner-space" />
        
      <Pressable
        onPress={() => router.push("/service-oracle" as any)}
        style={{
          marginTop: 24,
          borderRadius: 28,
          padding: 24,
          borderWidth: 1,
          borderColor: "rgba(245,190,107,0.42)",
          backgroundColor: "rgba(245,190,107,0.10)",
        }}
      >
        <Text style={{ color: "#F5BE6B", fontSize: 12, fontWeight: "900", letterSpacing: 4 }}>
          SERVICE ORACLE
        </Text>
        <Text style={{ marginTop: 10, color: "#FFF9EA", fontSize: 30, lineHeight: 36, fontWeight: "900" }}>
          Voir la prochaine décision
        </Text>
        <Text style={{ marginTop: 8, color: "rgba(255,249,234,0.66)", fontSize: 17, lineHeight: 25, fontWeight: "800" }}>
          Pression cuisine, risque retard et action claire.
        </Text>
      </Pressable>

<Text style={styles.footer}>Kitchen Intelligence · service clair · cuisine prête.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020807" },
  scroll: { padding: 20, paddingBottom: 48 },
  orb: { position: "absolute", top: -90, right: -70, width: 240, height: 240, borderRadius: 140, opacity: 0.22 },
  hero: { borderWidth: 1, borderRadius: 32, padding: 26, overflow: "hidden", marginBottom: 24 },
  kicker: { fontSize: 13, lineHeight: 18, fontWeight: "900", letterSpacing: 5, textTransform: "uppercase", marginBottom: 22 },
  title: { color: "#F8F4EA", fontSize: 42, lineHeight: 48, fontWeight: "900", letterSpacing: -1.4 },
  subtitle: { color: "rgba(248,244,234,0.72)", fontSize: 18, lineHeight: 29, marginTop: 18 },
  metricsRow: { flexDirection: "row", gap: 8, marginTop: 26 },
  metric: { flex: 1, minHeight: 110, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 16, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  metricLabel: { color: "rgba(248,244,234,0.62)", fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" },
  metricValue: { color: "#F8F4EA", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 8 },
  metricHint: { color: "rgba(248,244,234,0.58)", fontSize: 12, lineHeight: 16, marginTop: 6 },
  primaryPanel: { borderRadius: 30, padding: 24, marginBottom: 24 },
  panelKicker: { fontSize: 13, lineHeight: 18, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase", marginBottom: 14 },
  panelTitle: { fontSize: 34, lineHeight: 40, fontWeight: "900", letterSpacing: -1, marginBottom: 10 },
  panelMeta: { fontSize: 16, lineHeight: 24, fontWeight: "800", opacity: 0.68, marginBottom: 20 },
  insightGrid: { gap: 12 },
  insight: { borderRadius: 20, padding: 16, backgroundColor: "rgba(0,0,0,0.08)" },
  insightLabel: { fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 1.6, opacity: 0.58, textTransform: "uppercase" },
  insightValue: { fontSize: 24, lineHeight: 30, fontWeight: "900", marginTop: 6 },
  steps: { gap: 14, marginTop: 26 },
  step: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28, fontWeight: "900", overflow: "hidden" },
  stepText: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
  actionCard: { borderRadius: 24, padding: 22, marginBottom: 14, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  actionTitle: { color: "#F8F4EA", fontSize: 24, lineHeight: 30, fontWeight: "900", letterSpacing: -0.4 },
  actionBody: { color: "rgba(248,244,234,0.64)", fontSize: 16, lineHeight: 25, marginTop: 8 },
  footer: { color: "rgba(248,244,234,0.46)", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 12 },
  loader: { marginTop: 18 },
  error: { color: "#F8C6B2", fontSize: 13, marginTop: 12 },
});
