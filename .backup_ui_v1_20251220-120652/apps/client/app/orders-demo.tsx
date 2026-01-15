import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

type AnyJson = any;

function normalizeBase(raw: string | undefined | null) {
  const v = (raw || "").trim();
  if (!v) return "";
  return v.endsWith("/") ? v.slice(0, -1) : v;
}

function pickOrderId(j: AnyJson): string | null {
  // Accept many shapes:
  // { order: { id } } | { id } | { orderId } | { data: { order: { id } } } | arrays etc.
  const direct =
    j?.order?.id ??
    j?.id ??
    j?.orderId ??
    j?.data?.order?.id ??
    j?.data?.id ??
    j?.result?.order?.id ??
    j?.result?.id;

  if (typeof direct === "string" && direct.length > 0) return direct;
  if (typeof direct === "number") return String(direct);

  // Sometimes API returns { ok:true, order:{...}, ... } already handled above
  // Fallback deep scan for "demo_" patterns
  const s = JSON.stringify(j);
  const m = s.match(/"id"\s*:\s*"([^"]+)"/);
  if (m?.[1]) return m[1];

  return null;
}

async function safeJsonFromResponse(res: Response): Promise<{ text: string; json: AnyJson | null }> {
  const text = await res.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

export default function OrdersDemoClientScreen() {
  const API_BASE = useMemo(() => {
    // Expo public env (most common)
    // @ts-ignore
    const env = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_BASE_URL;
    return normalizeBase(env || "https://api.delishafrica.me");
  }, []);

  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string>("-");
  const [lastLog, setLastLog] = useState<string>("");

  const logUI = (s: string) => setLastLog(`[${new Date().toLocaleTimeString()}] ${s}`);

  const createOrder = async () => {
    if (!API_BASE) {
      Alert.alert("API", "API_BASE vide (EXPO_PUBLIC_API_BASE_URL).");
      return;
    }
    const url = `${API_BASE}/api/v1/orders/demo/create`;
    setBusy(true);
    try {
      logUI(`POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partnerSlug: "thieyp",
          status: "pending",
          items: [{ sku: "yassa-poulet", name: "Yassa au poulet", qty: 1, price: 12 }],
          totals: { amount: 12, currency: "EUR" },
        }),
      });

      const { text, json } = await safeJsonFromResponse(res);
      logUI(`HTTP ${res.status} ${res.ok ? "OK" : "FAIL"} | bodyLen=${text.length}`);

      if (!res.ok) {
        Alert.alert("Create échoué", `HTTP ${res.status}\n\n${text.slice(0, 400)}`);
        return;
      }

      const id = json ? pickOrderId(json) : null;
      if (!id) {
        Alert.alert(
          "Create OK mais orderId introuvable",
          `Réponse JSON inattendue.\n\n${text.slice(0, 400)}`
        );
        setOrderId("-");
        return;
      }

      setOrderId(id);
      Alert.alert("✅ Commande créée", `orderId = ${id}`);
    } catch (e: any) {
      Alert.alert("Erreur réseau", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const listOrders = async () => {
    if (!API_BASE) return;
    const url = `${API_BASE}/api/v1/orders/demo/list`;
    setBusy(true);
    try {
      logUI(`POST ${url}`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partnerSlug: "thieyp" }),
      });
      const { text } = await safeJsonFromResponse(res);
      logUI(`HTTP ${res.status} | ${text.slice(0, 120).replace(/\s+/g, " ")}...`);
      Alert.alert("List (preview)", text.slice(0, 600));
    } catch (e: any) {
      Alert.alert("Erreur réseau", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 26, fontWeight: "800" }}>Client • Démo Commande</Text>
        <Text style={{ opacity: 0.75 }}>API: {API_BASE}</Text>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.15)",
          padding: 12,
          borderRadius: 14,
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700" }}>État</Text>
        <Text>orderId: {orderId}</Text>
        <Text style={{ opacity: 0.75 }}>{lastLog || "—"}</Text>
      </View>

      <Pressable
        disabled={busy}
        onPress={createOrder}
        style={{
          paddingVertical: 14,
          borderRadius: 16,
          alignItems: "center",
          backgroundColor: busy ? "rgba(0,0,0,0.25)" : "rgba(34,197,94,0.9)",
        }}
      >
        <Text style={{ fontWeight: "800" }}>{busy ? "..." : "Créer une commande Thieyp (SAFE)"}</Text>
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={listOrders}
        style={{
          paddingVertical: 14,
          borderRadius: 16,
          alignItems: "center",
          backgroundColor: busy ? "rgba(0,0,0,0.25)" : "rgba(59,130,246,0.65)",
        }}
      >
        <Text style={{ fontWeight: "800" }}>{busy ? "..." : "Lister commandes (DEBUG)"}</Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{
          paddingVertical: 12,
          borderRadius: 14,
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      >
        <Text style={{ fontWeight: "700" }}>Retour</Text>
      </Pressable>

      <Text style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>
        Note: Ce screen n’affiche PAS de confettis. Il est volontairement “chirurgical” : on valide l’API + orderId, point.
      </Text>
    </ScrollView>
  );
}
