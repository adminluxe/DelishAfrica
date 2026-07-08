import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

type OrderLike = {
  id?: string;
  publicId?: string;
  orderId?: string;
  status?: string;
  total?: number | string;
  totalAmount?: number | string;
  amount?: number | string;
  restaurant?: string;
  restaurantName?: string;
  merchantName?: string;
  items?: Array<{ name?: string; title?: string; quantity?: number }>;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

function normalizeApiBase(raw: string) {
  const clean = String(raw || "").replace(/\/+$/, "");
  if (clean.endsWith("/api/v1")) return clean;
  if (clean.endsWith("/api")) return `${clean}/v1`;
  return `${clean}/api/v1`;
}

const API_BASE_URL = normalizeApiBase(RAW_API);

function asArray(json: any): OrderLike[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.orders)) return json.orders;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.result)) return json.result;
  return [];
}

function statusOf(order?: OrderLike | null) {
  return String(order?.status || "pending").toLowerCase();
}

function statusLabel(status?: string) {
  const s = String(status || "pending").toLowerCase();
  if (s === "picked_up") return "En route";
  if (s === "ready") return "Prête";
  if (s === "accepted") return "Cuisine";
  if (s === "delivered") return "Livrée";
  if (s === "cancelled" || s === "canceled") return "Annulée";
  return "Reçue";
}

function statusShort(status?: string) {
  const s = String(status || "pending").toLowerCase();
  if (s === "picked_up") return "Route";
  if (s === "ready") return "Prête";
  if (s === "accepted") return "Cuisine";
  if (s === "delivered") return "Livrée";
  return "Live";
}

function publicId(order?: OrderLike | null) {
  const raw = order?.publicId || order?.orderId || order?.id || "DA-LIVE";
  return String(raw).replace(/^order_/i, "DA-").slice(0, 10);
}

function itemName(order?: OrderLike | null) {
  const first = Array.isArray(order?.items) ? order?.items?.[0] : null;
  return String(first?.name || first?.title || "Rice and Peace");
}

function moneyValue(order?: OrderLike | null) {
  const raw = order?.total ?? order?.totalAmount ?? order?.amount ?? 2190;
  const n = typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n) >= 100 ? n / 100 : n;
}

