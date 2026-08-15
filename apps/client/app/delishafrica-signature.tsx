import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AquaticSignature } from "../components/aquatic/AquaticSignature";
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

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
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
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
    load();
  }, [load]);

  const sorted = useMemo(() => sortOrders(orders), [orders]);
  const active = sorted.find((order) => !["delivered", "cancelled", "canceled"].includes(statusOf(order))) || sorted[0] || null;
  const activeCount = orders.filter((order) => !["delivered", "cancelled", "canceled"].includes(statusOf(order))).length;
  const deliveredCount = orders.filter((order) => statusOf(order) === "delivered").length;
  const status = statusOf(active);

  return (
    <AquaticSignature reduceMotion={reduceMotion}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.orbOne} pointerEvents="none" />
      <View style={styles.orbTwo} pointerEvents="none" />
      <View pointerEvents="none" style={styles.signatureCurrentLayer}>
        <View style={[styles.signatureCurrent, styles.signatureCurrentOne]} />
        <View style={[styles.signatureCurrent, styles.signatureCurrentTwo]} />
        <View style={[styles.signatureCurrent, styles.signatureCurrentThree]} />
      </View>

      <View style={styles.heroCard}>
        <View pointerEvents="none" style={styles.heroRefraction} />
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
        <View pointerEvents="none" style={styles.oracleSheen} />
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
<Pressable style={styles.refreshButton} onPress={load}>
        {loading ? <ActivityIndicator /> : <Text style={styles.refreshText}>Rafraîchir la signature</Text>}
      </Pressable>

      <Text style={styles.footer}>Signature DelishAfrica® · paiement sécurisé · expérience fluide.</Text>
      </ScrollView>
    </AquaticSignature>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 20, paddingTop: 62, paddingBottom: 42, gap: 22 },
  orbOne: {
    position: "absolute",
    top: -72,
    right: -82,
    width: 264,
    height: 264,
    borderRadius: 999,
    backgroundColor: "rgba(121,239,226,0.13)",
    borderWidth: 1,
    borderColor: "rgba(204,255,244,0.14)",
  },
  orbTwo: {
    position: "absolute",
    top: 320,
    left: -112,
    width: 224,
    height: 224,
    borderRadius: 999,
    backgroundColor: "rgba(245,190,107,0.13)",
    borderWidth: 1,
    borderColor: "rgba(245,221,177,0.12)",
  },
  signatureCurrentLayer: {
    position: "absolute",
    top: 118,
    left: -54,
    right: -54,
    height: 520,
    overflow: "hidden",
  },
  signatureCurrent: {
    position: "absolute",
    height: 1,
    borderRadius: 999,
    backgroundColor: "rgba(184,255,242,0.16)",
    transform: [{ rotate: "-8deg" }],
  },
  signatureCurrentOne: { top: 34, left: 12, width: 430 },
  signatureCurrentTwo: { top: 164, right: -24, width: 360, opacity: 0.7 },
  signatureCurrentThree: { top: 328, left: -22, width: 390, opacity: 0.5 },
  heroCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(156,241,222,0.28)",
    backgroundColor: "rgba(3,29,25,0.86)",
    padding: 28,
    gap: 22,
    overflow: "hidden",
    shadowColor: "#8CF7EA",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  heroRefraction: {
    position: "absolute",
    width: 320,
    height: 112,
    borderRadius: 999,
    top: -62,
    right: -96,
    backgroundColor: "rgba(208,255,246,0.11)",
    borderWidth: 1,
    borderColor: "rgba(208,255,246,0.12)",
    transform: [{ rotate: "-10deg" }],
  },
  kicker: { color: "#F6BE67", fontSize: 13, fontWeight: "900", letterSpacing: 9, lineHeight: 24 },
  title: { color: "#FFF9EC", fontSize: 46, lineHeight: 48, fontWeight: "900", letterSpacing: -2 },
  subtitle: { color: "rgba(255,249,236,0.72)", fontSize: 20, lineHeight: 32, fontWeight: "600" },
  signalBand: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(192,255,243,0.15)",
    backgroundColor: "rgba(211,255,246,0.045)",
    padding: 16,
    gap: 12,
  },
  signalLeft: { borderRadius: 20, backgroundColor: "rgba(255,249,236,0.075)", padding: 16 },
  signalMiddle: { borderRadius: 20, backgroundColor: "rgba(148,238,223,0.075)", padding: 16 },
  signalRight: { borderRadius: 20, backgroundColor: "rgba(255,249,236,0.075)", padding: 16 },
  signalLabel: { color: "rgba(255,249,236,0.62)", fontSize: 12, fontWeight: "900", letterSpacing: 4, textTransform: "uppercase" },
  signalValue: { color: "#FFF9EC", fontSize: 34, lineHeight: 38, fontWeight: "900", marginTop: 8 },
  signalHint: { color: "rgba(255,249,236,0.55)", fontSize: 15, fontWeight: "700", marginTop: 5 },
  oracleCard: {
    borderRadius: 30,
    backgroundColor: "rgba(245,190,103,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,241,205,0.48)",
    padding: 28,
    gap: 18,
    overflow: "hidden",
    shadowColor: "#F5BE67",
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  oracleSheen: {
    position: "absolute",
    top: -42,
    left: -38,
    right: -38,
    height: 88,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.20)",
    transform: [{ rotate: "4deg" }],
  },
  oracleKicker: { color: "#130B05", fontSize: 14, fontWeight: "900", letterSpacing: 7, lineHeight: 24 },
  oracleTitle: { color: "#100805", fontSize: 38, lineHeight: 42, fontWeight: "900", letterSpacing: -1.5 },
  oracleCopy: { color: "rgba(16,8,5,0.76)", fontSize: 20, lineHeight: 30, fontWeight: "800" },
  steps: { gap: 14, marginTop: 8 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#100805" },
  stepDotText: { color: "#F5BE67", fontSize: 18, fontWeight: "900" },
  stepText: { color: "#100805", fontSize: 22, fontWeight: "900" },
  refreshButton: {
    borderRadius: 999,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,249,236,0.96)",
    borderWidth: 1,
    borderColor: "rgba(189,255,245,0.22)",
    marginTop: 4,
  },
  refreshText: { color: "#06110C", fontSize: 19, fontWeight: "900" },
  footer: { textAlign: "center", color: "rgba(226,255,247,0.42)", fontSize: 13, lineHeight: 20, marginTop: 4 },
});
