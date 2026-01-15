#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BACKUP_DIR="$ROOT/backups/da_write_thieyp_orders_demo_pages_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

write_file () {
  local path="$1"
  local tmp="${path}.tmp"

  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]]; then
    cp -a "$path" "$BACKUP_DIR/$(echo "$path" | sed 's#/#__#g')"
  fi

  cat > "$tmp" <<'EOF'
__CONTENT__
EOF

  mv "$tmp" "$path"
}

# -------------------------
# CLIENT: create + follow
# -------------------------
CLIENT_PATH="$ROOT/apps/client/app/orders-demo.tsx"
CLIENT_CONTENT='
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";

function extractOrderId(json: any): string | null {
  return (json?.order?.id ?? json?.orderId ?? json?.id ?? null);
}

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL as string) || "https://api.delishafrica.me";
const PARTNER_SLUG = "thieyp";

async function postJSON<T>(path: string, body: any, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    const data = txt ? JSON.parse(txt) : {};
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data as T;
  } finally {
    clearTimeout(t);
  }
}

async function getHealthMs(): Promise<number> {
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("health not ok");
  return Date.now() - t0;
}

export default function OrdersDemoClient() {
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);

  const status = order?.status || "—";
  const canCreate = !busy;

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const refreshHealth = async () => {
    try {
      const ms = await getHealthMs();
      setPingMs(ms);
    } catch {
      setPingMs(null);
    }
  };

  const fetchOrder = async (id: string) => {
    // Try /get first
    try {
      const got = await postJSON<any>("/api/v1/orders/demo/get", { id, orderId: id });
      const o = got?.order ?? got?.data ?? got;
      if (o) setOrder(o);
      return;
    } catch {
      // Fallback: list + find
      const listed = await postJSON<any>("/api/v1/orders/demo/list", { partnerSlug: PARTNER_SLUG });
      const items = listed?.items ?? listed?.orders ?? listed?.data ?? [];
      const found = Array.isArray(items) ? items.find((x: any) => (x?.id === id || x?.order?.id === id)) : null;
      if (found) setOrder(found?.order ?? found);
    }
  };

  const createOrder = async () => {
    setBusy(true);
    setErr(null);
    try {
      const created = await postJSON<any>("/api/v1/orders/demo/create", {
        partnerSlug: PARTNER_SLUG,
        items: [{ sku: "thieyp-001", qty: 1 }],
        client: { name: "Demo Client" },
      });
      const id = extractOrderId(created);
      if (!id) throw new Error("ID commande introuvable (order.id)");
      setOrderId(id);
      setOrder(created?.order ?? null);
      if (autoFollow) await fetchOrder(id);
    } catch (e: any) {
      setErr(e?.message || "Erreur create");
      Alert.alert("Erreur", e?.message || "Erreur create");
    } finally {
      setBusy(false);
    }
  };

  const clearOrder = () => {
    setOrderId(null);
    setOrder(null);
    setErr(null);
  };

  useEffect(() => { refreshHealth(); }, []);

  useEffect(() => {
    if (!autoFollow || !orderId) return;
    if (pollRef.current) clearInterval(pollRef.current as any);

    pollRef.current = setInterval(() => {
      fetchOrder(orderId).catch(() => {});
    }, 2500) as any;

    return () => {
      if (pollRef.current) clearInterval(pollRef.current as any);
      pollRef.current = null;
    };
  }, [autoFollow, orderId]);

  const badge = useMemo(() => {
    if (pingMs == null) return { text: "API: OFF", style: styles.badgeOff };
    return { text: `API: OK • ${pingMs}ms`, style: styles.badgeOk };
  }, [pingMs]);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: "Commande (démo)" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backTxt}>←</Text>
          </Pressable>
          <Text style={styles.h1}>Thieyp • Client</Text>
        </View>

        <View style={[styles.badge, badge.style]}>
          <Text style={styles.badgeTxt}>{badge.text}</Text>
        </View>
        <Text style={styles.muted}>API: {API_BASE}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Créer & suivre une commande</Text>

          <Pressable disabled={!canCreate} onPress={createOrder} style={[styles.btn, !canCreate && styles.btnDisabled]}>
            {busy ? <ActivityIndicator /> : <Text style={styles.btnTxt}>Créer une commande Thieyp</Text>}
          </Pressable>

          <View style={styles.row}>
            <Pressable onPress={() => setAutoFollow((v) => !v)} style={[styles.smallBtn, autoFollow && styles.smallBtnOn]}>
              <Text style={styles.smallBtnTxt}>Suivi auto: {autoFollow ? "ON" : "OFF"}</Text>
            </Pressable>

            <Pressable disabled={!orderId} onPress={() => orderId && fetchOrder(orderId)} style={[styles.smallBtn, !orderId && styles.smallBtnDisabled]}>
              <Text style={styles.smallBtnTxt}>Rafraîchir</Text>
            </Pressable>

            <Pressable onPress={clearOrder} style={styles.smallBtn}>
              <Text style={styles.smallBtnTxt}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.sep} />

          <Text style={styles.kv}><Text style={styles.k}>orderId:</Text> <Text style={styles.v}>{orderId ?? "—"}</Text></Text>
          <Text style={styles.kv}><Text style={styles.k}>status:</Text> <Text style={styles.v}>{status}</Text></Text>

          {!!err && <Text style={styles.err}>⚠ {err}</Text>}

          <View style={styles.sep} />
          <Text style={styles.mutedSmall}>Astuce démo : ouvre Merchant → “Prêt”, puis Courier → “Livrée”.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#070B12" },
  container: { padding: 16, paddingBottom: 40, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  backTxt: { color: "white", fontSize: 18, fontWeight: "700" },
  h1: { color: "white", fontSize: 26, fontWeight: "800" },
  badge: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  badgeOk: { backgroundColor: "rgba(34,197,94,0.16)" },
  badgeOff: { backgroundColor: "rgba(239,68,68,0.16)" },
  badgeTxt: { color: "white", fontWeight: "700" },
  muted: { color: "rgba(255,255,255,0.65)" },
  mutedSmall: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  card: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  btn: { backgroundColor: "#22c55e", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: "#06120A", fontWeight: "900", fontSize: 16 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)" },
  smallBtnOn: { backgroundColor: "rgba(59,130,246,0.20)" },
  smallBtnDisabled: { opacity: 0.45 },
  smallBtnTxt: { color: "white", fontWeight: "700" },
  sep: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 6 },
  kv: { color: "white", fontSize: 14 },
  k: { color: "rgba(255,255,255,0.65)" },
  v: { color: "white", fontWeight: "800" },
  err: { color: "#fb7185", fontWeight: "800" },
};
'.trim();

