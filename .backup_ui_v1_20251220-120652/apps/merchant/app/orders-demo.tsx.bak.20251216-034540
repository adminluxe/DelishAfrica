import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : "/" + path;
  return b + p;
}

export default function OrdersDemo() {
  const API_BASE = ((process.env.EXPO_PUBLIC_API_BASE_URL || "").trim() || "http://127.0.0.1:3010");
  const base = useMemo(() => API_BASE, [API_BASE]);

  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string>("");

  async function call(method: string, url: string, body?: any) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${txt}`);
    try { return JSON.parse(txt); } catch { return txt; }
  }

  async function runE2E() {
    setBusy(true);
    setOut("");
    try {
      // on vise /api/v1/orders (chez toi c'est ça qui marche)
      const ORD = "/api/v1/orders";
      await call("POST", joinUrl(base, `${ORD}/demo/reset`), {});

      const created: any = await call("POST", joinUrl(base, ORD), {
        partnerSlug: "thieyp",
        items: [{ sku: "thieyp-001", name: "Thiéb Démo", qty: 1, unitPrice: 12.9 }],
        customerName: "Client Démo",
        customerPhone: "+000000000",
        notes: "DEMO mobile",
      });

      const orderId = created?.orderId || created?.id || created?.order?.id;
      if (!orderId) throw new Error("orderId introuvable dans la réponse: " + JSON.stringify(created));

      await call("PATCH", joinUrl(base, `${ORD}/${orderId}/status`), { status: "ready" });
      await call("PATCH", joinUrl(base, `${ORD}/${orderId}/status`), { status: "picked_up" });
      await call("PATCH", joinUrl(base, `${ORD}/${orderId}/status`), { status: "delivered" });

      const final = await call("GET", joinUrl(base, `${ORD}/${orderId}`));
      setOut(JSON.stringify({ base, orderId, final }, null, 2));
    } catch (e: any) {
      setOut(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F14" }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>/orders-demo</Text>
        <Text style={{ color: "rgba(255,255,255,0.7)" }}>
          Lance le flow complet: Client → Merchant → Courier (pending → ready → picked_up → delivered).
        </Text>

        <Pressable
          onPress={runE2E}
          disabled={busy}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.14)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            alignItems: "center",
          }}
        >
          {busy ? <ActivityIndicator /> : <Text style={{ color: "white", fontWeight: "800" }}>RUN E2E</Text>}
        </Pressable>

        <View style={{ padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)" }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontFamily: "Menlo" }}>{out || "—"}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
