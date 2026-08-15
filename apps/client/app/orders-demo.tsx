import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    EXPO_PUBLIC_API_URL?: string;
  };
};

const RAW_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

function normalizeApiBaseUrl(value: string): string {
  const clean = String(value || "https://api.delishafrica.me/api/v1").replace(/\/+$/, "");
  if (clean.endsWith("/api/v1")) return clean;
  if (clean.endsWith("/api")) return `${clean}/v1`;
  return `${clean}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);

type DemoOrder = {
  id?: string;
  orderId?: string;
  partnerSlug?: string;
  status?: string;
  total?: number;
  currency?: string;
  deliveryAddress?: string;
  items?: Array<{ sku?: string; name?: string; qty?: number; price?: number }>;
  timeline?: Array<{ status?: string; note?: string; at?: string }>;
};

function endpoint(path: string): string {
  return API_BASE_URL.replace(/\/+$/, "") + path;
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await daOrdersFetch(endpoint(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
  }

  return data;
}

function extractOrder(data: any): DemoOrder | null {
  return data?.order || data?.data?.order || data?.item || data?.data || null;
}

function orderKey(order: DemoOrder | null): string | null {
  if (!order) return null;
  return String(order.orderId || order.id || "");
}

function prettyStatus(status?: string): string {
  const value = String(status || "pending").toLowerCase();
  if (value === "pending") return "Commande créée";
  if (value === "accepted") return "Acceptée par le restaurant";
  if (value === "ready") return "Prête pour le coursier";
  if (value === "picked_up") return "Récupérée par le coursier";
  if (value === "delivered") return "Livrée";
  return value;
}

export default function OrdersDemoClientScreen() {
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState("Votre sélection Thieyp est prête.");
  const currentOrderId = orderKey(order);

  const createOrder = useCallback(async () => {
    try {
      setLoading(true);
      setLastMessage("Création de la commande...");
      const data = await postJson("/orders/demo/create", {
        partnerSlug: "thieyp",
        items: [
          {
            sku: "thieyp-001",
            name: "Thieboudienne royal",
            qty: 1,
            price: 12.9,
          },
        ],
        client: {
          name: "Client DelishAfrica",
          phone: "+32 *** ** ** **",
        },
        deliveryAddress: "Adresse client - Bruxelles",
      });
      const nextOrder = extractOrder(data);
      setOrder(nextOrder);
      setLastMessage("Commande créée. Le marchand peut maintenant l’accepter.");
    } catch (error: any) {
      Alert.alert("Commande impossible", error?.message || "Erreur inconnue");
      setLastMessage("Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshOrder = useCallback(async () => {
    if (!currentOrderId) {
      Alert.alert("Aucune commande", "Crée d’abord une commande depuis le Client.");
      return;
    }

    try {
      setLoading(true);
      setLastMessage("Rafraîchissement du suivi...");
      const data = await postJson("/orders/demo/get", { orderId: currentOrderId });
      const nextOrder = extractOrder(data);
      setOrder(nextOrder);
      setLastMessage("Suivi mis à jour.");
    } catch (error: any) {
      Alert.alert("Suivi impossible", error?.message || "Erreur inconnue");
      setLastMessage("Erreur lors du suivi.");
    } finally {
      setLoading(false);
    }
  }, [currentOrderId]);

  const resetDemo = useCallback(async () => {
    try {
      setLoading(true);
      await postJson("/orders/demo/reset", {});
      setOrder(null);
      setLastMessage("Aperçu remis à zéro.");
    } catch (error: any) {
      Alert.alert("Reset impossible", error?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.kicker}>DelishAfrica Client</Text>
      <Text style={styles.title}>Commande Thieyp</Text>
      <Text style={styles.subtitle}>
        Préparez votre commande Thieyp avant la validation sécurisée.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Connexion</Text>
        <Text style={styles.value}>Service DelishAfrica connecté</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>État</Text>
        <Text style={styles.status}>{prettyStatus(order?.status)}</Text>
        <Text style={styles.value}>{lastMessage}</Text>
        {currentOrderId ? <Text style={styles.orderId}>Commande: {currentOrderId}</Text> : null}
      </View>

      {order?.items?.length ? (
        <View style={styles.card}>
          <Text style={styles.label}>Panier</Text>
          {order.items.map((item, index) => (
            <Text key={`${item.sku || index}`} style={styles.value}>
              {item.qty || 1}x {item.name || item.sku || "Article"} — {item.price ?? "?"} {order.currency || "EUR"}
            </Text>
          ))}
          <Text style={styles.total}>Total: {order.total ?? 12.9} {order.currency || "EUR"}</Text>
        </View>
      ) : null}

      {order?.timeline?.length ? (
        <View style={styles.card}>
          <Text style={styles.label}>Timeline</Text>
          {order.timeline.map((step, index) => (
            <Text key={`${step.status || "step"}-${index}`} style={styles.timeline}>
              • {prettyStatus(step.status)} {step.note ? `— ${step.note}` : ""}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable style={[styles.button, loading && styles.disabled]} onPress={createOrder} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Traitement..." : "Valider la sélection"}</Text>
      </Pressable>

      <Pressable style={[styles.secondaryButton, (!currentOrderId || loading) && styles.disabled]} onPress={refreshOrder} disabled={!currentOrderId || loading}>
        <Text style={styles.secondaryButtonText}>Suivre la commande</Text>
      </Pressable>

      <Pressable style={[styles.resetButton, loading && styles.disabled]} onPress={resetDemo} disabled={loading}>
        <Text style={styles.resetButtonText}>Réinitialiser l’aperçu</Text>
      </Pressable>

      {loading ? <ActivityIndicator style={styles.loader} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 22, paddingTop: 56, gap: 16, backgroundColor: "#071427", minHeight: "100%" },
  kicker: { color: "#80C7FF", fontSize: 13, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { color: "#F8FAFC", fontSize: 30, fontWeight: "900" },
  subtitle: { color: "#B7C7D8", fontSize: 15, lineHeight: 22 },
  card: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 22, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  label: { color: "#80C7FF", fontWeight: "900", marginBottom: 8, textTransform: "uppercase" },
  value: { color: "#E5EEF8", fontSize: 15, lineHeight: 22 },
  status: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  orderId: { color: "#93C5FD", marginTop: 10, fontWeight: "800" },
  total: { color: "#FFFFFF", marginTop: 10, fontWeight: "900" },
  timeline: { color: "#DCEBFF", fontSize: 14, lineHeight: 22 },
  button: { backgroundColor: "#2F80ED", borderRadius: 18, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  secondaryButton: { borderColor: "#80C7FF", borderWidth: 1, borderRadius: 18, paddingVertical: 15, alignItems: "center" },
  secondaryButtonText: { color: "#BFE3FF", fontWeight: "900", fontSize: 15 },
  resetButton: { borderColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderRadius: 18, paddingVertical: 14, alignItems: "center" },
  resetButtonText: { color: "#CBD5E1", fontWeight: "800" },
  disabled: { opacity: 0.55 },
  loader: { marginTop: 8 },
});
