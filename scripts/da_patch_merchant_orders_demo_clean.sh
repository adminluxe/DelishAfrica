#!/usr/bin/env bash
set -euo pipefail

FILE="/opt/delishafrica/monorepo/apps/merchant/app/orders-demo.tsx"
ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/.tonton_backups/merchant_orders_demo_$TS"
mkdir -p "$BK"

log(){ echo -e "\n🧡 $*\n"; }

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp -a "$FILE" "$BK/orders-demo.tsx.bak"
log "Backup: $BK/orders-demo.tsx.bak"

cat > "$FILE" <<'TSX'
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

type AnyOrder = any;

const API_FALLBACK = "https://api.delishafrica.me";

function pill(active: boolean) {
  return {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: active ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: active ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.10)",
  } as const;
}

function btn(color: "blue" | "gold" | "gray") {
  const bg =
    color === "blue"
      ? "rgba(59,130,246,0.35)"
      : color === "gold"
        ? "rgba(245,158,11,0.35)"
        : "rgba(255,255,255,0.08)";
  const br =
    color === "blue"
      ? "rgba(59,130,246,0.55)"
      : color === "gold"
        ? "rgba(245,158,11,0.55)"
        : "rgba(255,255,255,0.12)";

  return {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: bg,
    borderWidth: 1,
    borderColor: br,
    alignItems: "center",
  } as const;
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : null, text };
  } catch {
    return { ok: res.ok, status: res.status, json: null, text };
  }
}

/**
 * Endpoint confirmé par tes logs Nest:
 * POST /api/v1/orders/demo/status
 * body: { orderId, status }
 */
async function setDemoStatus(apiBase: string, orderId: string, status: "ready" | "delivered") {
  const url = `${apiBase}/api/v1/orders/demo/status`;
  const body = { orderId, status };

  console.log("[MERCHANT] setDemoStatus ->", url, body);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const out = await safeJson(res);
  console.log("[MERCHANT] setDemoStatus res:", out.status, out.json ?? out.text);

  return out;
}

async function listOrders(apiBase: string, status?: string) {
  const url = status
    ? `${apiBase}/api/v1/orders?status=${encodeURIComponent(status)}`
    : `${apiBase}/api/v1/orders`;

  const res = await fetch(url);
  const out = await safeJson(res);

  // API renvoie souvent [] directement
  const arr = Array.isArray(out.json) ? out.json : out.json?.items ?? out.json?.data ?? [];
  return Array.isArray(arr) ? arr : [];
}

export default function OrdersDemoMerchant() {
  const apiBase = useMemo(() => {
    const fromEnv =
      // @ts-ignore
      process?.env?.EXPO_PUBLIC_API_BASE_URL ||
      // @ts-ignore
      process?.env?.EXPO_PUBLIC_API_URL ||
      "";

    return String(fromEnv || API_FALLBACK).trim() || API_FALLBACK;
  }, []);

  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<AnyOrder[]>([]);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const timerRef = useRef<any>(null);

  const refresh = async () => {
    try {
      const pending = await listOrders(apiBase, "pending");
      // si API renvoie tout en vrac, on garde ça quand même:
      setOrders(pending);
      setLastRefresh(Date.now());
    } catch (e: any) {
      console.log("[MERCHANT] refresh error:", e?.message ?? e);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auto) return;
    timerRef.current = setInterval(refresh, 2500);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, apiBase]);

  const onReady = async (order: AnyOrder) => {
    const id = String(order?.id ?? order?.orderId ?? order?._id ?? order?.uuid ?? "");
    Alert.alert("Debug", `PRESS_READY: ${id || "(id manquant)"}`);

    if (!id) {
      Alert.alert("Erreur", "orderId manquant dans l’objet order (voir logs)");
      console.log("[MERCHANT] order object:", order);
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      const out = await setDemoStatus(apiBase, id, "ready");
      if (out.ok) {
        Alert.alert("OK", "Commande marquée PRÊT ✅");
        await refresh();
      } else {
        Alert.alert("Échec", `HTTP ${out.status} — regarde la console Metro`);
      }
    } catch (e: any) {
      console.log("[MERCHANT] onReady crash:", e?.message ?? e);
      Alert.alert("Crash", "onReady a crash (voir logs Metro)");
    } finally {
      setBusy(false);
    }
  };

  const cardBg = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.10)" };

  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Pressable onPress={() => router.push("/")} style={{ marginBottom: 10 }}>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>‹ index</Text>
        </Pressable>

        <Text style={{ color: "white", fontSize: 40, fontWeight: "800", letterSpacing: -1 }}>Commandes</Text>
        <Text style={{ color: "rgba(255,255,255,0.55)", marginTop: 6 }}>API: {apiBase}</Text>

        <View
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 20,
            borderWidth: 1,
            ...cardBg,
          }}
        >
          <Text style={{ color: "white", fontSize: 20, fontWeight: "800" }}>
            File de production • {orders.length} en attente
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable onPress={() => setAuto((v) => !v)} style={pill(auto)}>
              <Text style={{ color: "white", fontWeight: "700" }}>Auto: {auto ? "ON" : "OFF"}</Text>
            </Pressable>

            <Pressable onPress={refresh} style={pill(false)}>
              <Text style={{ color: "white", fontWeight: "700" }}>Rafraîchir</Text>
            </Pressable>
          </View>

          <Text style={{ color: "rgba(255,255,255,0.45)", marginTop: 10 }}>
            Dernier refresh: {new Date(lastRefresh).toLocaleTimeString()}
          </Text>
        </View>

        <View style={{ height: 14 }} />

        {orders.map((order: AnyOrder, idx: number) => {
          const id = String(order?.id ?? order?.orderId ?? order?._id ?? order?.uuid ?? `#${idx}`);
          const status = String(order?.status ?? "INCONNU").toUpperCase();

          return (
            <View
              key={id}
              style={{
                padding: 16,
                borderRadius: 22,
                borderWidth: 1,
                ...cardBg,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: "white", fontSize: 24, fontWeight: "900" }}>Commande {id}</Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontWeight: "700" }}>status:</Text>
                <View
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.10)",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "800" }}>{status}</Text>
                </View>
              </View>

              <View style={{ height: 12 }} />

              <Pressable
                onPress={() => onReady(order)}
                style={btn("gold")}
              >
                <Text style={{ color: "rgba(0,0,0,0.85)", fontWeight: "900", fontSize: 16 }}>
                  {status === "READY" ? "Déjà PRÊT" : "Marquer PRÊT"}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {orders.length === 0 ? (
          <Text style={{ color: "rgba(255,255,255,0.45)", marginTop: 12 }}>
            Aucune commande en attente.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
TSX

log "✅ orders-demo.tsx remplacé par une version clean + debug."
echo "➡️ Relance merchant avec cache clear:"
echo "cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear"
echo "Backup: $BK/orders-demo.tsx.bak"