function money(order?: OrderLike | null) {
  return moneyValue(order).toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sortOrders(orders: OrderLike[]) {
  const priority: Record<string, number> = {
    picked_up: 1,
    ready: 2,
    accepted: 3,
    pending: 4,
    delivered: 5,
  };
  return [...orders].sort((a, b) => (priority[statusOf(a)] || 9) - (priority[statusOf(b)] || 9));
}

export default function DelishAfricaSignatureScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/orders/demo/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "client-signature-v1e-readonly" }),
      });
      const json = await res.json().catch(() => ({}));
      setOrders(asArray(json));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => sortOrders(orders), [orders]);
  const active = sorted.find((order) => !["delivered", "cancelled", "canceled"].includes(statusOf(order))) || sorted[0] || null;
  const activeCount = orders.filter((order) => !["delivered", "cancelled", "canceled"].includes(statusOf(order))).length;
  const deliveredCount = orders.filter((order) => statusOf(order) === "delivered").length;
  const status = statusOf(active);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />

      <View style={styles.heroCard}>
        <Text style={styles.kicker}>DELISHAFRICA® SIGNATURE</Text>
        <Text style={styles.title}>Le voyage culinaire vivant.</Text>
        <Text style={styles.subtitle}>
          Menu, panier, paiement, cuisine, coursier et suivi deviennent une seule expérience premium.
        </Text>

        <View style={styles.signalBand}>
          <View style={styles.signalLeft}>
            <Text style={styles.signalLabel}>Signal live</Text>
            <Text style={styles.signalValue}>{loading ? "Lecture" : `${Math.max(activeCount, active ? 1 : 0)} active`}</Text>
          </View>
          <View style={styles.signalMiddle}>
            <Text style={styles.signalLabel}>Statut</Text>
            <Text style={styles.signalValue}>{statusShort(status)}</Text>
            <Text style={styles.signalHint}>{publicId(active)}</Text>
          </View>
          <View style={styles.signalRight}>
            <Text style={styles.signalLabel}>Panier</Text>
            <Text style={styles.signalValue}>{money(active)} €</Text>
            <Text style={styles.signalHint}>{deliveredCount} livrées</Text>
          </View>
        </View>
      </View>

      <View style={styles.oracleCard}>
        <Text style={styles.oracleKicker}>AFROTASTE ORACLE</Text>
        <Text style={styles.oracleTitle}>{itemName(active)}</Text>
        <Text style={styles.oracleCopy}>
          Chaque plat raconte une origine, une émotion, un rythme cuisine et une promesse de livraison.
        </Text>
        <View style={styles.steps}>
          {[
            "Choisir",
            "Savourer",
            "Suivre",
            "Recevoir",
          ].map((label, index) => (
            <View key={label} style={styles.stepRow}>
              <View style={styles.stepDot}><Text style={styles.stepDotText}>{index + 1}</Text></View>
              <Text style={styles.stepText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actionStack}>
        <ActionCard title="Menu signature" body="Voir les plats comme une galerie culturelle." onPress={() => router.push("/menu" as any)} />
        <ActionCard title="Panier intelligent" body="Vérifier montant, adresse et prochaine étape." onPress={() => router.push("/cart" as any)} />
        <ActionCard title="Suivi vivant" body="Voir la commande comme une histoire en mouvement." onPress={() => router.push("/live-story" as any)} />
        <ActionCard title="Paiement sécurisé" body="Finaliser avec la validation bancaire DelishAfrica®." onPress={() => router.push("/checkout-preflight" as any)} />
      </View>

      
      <Pressable
        onPress={() => router.push("/living-order" as any)}
        style={{
          marginTop: 22,
          borderRadius: 34,
          padding: 26,
          borderWidth: 1,
          borderColor: "rgba(245,190,107,0.40)",
          backgroundColor: "rgba(245,190,107,0.14)",
        }}
      >
        <Text style={{ color: "#F5BE6B", fontSize: 12, fontWeight: "900", letterSpacing: 3 }}>{"LIVING ORDER OS"}</Text>
        <Text style={{ marginTop: 10, color: "#FFF9EA", fontSize: 30, fontWeight: "900", lineHeight: 34 }}>{"Voir la commande vivante"}</Text>
        <Text style={{ marginTop: 8, color: "rgba(255,249,234,0.70)", fontSize: 16, lineHeight: 24 }}>{"Paiement, cuisine, route et reception deviennent un recit en mouvement."}</Text>
      </Pressable>
<Pressable style={styles.refreshButton} onPress={load}>
        {loading ? <ActivityIndicator /> : <Text style={styles.refreshText}>Rafraîchir la signature</Text>}
      </Pressable>

      <Text style={styles.footer}>Signature front-only · aucune mutation automatique · paiement préservé.</Text>
    </ScrollView>
  );
}

function ActionCard({ title, body, onPress }: { title: string; body: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionCard} onPress={onPress}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#020A07" },
  content: { paddingHorizontal: 20, paddingTop: 38, paddingBottom: 42, gap: 22 },
  orbOne: { position: "absolute", top: -70, right: -80, width: 260, height: 260, borderRadius: 999, backgroundColor: "rgba(245,190,107,0.18)" },
  orbTwo: { position: "absolute", top: 320, left: -110, width: 220, height: 220, borderRadius: 999, backgroundColor: "rgba(47,211,190,0.14)" },
  heroCard: { borderRadius: 30, borderWidth: 1, borderColor: "rgba(245,190,107,0.42)", backgroundColor: "rgba(2,24,15,0.92)", padding: 28, gap: 22, overflow: "hidden" },
  kicker: { color: "#F6BE67", fontSize: 13, fontWeight: "900", letterSpacing: 9, lineHeight: 24 },
  title: { color: "#FFF9EC", fontSize: 46, lineHeight: 48, fontWeight: "900", letterSpacing: -2 },
  subtitle: { color: "rgba(255,249,236,0.70)", fontSize: 20, lineHeight: 32, fontWeight: "600" },
  signalBand: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,249,236,0.16)", backgroundColor: "rgba(255,255,255,0.045)", padding: 16, gap: 12 },
  signalLeft: { borderRadius: 20, backgroundColor: "rgba(255,249,236,0.08)", padding: 16 },
  signalMiddle: { borderRadius: 20, backgroundColor: "rgba(255,249,236,0.08)", padding: 16 },
  signalRight: { borderRadius: 20, backgroundColor: "rgba(255,249,236,0.08)", padding: 16 },
  signalLabel: { color: "rgba(255,249,236,0.62)", fontSize: 12, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  signalValue: { color: "#FFF9EC", fontSize: 34, lineHeight: 38, fontWeight: "900", marginTop: 8 },
  signalHint: { color: "rgba(255,249,236,0.55)", fontSize: 15, fontWeight: "700", marginTop: 5 },
  oracleCard: { borderRadius: 30, backgroundColor: "#F5BE67", padding: 28, gap: 18 },
  oracleKicker: { color: "#130B05", fontSize: 14, fontWeight: "900", letterSpacing: 7, lineHeight: 24 },
  oracleTitle: { color: "#100805", fontSize: 38, lineHeight: 42, fontWeight: "900", letterSpacing: -1.5 },
  oracleCopy: { color: "rgba(16,8,5,0.76)", fontSize: 20, lineHeight: 30, fontWeight: "800" },
  steps: { gap: 14, marginTop: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#100805" },
  stepDotText: { color: "#F5BE67", fontSize: 18, fontWeight: "900" },
  stepText: { color: "#100805", fontSize: 22, fontWeight: "900" },
  actionStack: { gap: 16 },
  actionCard: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,249,236,0.12)", backgroundColor: "rgba(255,255,255,0.06)", padding: 24, gap: 10 },
  actionTitle: { color: "#FFF9EC", fontSize: 27, lineHeight: 31, fontWeight: "900", letterSpacing: -1 },
  actionBody: { color: "rgba(255,249,236,0.62)", fontSize: 18, lineHeight: 27, fontWeight: "700" },
  refreshButton: { borderRadius: 999, minHeight: 58, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF9EC", marginTop: 4 },
  refreshText: { color: "#06110C", fontSize: 19, fontWeight: "900" },
  footer: { textAlign: "center", color: "rgba(255,249,236,0.35)", fontSize: 13, lineHeight: 20, marginTop: 4 },
});