# -------------------------
# MERCHANT: list + READY
# -------------------------
MERCHANT_PATH="$ROOT/apps/merchant/app/orders-demo.tsx"
MERCHANT_CONTENT='
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";

function extractOrderId(json: any): string | null {
  return (json?.order?.id ?? json?.orderId ?? json?.id ?? null);
}

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL as string) || "https://api.delishafrica.me";
const PARTNER_SLUG = "thieyp";

async function postJSON<T>(path: string, body: any, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    const data = txt ? JSON.parse(txt) : {};
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data as T;
  } finally {
    clearTimeout(t);
  }
}

export default function OrdersDemoMerchant() {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      const listed = await postJSON<any>("/api/v1/orders/demo/list", { partnerSlug: PARTNER_SLUG });
      const arr = listed?.items ?? listed?.orders ?? listed?.data ?? [];
      setItems(Array.isArray(arr) ? arr.map((x: any) => (x?.order ?? x)) : []);
    } catch (e: any) {
      setErr(e?.message || "Erreur list");
    } finally {
      setBusy(false);
    }
  };

  const markReady = async (o: any) => {
    const id = extractOrderId(o) || o?.id;
    if (!id) return Alert.alert("Erreur", "ID introuvable");
    setBusy(true);
    try {
      await postJSON<any>("/api/v1/orders/demo/status", { id, orderId: id, status: "READY" });
      await load();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Erreur status");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!auto) return;
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => load().catch(() => {}), 2500) as any;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
      timerRef.current = null;
    };
  }, [auto]);

  const pending = items.filter((x) => (x?.status || "").toLowerCase() !== "delivered");

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: "Commandes (démo)" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></Pressable>
          <Text style={styles.h1}>Thieyp • Merchant</Text>
        </View>

        <Text style={styles.muted}>API: {API_BASE}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>File de production</Text>

          <View style={styles.row}>
            <Pressable onPress={() => setAuto((v) => !v)} style={[styles.smallBtn, auto && styles.smallBtnOn]}>
              <Text style={styles.smallBtnTxt}>Auto: {auto ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable onPress={load} style={styles.smallBtn}>
              <Text style={styles.smallBtnTxt}>Rafraîchir</Text>
            </Pressable>
          </View>

          {!!err && <Text style={styles.err}>⚠ {err}</Text>}
        </View>

        {busy && <View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>chargement…</Text></View>}

        {pending.length === 0 ? (
          <View style={styles.empty}><Text style={styles.muted}>Aucune commande pour l’instant.</Text></View>
        ) : (
          pending.map((o) => {
            const id = extractOrderId(o) || o?.id || "—";
            const st = (o?.status || "—").toUpperCase();
            const canReady = st !== "READY" && st !== "DELIVERED";
            return (
              <View key={id} style={styles.orderCard}>
                <Text style={styles.orderTitle}>Commande {id}</Text>
                <Text style={styles.kv}><Text style={styles.k}>status:</Text> <Text style={styles.v}>{st}</Text></Text>

                <View style={styles.row}>
                  <Pressable disabled={!canReady || busy} onPress={() => markReady(o)} style={[styles.btn, (!canReady || busy) && styles.btnDisabled]}>
                    <Text style={styles.btnTxt}>Marquer PRÊT</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#070B12" },
  container: { padding: 16, paddingBottom: 40, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  backTxt: { color: "white", fontSize: 18, fontWeight: "700" },
  h1: { color: "white", fontSize: 26, fontWeight: "800" },
  muted: { color: "rgba(255,255,255,0.65)" },
  card: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)" },
  smallBtnOn: { backgroundColor: "rgba(59,130,246,0.20)" },
  smallBtnTxt: { color: "white", fontWeight: "700" },
  err: { color: "#fb7185", fontWeight: "800" },
  loading: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  empty: { padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)" },
  orderCard: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  orderTitle: { color: "white", fontSize: 16, fontWeight: "900" },
  kv: { color: "white", fontSize: 14 },
  k: { color: "rgba(255,255,255,0.65)" },
  v: { color: "white", fontWeight: "800" },
  btn: { backgroundColor: "#f59e0b", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: "#120A02", fontWeight: "900" },
};
'.trim();

# -------------------------
# COURIER: list READY + DELIVERED
# -------------------------
COURIER_PATH="$ROOT/apps/courier/app/orders-demo.tsx"
COURIER_CONTENT='
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";

function extractOrderId(json: any): string | null {
  return (json?.order?.id ?? json?.orderId ?? json?.id ?? null);
}

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL as string) || "https://api.delishafrica.me";

async function postJSON<T>(path: string, body: any, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
    const txt = await res.text();
    const data = txt ? JSON.parse(txt) : {};
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data as T;
  } finally {
    clearTimeout(t);
  }
}

export default function OrdersDemoCourier() {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      const listed = await postJSON<any>("/api/v1/orders/demo/list", { status: "READY" });
      const arr = listed?.items ?? listed?.orders ?? listed?.data ?? [];
      setItems(Array.isArray(arr) ? arr.map((x: any) => (x?.order ?? x)) : []);
    } catch (e: any) {
      setErr(e?.message || "Erreur list");
    } finally {
      setBusy(false);
    }
  };

  const deliver = async (o: any) => {
    const id = extractOrderId(o) || o?.id;
    if (!id) return Alert.alert("Erreur", "ID introuvable");
    setBusy(true);
    try {
      await postJSON<any>("/api/v1/orders/demo/status", { id, orderId: id, status: "DELIVERED" });
      await load();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Erreur status");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!auto) return;
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => load().catch(() => {}), 2500) as any;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
      timerRef.current = null;
    };
  }, [auto]);

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: "Missions (démo)" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></Pressable>
          <Text style={styles.h1}>Thieyp • Courier</Text>
        </View>

        <Text style={styles.muted}>API: {API_BASE}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Missions READY</Text>

          <View style={styles.row}>
            <Pressable onPress={() => setAuto((v) => !v)} style={[styles.smallBtn, auto && styles.smallBtnOn]}>
              <Text style={styles.smallBtnTxt}>Auto: {auto ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable onPress={load} style={styles.smallBtn}>
              <Text style={styles.smallBtnTxt}>Rafraîchir</Text>
            </Pressable>
          </View>

          {!!err && <Text style={styles.err}>⚠ {err}</Text>}
        </View>

        {busy && <View style={styles.loading}><ActivityIndicator /><Text style={styles.muted}>chargement…</Text></View>}

        {items.length === 0 ? (
          <View style={styles.empty}><Text style={styles.muted}>Aucune mission READY.</Text></View>
        ) : (
          items.map((o) => {
            const id = extractOrderId(o) || o?.id || "—";
            return (
              <View key={id} style={styles.orderCard}>
                <Text style={styles.orderTitle}>Mission {id}</Text>
                <Text style={styles.kv}><Text style={styles.k}>status:</Text> <Text style={styles.v}>{(o?.status || "READY").toUpperCase()}</Text></Text>

                <Pressable disabled={busy} onPress={() => deliver(o)} style={[styles.btn, busy && styles.btnDisabled]}>
                  <Text style={styles.btnTxt}>Marquer LIVRÉE</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#070B12" },
  container: { padding: 16, paddingBottom: 40, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  backTxt: { color: "white", fontSize: 18, fontWeight: "700" },
  h1: { color: "white", fontSize: 26, fontWeight: "800" },
  muted: { color: "rgba(255,255,255,0.65)" },
  card: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)" },
  smallBtnOn: { backgroundColor: "rgba(59,130,246,0.20)" },
  smallBtnTxt: { color: "white", fontWeight: "700" },
  err: { color: "#fb7185", fontWeight: "800" },
  loading: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  empty: { padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)" },
  orderCard: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  orderTitle: { color: "white", fontSize: 16, fontWeight: "900" },
  kv: { color: "white", fontSize: 14 },
  k: { color: "rgba(255,255,255,0.65)" },
  v: { color: "white", fontWeight: "800" },
  btn: { backgroundColor: "#60a5fa", paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: "#061120", fontWeight: "900" },
};
'.trim();

# write files (replace placeholder token)
__write () {
  local path="$1"
  local content="$2"
  local tmp="${path}.tmp"

  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]]; then
    cp -a "$path" "$BACKUP_DIR/$(echo "$path" | sed 's#/#__#g')"
  fi
  printf "%s\n" "$content" > "$tmp"
  mv "$tmp" "$path"
  echo "WROTE: $path"
}

__write "$CLIENT_PATH" "$CLIENT_CONTENT"
__write "$MERCHANT_PATH" "$MERCHANT_CONTENT"
__write "$COURIER_PATH" "$COURIER_CONTENT"

echo
echo "Backups: $BACKUP_DIR"
echo "✅ Done."
