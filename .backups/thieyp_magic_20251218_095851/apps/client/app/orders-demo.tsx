import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router } from "expo-router";


// DA_MAGIC_V2_START
type DemoRole = "client" | "merchant" | "courier";

function normalizeStatus(s: any): string {
  const v = String(s ?? "").trim().toUpperCase();
  if (!v) return "UNKNOWN";
  // normalisations courantes
  if (v === "LIVREE" || v === "LIVRÉE") return "DELIVERED";
  if (v === "PRET" || v === "PRÊT") return "READY";
  return v;
}
function isReady(s: string) {
  return ["READY", "READY_FOR_PICKUP"].includes(s);
}
function isDelivered(s: string) {
  return ["DELIVERED", "COMPLETED"].includes(s);
}
function statusLabelFr(sAny: any): string {
  const s = normalizeStatus(sAny);
  if (isDelivered(s)) return "LIVRÉE";
  if (s === "OUT_FOR_DELIVERY" || s === "PICKED_UP") return "EN LIVRAISON";
  if (isReady(s)) return "PRÊT";
  if (s === "PREPARING" || s === "ACCEPTED") return "EN PRÉPARATION";
  if (s === "PENDING" || s === "NEW" || s === "CREATED") return "EN ATTENTE";
  if (s === "CANCELLED" || s === "FAILED") return "PROBLÈME";
  return s.replace(/_/g, " ");
}
function statusTone(sAny: any): "pending" | "ready" | "delivered" | "error" | "neutral" {
  const s = normalizeStatus(sAny);
  if (s === "CANCELLED" || s === "FAILED") return "error";
  if (isDelivered(s)) return "delivered";
  if (isReady(s)) return "ready";
  if (["PENDING","NEW","CREATED","PREPARING","ACCEPTED","OUT_FOR_DELIVERY","PICKED_UP"].includes(s)) return "pending";
  return "neutral";
}

function getPrimaryLabel(role: DemoRole, statusAny: any, orderIdAny: any): string {
  const s = normalizeStatus(statusAny);
  const hasId = !!orderIdAny;

  if (!hasId) return role === "client" ? "Créer commande (démo)" : "Aucune commande";

  if (role === "merchant") {
    if (isDelivered(s)) return "Commande livrée";
    if (isReady(s)) return "Déjà PRÊT";
    return "Marquer PRÊT";
  }
  if (role === "courier") {
    if (isDelivered(s)) return "Déjà LIVRÉE";
    if (isReady(s)) return "Marquer LIVRÉE";
    return "En attente (PRÊT requis)";
  }

  // client
  if (isDelivered(s)) return "Commande livrée ✓";
  return "Rafraîchir";
}

function getPrimaryDisabled(role: DemoRole, statusAny: any, orderIdAny: any): boolean {
  const s = normalizeStatus(statusAny);
  const hasId = !!orderIdAny;

  if (role === "client") return false;
  if (!hasId) return true;

  if (role === "merchant") return isReady(s) || isDelivered(s);
  if (role === "courier") return !isReady(s) || isDelivered(s);

  return true;
}

