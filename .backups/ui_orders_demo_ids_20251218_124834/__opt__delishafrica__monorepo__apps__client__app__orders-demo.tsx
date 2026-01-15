import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import SnowOverlay from "../src/ui/SnowOverlay";
import { THIEYP_MENU, THIEYP_PARTNER, formatEUR, todayFR, todayItems } from "../src/data/ThieypMenu";

type OrderStatus = "PENDING" | "READY" | "DELIVERED" | "UNKNOWN";
type Order = { orderId: string; status: OrderStatus; items?: any[] };

const API_BASE =
  (process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API ||
    "https://api.delishafrica.me"
  ).replace(/\/$/, "");

const BASES = ["/api/v1/orders/demo", "/api/v1/api/orders/demo"] as const;

async function postWithFallback<T>(path: string, body?: any): Promise<T> {
  let lastErr: any = null;
  for (const b of BASES) {
    try {
      const res = await fetch(`${API_BASE}${b}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("API unreachable");
}

function statusLabel(s: OrderStatus): string {
  if (s === "PENDING") return "EN ATTENTE";
  if (s === "READY") return "PRÊT";
  if (s === "DELIVERED") return "LIVRÉE";
  return "INCONNU";
}

function statusStyle(s: OrderStatus) {
  if (s === "PENDING") return styles.badgePending;
  if (s === "READY") return styles.badgeReady;
  if (s === "DELIVERED") return styles.badgeDelivered;
  return styles.badgeUnknown;
}

export default function OrdersScreen() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus>("UNKNOWN");
  const [apiMs, setApiMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [snow, setSnow] = useState(false);
  const snowTimer = useRef<any>(null);

  const today = todayFR();
  const todayMenu = todayItems();

  const niceId = useMemo(() => (orderId ? orderId.replace(/^demo_/, "") : ""), [orderId]);

  function burstSnow() {
    setSnow(true);
    if (snowTimer.current) clearTimeout(snowTimer.current);
    snowTimer.current = setTimeout(() => setSnow(false), 2600);
  }

  async function health() {
    const t0 = Date.now();
    try {
      await postWithFallback("/health", {});
      setApiMs(Date.now() - t0);
    } catch {
      setApiMs(null);
    }
  }

  async function refresh() {
    setError(null);
    try {
      if (!orderId) {
        await health();
        return;
      }
      const r = await postWithFallback<{ orderId: string; status: OrderStatus }>("/get", { orderId });
      setStatus(r.status ?? "UNKNOWN");
      await health();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function createOrder() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const chosen =
        (todayMenu[0] ?? THIEYP_MENU.items.find((x) => x.day === "Vendredi") ?? THIEYP_MENU.items[0])!;

      const payload = {
        partnerSlug: THIEYP_PARTNER.slug,
        partnerName: THIEYP_PARTNER.name,
        currency: "EUR",
        items: [
          {
            sku: chosen.sku,
            name: chosen.name,
            priceEUR: chosen.priceEUR,
            qty: 1,
          },
        ],
      };

      const r = await postWithFallback<{ orderId: string; status: OrderStatus }>("/create", payload);
      setOrderId(r.orderId);
      setStatus(r.status ?? "PENDING");
      burstSnow();
      await health();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await postWithFallback("/reset", {});
      setOrderId(null);
      setStatus("UNKNOWN");
      burstSnow();
      await health();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    health();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => refresh(), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, orderId]);

  useEffect(() => {
    if (status === "DELIVERED") burstSnow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const canCreate = !busy && !orderId;
  const canReset = !busy;

  return (
    <View style={styles.page}>
      <SnowOverlay visible={snow} intensity={22} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.push("/")} style={styles.backPill}>
          <Text style={styles.backTxt}>‹ index</Text>
        </Pressable>

        <Text style={styles.title}>Commande</Text>
      </View>

      <View style={styles.apiRow}>
        <View style={[styles.apiPill, apiMs ? styles.apiOk : styles.apiKo]}>
          <Text style={styles.apiTxt}>
            API: {apiMs ? `OK • ${apiMs}ms` : "…"}
          </Text>
        </View>
        <Text style={styles.apiUrl}>API: {API_BASE}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.h1}>Thieyp • Menu du jour</Text>
          <Text style={styles.sub}>
            {today ? `${today}` : "Aujourd’hui : menu non défini (dimanche)"} • Entrée {THIEYP_MENU.entreeDuJour.minEUR.toFixed(2).replace(".", ",")}–{THIEYP_MENU.entreeDuJour.maxEUR.toFixed(2).replace(".", ",")} €
          </Text>

          <View style={{ marginTop: 10 }}>
            {(todayMenu.length ? todayMenu : THIEYP_MENU.items.filter((x) => x.day)).slice(0, 6).map((it) => (
              <View key={it.sku} style={styles.menuRow}>
                <Text style={styles.menuName}>{it.name}</Text>
                <Text style={styles.menuPrice}>{formatEUR(it.priceEUR)}</Text>
              </View>
            ))}
            <View style={styles.div} />
            <View style={styles.menuRow}>
              <Text style={styles.menuName}>Jus frais naturels (hibiscus / gingembre / baobab)</Text>
              <Text style={styles.menuPrice}>{formatEUR(THIEYP_MENU.jusFraisNaturelsEUR)}</Text>
            </View>
          </View>

          <View style={styles.partnerBox}>
            <Text style={styles.partnerLine}>{THIEYP_PARTNER.address}</Text>
            <Text style={styles.partnerLine}>{THIEYP_PARTNER.hours}</Text>
            <Text style={styles.partnerLine}>{THIEYP_PARTNER.phone} • {THIEYP_PARTNER.website}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.h1}>Créer & suivre une commande</Text>

          <Pressable
            onPress={createOrder}
            disabled={!canCreate}
            style={[styles.primaryBtn, !canCreate && styles.btnDisabled]}
          >
            {busy ? <ActivityIndicator /> : <Text style={styles.primaryTxt}>Créer une commande Thieyp</Text>}
          </Pressable>

          <View style={styles.row}>
            <Pressable
              onPress={() => setAuto((v) => !v)}
              style={[styles.pillBtn, auto ? styles.pillOn : styles.pillOff]}
            >
              <Text style={styles.pillTxt}>Suivi auto: {auto ? "ON" : "OFF"}</Text>
            </Pressable>

            <Pressable onPress={refresh} disabled={busy} style={[styles.pillBtn, busy && styles.btnDisabled]}>
              <Text style={styles.pillTxt}>Rafraîchir</Text>
            </Pressable>

            <Pressable onPress={reset} disabled={!canReset} style={[styles.pillBtn, !canReset && styles.btnDisabled]}>
              <Text style={styles.pillTxt}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.div} />

          <View style={styles.kv}>
            <Text style={styles.k}>orderId:</Text>
            <Text style={styles.v}>{niceId ? `#${niceId}` : "—"}</Text>
          </View>

          <View style={styles.kv}>
            <Text style={styles.k}>status:</Text>
            <View style={[styles.badge, statusStyle(status)]}>
              <Text style={styles.badgeTxt}>{statusLabel(status)}</Text>
            </View>
          </View>

          <Text style={styles.hint}>
            Astuce : Merchant → PRÊT, puis Courier → LIVRÉE.
          </Text>

          {error ? <Text style={styles.err}>Erreur: {error}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#070B12" },
  scroll: { padding: 16, paddingBottom: 40 },

  topBar: { paddingTop: 54, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  backPill: { backgroundColor: "rgba(255,255,255,0.08)", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  backTxt: { color: "rgba(255,255,255,0.78)", fontWeight: "700" },
  title: { color: "white", fontSize: 28, fontWeight: "900" },

  apiRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  apiPill: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  apiOk: { backgroundColor: "rgba(34,197,94,0.20)", borderWidth: 1, borderColor: "rgba(34,197,94,0.35)" },
  apiKo: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  apiTxt: { color: "rgba(255,255,255,0.9)", fontWeight: "800" },
  apiUrl: { color: "rgba(255,255,255,0.55)" },

  card: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 18, padding: 14, marginTop: 14 },
  h1: { color: "white", fontSize: 18, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.65)", marginTop: 6 },

  menuRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, paddingVertical: 6 },
  menuName: { color: "rgba(255,255,255,0.92)", flex: 1, fontWeight: "700" },
  menuPrice: { color: "rgba(255,255,255,0.82)", fontWeight: "900" },
  partnerBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" },
  partnerLine: { color: "rgba(255,255,255,0.60)", fontWeight: "700", marginTop: 2 },

  primaryBtn: { backgroundColor: "rgba(34,197,94,0.95)", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  primaryTxt: { color: "#06110A", fontWeight: "900", fontSize: 16 },

  row: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  pillBtn: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999 },
  pillTxt: { color: "rgba(255,255,255,0.86)", fontWeight: "800" },
  pillOn: { backgroundColor: "rgba(59,130,246,0.25)", borderColor: "rgba(59,130,246,0.35)" },
  pillOff: { backgroundColor: "rgba(255,255,255,0.07)" },

  div: { height: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 12 },

  kv: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  k: { color: "rgba(255,255,255,0.55)", fontWeight: "800", width: 64 },
  v: { color: "white", fontWeight: "900", fontSize: 16 },

  badge: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  badgeTxt: { color: "white", fontWeight: "900", letterSpacing: 0.5 },
  badgePending: { backgroundColor: "rgba(245,158,11,0.18)", borderColor: "rgba(245,158,11,0.40)" },
  badgeReady: { backgroundColor: "rgba(34,211,238,0.16)", borderColor: "rgba(34,211,238,0.38)" },
  badgeDelivered: { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.40)" },
  badgeUnknown: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.14)" },

  hint: { color: "rgba(255,255,255,0.55)", marginTop: 10, fontWeight: "700" },
  err: { color: "#ff7b7b", marginTop: 10, fontWeight: "900" },

  btnDisabled: { opacity: 0.45 },
});
