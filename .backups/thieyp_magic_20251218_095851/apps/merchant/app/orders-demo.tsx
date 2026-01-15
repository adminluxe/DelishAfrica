import React, { useEffect, useRef, useState } from "react";
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

export default function OrdersDemoMerchant() {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const timerRef = useRef<any>(null);

  const load = async () => {
    setBusy(true); setErr(null);
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
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => load().catch(() => {}), 2500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
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
            <Pressable onPress={() => setAuto(v => !v)} style={[styles.smallBtn, auto && styles.smallBtnOn]}>
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
        ) : pending.map((o) => {
          const id = extractOrderId(o) || o?.id || "—";
          const st = (o?.status || "—").toUpperCase();
          const canReady = st !== "READY" && st !== "DELIVERED";
          return (
            <View key={id} style={styles.orderCard}>
              <Text style={styles.orderTitle}>Commande {id}</Text>
              <Text style={styles.kv}><Text style={styles.k}>status:</Text> <StatusPill status={st} /></Text>
              <Pressable disabled={!canReady || busy} onPress={() => markReady(o)} style={[styles.btn, (!canReady || busy) && styles.btnDisabled]}>
                <Text style={styles.btnTxt}>Marquer PRÊT</Text>
              </Pressable>
            </View>
          );
        })}
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
  btn: { backgroundColor: "#f59e0b", paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: "#120A02", fontWeight: "900" },

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