function StatusPill({ status }: { status: any }) {
  const tone = statusTone(status);
  const label = statusLabelFr(status);
  const toneStyle =
    tone === "ready"
      ? styles.statusPill_ready
      : tone === "delivered"
      ? styles.statusPill_delivered
      : tone === "error"
      ? styles.statusPill_error
      : tone === "pending"
      ? styles.statusPill_pending
      : styles.statusPill_neutral;

  return (
    <View style={[styles.statusPill, toneStyle]}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

function SmartNeonButton(props: {
  onPress?: any;
  disabled?: boolean;
  children?: any;
  style?: any;
}) {
  const { onPress, disabled, children, style } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled}
      style={[styles.smartBtn, !!disabled && styles.smartBtnDisabled, style]}
    >
      <Text style={styles.smartBtnText}>{children}</Text>
    </Pressable>
  );
}
// DA_MAGIC_V2_START_END


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
  const pollRef = useRef<any>(null);

  const refreshHealth = async () => {
    try { setPingMs(await getHealthMs()); } catch { setPingMs(null); }
  };

  const fetchOrder = async (id: string) => {
    try {
      const got = await postJSON<any>("/api/v1/orders/demo/get", { id, orderId: id });
      const o = got?.order ?? got?.data ?? got;
      if (o) setOrder(o);
      return;
    } catch {
      const listed = await postJSON<any>("/api/v1/orders/demo/list", { partnerSlug: PARTNER_SLUG });
      const items = listed?.items ?? listed?.orders ?? listed?.data ?? [];
      const found = Array.isArray(items) ? items.find((x: any) => (x?.id === id || x?.order?.id === id)) : null;
      if (found) setOrder(found?.order ?? found);
    }
  };

  const createOrder = async () => {
    setBusy(true); setErr(null);
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

  useEffect(() => { refreshHealth(); }, []);

  useEffect(() => {
    if (!autoFollow || !orderId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { fetchOrder(orderId).catch(() => {}); }, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); pollRef.current = null; };
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
          <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backTxt}>←</Text></Pressable>
          <Text style={styles.h1}>Thieyp • Client</Text>
        </View>

        <View style={[styles.badge, badge.style]}><Text style={styles.badgeTxt}>{badge.text}</Text></View>
        <Text style={styles.muted}>API: {API_BASE}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Créer & suivre une commande</Text>

          <Pressable disabled={busy} onPress={createOrder} style={[styles.btn, busy && styles.btnDisabled]}>
            {busy ? <ActivityIndicator /> : <Text style={styles.btnTxt}>Créer une commande Thieyp</Text>}
          </Pressable>

          <View style={styles.row}>
            <Pressable onPress={() => setAutoFollow(v => !v)} style={[styles.smallBtn, autoFollow && styles.smallBtnOn]}>
              <Text style={styles.smallBtnTxt}>Suivi auto: {autoFollow ? "ON" : "OFF"}</Text>
            </Pressable>

            <Pressable disabled={!orderId} onPress={() => orderId && fetchOrder(orderId)} style={[styles.smallBtn, !orderId && styles.smallBtnDisabled]}>
              <Text style={styles.smallBtnTxt}>Rafraîchir</Text>
            </Pressable>

            <Pressable onPress={() => { setOrderId(null); setOrder(null); setErr(null); }} style={styles.smallBtn}>
              <Text style={styles.smallBtnTxt}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.sep} />
          <Text style={styles.kv}><Text style={styles.k}>orderId:</Text> <Text style={styles.v}>{orderId ?? "—"}</Text></Text>
          <Text style={styles.kv}><Text style={styles.k}>status:</Text> <StatusPill status={status} /></Text>
          {!!err && <Text style={styles.err}>⚠ {err}</Text>}
          <View style={styles.sep} />
          <Text style={styles.mutedSmall}>Astuce : Merchant → PRÊT, puis Courier → LIVRÉE.</Text>
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

  // --- DA Magic V2
  statusPill: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  statusPillText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },

  statusPill_pending: {
    borderColor: "rgba(255, 184, 0, 0.9)",
    shadowColor: "rgba(255, 184, 0, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 4,
  },
  statusPill_ready: {
    borderColor: "rgba(34, 211, 238, 0.95)",
    shadowColor: "rgba(34, 211, 238, 1)",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 5,
  },
  statusPill_delivered: {
    borderColor: "rgba(34, 197, 94, 0.95)",
    shadowColor: "rgba(34, 197, 94, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 5,
  },
  statusPill_error: {
    borderColor: "rgba(239, 68, 68, 0.95)",
    shadowColor: "rgba(239, 68, 68, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 5,
  },
  statusPill_neutral: {
    borderColor: "rgba(148, 163, 184, 0.7)",
    shadowColor: "rgba(148, 163, 184, 1)",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 2,
  },

  smartBtn: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.75)",
    backgroundColor: "rgba(34, 211, 238, 0.10)",
    shadowColor: "rgba(34, 211, 238, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 4,
    alignItems: "center",
  },
  smartBtnDisabled: { opacity: 0.45 },
  smartBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.6 },

});
