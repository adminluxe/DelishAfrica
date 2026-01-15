#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)

for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  test -d "$APPDIR/app" || { echo "Missing $APPDIR/app"; exit 1; }

  # 1) helper module
  cat > "$APPDIR/app/orders-demo.ts" <<'TS'
type DemoOrderStatus = "pending" | "accepted" | "ready" | "picked_up" | "delivered" | "cancelled";

export type DemoOrderItem = { id: string; name: string; qty: number; price: number };

function joinUrl(base: string, path: string) {
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function call<T>(method: string, url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = text;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text?.slice?.(0, 250) ?? ""}`);
  return json as T;
}

export function getApiBase() {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me").trim();
}

export async function demoReset(base: string) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/reset"), {});
}
export async function demoCreate(base: string, payload: { partnerSlug: string; items: DemoOrderItem[] }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/create"), payload);
}
export async function demoList(base: string, payload: { role?: string; partnerSlug?: string; statuses?: DemoOrderStatus[] }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/list"), payload);
}
export async function demoGet(base: string, payload: { id: string }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/get"), payload);
}
export async function demoSetStatus(base: string, payload: { id: string; status: DemoOrderStatus; note?: string }) {
  return call("POST", joinUrl(base, "/api/v1/orders/demo/status"), payload);
}
TS

  # 2) route screen
  ROLE="$a"
  cat > "$APPDIR/app/thieyp-demo.tsx" <<TSX
import React from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { getApiBase, demoReset, demoCreate, demoList, demoGet, demoSetStatus, DemoOrderItem } from "./orders-demo";

function Btn(props: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        opacity: props.disabled ? 0.5 : 1,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "700" }}>{props.title}</Text>
    </Pressable>
  );
}

export default function ThieypDemoScreen() {
  const base = getApiBase();
  const role = "${ROLE}";

  const [busy, setBusy] = React.useState(false);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [json, setJson] = React.useState<any>(null);

  const menu: DemoOrderItem[] = [
    { id: "th1", name: "Yassa poulet", qty: 1, price: 14.9 },
    { id: "th2", name: "Mafé boeuf", qty: 1, price: 15.9 },
    { id: "th3", name: "Thieboudienne", qty: 1, price: 16.9 },
  ];

  async function run(fn: () => Promise<any>) {
    try {
      setBusy(true);
      const out = await fn();
      setJson(out);
      return out;
    } catch (e: any) {
      Alert.alert("Erreur", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // polling
  React.useEffect(() => {
    let t: any;
    if (orderId) {
      t = setInterval(() => {
        demoGet(base, { id: orderId }).then(setJson).catch(() => {});
      }, 2000);
    }
    return () => t && clearInterval(t);
  }, [orderId, base]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Thieyp Demo — {role}</Text>
      <Text style={{ opacity: 0.7 }}>API: {base}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Btn title="Reset demo" disabled={busy} onPress={() => run(() => demoReset(base))} />
        {role === "client" ? (
          <Btn
            title="Créer commande (Thieyp)"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const out = await demoCreate(base, { partnerSlug: "thieyp", items: menu });
                setOrderId(out?.order?.id ?? null);
                return out;
              })
            }
          />
        ) : (
          <Btn
            title="Refresh list"
            disabled={busy}
            onPress={() => run(() => demoList(base, { role, partnerSlug: "thieyp" }))}
          />
        )}
      </View>

      {role === "merchant" && json?.orders?.length ? (
        <View style={{ gap: 12 }}>
          {json.orders.map((o: any) => (
            <View key={o.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
              <Text style={{ fontWeight: "800" }}>{o.id}</Text>
              <Text>Status: {o.status}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                <Btn title="Accept" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "accepted" }))} />
                <Btn title="Ready" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "ready" }))} />
                <Btn title="Cancel" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "cancelled" }))} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {role === "courier" && json?.orders?.length ? (
        <View style={{ gap: 12 }}>
          {json.orders.map((o: any) => (
            <View key={o.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
              <Text style={{ fontWeight: "800" }}>{o.id}</Text>
              <Text>Status: {o.status}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                <Btn title="Pick up" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "picked_up" }))} />
                <Btn title="Deliver" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "delivered" }))} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {role === "client" && orderId ? (
        <View style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
          <Text style={{ fontWeight: "800" }}>Order ID</Text>
          <Text selectable>{orderId}</Text>
          <Text style={{ marginTop: 8, opacity: 0.7 }}>Polling status toutes les 2s…</Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 12, opacity: 0.6 }}>
        Astuce: ouvre la route /thieyp-demo dans Expo Router (URL finissant par --/thieyp-demo).
      </Text>

      <Text style={{ fontSize: 12, opacity: 0.6 }}>
        Debug JSON:
      </Text>
      <Text selectable style={{ fontFamily: "Menlo", fontSize: 11 }}>
        {JSON.stringify(json, null, 2)}
      </Text>
    </ScrollView>
  );
}
TSX

  echo "✅ $a: created app/orders-demo.ts + app/thieyp-demo.tsx"
done
