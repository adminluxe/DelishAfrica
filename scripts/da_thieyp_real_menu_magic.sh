#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backups/thieyp_magic_$TS"

die() { echo "❌ $*" >&2; exit 1; }
ok() { echo "✅ $*"; }
info() { echo "ℹ️  $*"; }

[ -d "$ROOT/apps/client" ] || die "Repo root introuvable: $ROOT/apps/client"

mkdir -p "$BACKUP_DIR"

backup_file() {
  local f="$1"
  if [ -f "$f" ]; then
    local rel="${f#$ROOT/}"
    mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
    cp -a "$f" "$BACKUP_DIR/$rel"
  fi
}

write_file() {
  local f="$1"
  backup_file "$f"
  mkdir -p "$(dirname "$f")"
  cat > "$f"
  ok "Wrote $(realpath "$f")"
}

# ---------- 1) DATA: Thieyp (menu réel depuis tes captures) ----------
THIEYP_MENU_TS_CONTENT=$(cat <<'TS'
export type ThieypDay =
  | "Lundi"
  | "Mardi"
  | "Mercredi"
  | "Jeudi"
  | "Vendredi"
  | "Samedi";

export type ThieypMenuItem = {
  sku: string;
  day?: ThieypDay;
  name: string;
  priceEUR: number;
  tags?: string[];
};

export const THIEYP_PARTNER = {
  slug: "thieyp",
  name: "Thieyp",
  address: "Rue Longue Vie 46, 1050 Ixelles",
  phone: "+32 493 39 27 37",
  website: "https://www.thieyp.be",
  instagram: "thieypbruxelles",
  hours: "Lun–Sam 12:00–14:30 • 18:00–22:00",
  currency: "EUR",
} as const;

/**
 * Source: photos menu Thieyp (carte/menu papier).
 * Note: on garde volontairement les libellés exacts (accents / orthographe) tels qu’affichés.
 */
export const THIEYP_MENU = {
  updatedAt: "2025-12-18",
  note: "Carte limitée pour assurer la plus grande fraîcheur des plats.",
  entreeDuJour: { minEUR: 10.5, maxEUR: 12.5 },
  dessertDuJour: { minEUR: 8.5, maxEUR: 10.5 },
  jusFraisNaturelsEUR: 4.9,
  items: [
    // Lundi
    { sku: "thieyp-mon-001", day: "Lundi", name: "Rice and Peace", priceEUR: 21.9, tags: ["Plat du jour"] },
    { sku: "thieyp-mon-002", day: "Lundi", name: "Attiéké au poisson", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Mardi
    { sku: "thieyp-tue-001", day: "Mardi", name: "Thiéboudieune", priceEUR: 21.9, tags: ["Plat du jour"] },
    { sku: "thieyp-tue-002", day: "Mardi", name: "Mafè à la viande (jarret)", priceEUR: 29.9, tags: ["Plat du jour"] },

    // Mercredi
    { sku: "thieyp-wed-001", day: "Mercredi", name: "Yassa aux crevettes", priceEUR: 22.9, tags: ["Plat du jour"] },
    { sku: "thieyp-wed-002", day: "Mercredi", name: "Attiéké au poulet", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Jeudi
    { sku: "thieyp-thu-001", day: "Jeudi", name: "Foutou banane sauce graine", priceEUR: 22.9, tags: ["Plat du jour"] },
    { sku: "thieyp-thu-002", day: "Jeudi", name: "Thiou boulettes de poisson", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Vendredi
    { sku: "thieyp-fri-001", day: "Vendredi", name: "Yassa au poulet", priceEUR: 21.9, tags: ["Plat du jour"] },
    { sku: "thieyp-fri-002", day: "Vendredi", name: "Thiéboudieune", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Samedi
    { sku: "thieyp-sat-001", day: "Samedi", name: "Dibi et allocos", priceEUR: 22.9, tags: ["Plat du jour"] },
    { sku: "thieyp-sat-002", day: "Samedi", name: "Acras de morue et allocos", priceEUR: 21.9, tags: ["Plat du jour"] },

    // Extras
    { sku: "thieyp-x-veg-001", name: "Plat végétarien (sur demande)", priceEUR: 21.9, tags: ["Sur demande"] },
    { sku: "thieyp-x-jus-001", name: "Jus frais naturels (hibiscus / gingembre / baobab)", priceEUR: 4.9, tags: ["Boisson"] },
  ] as ThieypMenuItem[],
} as const;

export function formatEUR(v: number): string {
  // Affichage FR simple, sans dépendance Intl (évite surprises RN)
  return `${v.toFixed(2).replace(".", ",")} €`;
}

export function todayFR(): ThieypDay | null {
  const d = new Date();
  // JS: 0=Dim ... 6=Sam
  const map: Record<number, ThieypDay | null> = {
    0: null,
    1: "Lundi",
    2: "Mardi",
    3: "Mercredi",
    4: "Jeudi",
    5: "Vendredi",
    6: "Samedi",
  };
  return map[d.getDay()] ?? null;
}

export function todayItems(): ThieypMenuItem[] {
  const t = todayFR();
  if (!t) return [];
  return THIEYP_MENU.items.filter((x) => x.day === t);
}
TS
)

# ---------- 2) UI: SnowOverlay (neige/confettis d’hiver) ----------
SNOW_OVERLAY_TSX=$(cat <<'TSX'
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

type Props = {
  visible: boolean;
  intensity?: number; // nombre de flocons
};

export default function SnowOverlay({ visible, intensity = 18 }: Props) {
  const { width, height } = Dimensions.get("window");

  const flakes = useMemo(() => {
    return Array.from({ length: intensity }).map((_, i) => {
      const size = 2 + Math.random() * 3.5;
      return {
        key: `flake_${i}`,
        x: Math.random() * Math.max(1, width - 10),
        size,
        delay: Math.floor(Math.random() * 1600),
        duration: 4200 + Math.floor(Math.random() * 2600),
        drift: (Math.random() - 0.5) * 40,
        opacity: 0.55 + Math.random() * 0.35,
      };
    });
  }, [intensity, width]);

  const anims = useRef(flakes.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;

    const loops = anims.map((a, idx) => {
      a.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(flakes[idx].delay),
          Animated.timing(a, {
            toValue: 1,
            duration: flakes[idx].duration,
            useNativeDriver: true,
          }),
        ])
      );
    });

    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flakes.map((f, idx) => {
        const translateY = anims[idx].interpolate({
          inputRange: [0, 1],
          outputRange: [-20, height + 40],
        });

        const translateX = anims[idx].interpolate({
          inputRange: [0, 1],
          outputRange: [f.x, f.x + f.drift],
        });

        return (
          <Animated.View
            key={f.key}
            style={[
              styles.flake,
              {
                width: f.size,
                height: f.size,
                borderRadius: f.size / 2,
                opacity: f.opacity,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flake: {
    position: "absolute",
    top: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
});
TSX
)

# ---------- 3) Screens: orders-demo.tsx (Client / Merchant / Courier) ----------
# Notes:
# - On ne change pas les endpoints existants (stabilité).
# - On retire le wording "démo" de l’UI.
# - On rend les boutons intelligents (disabled si status non-éligible).
# - Fallback auto si l’API a le préfixe /api/v1/api (cas déjà vu dans tes logs).

CLIENT_ORDERS_TSX=$(cat <<'TSX'
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
TSX
)

MERCHANT_ORDERS_TSX=$(cat <<'TSX'
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import SnowOverlay from "../src/ui/SnowOverlay";

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

export default function MerchantOrders() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [snow, setSnow] = useState(false);
  const snowTimer = useRef<any>(null);

  function burstSnow() {
    setSnow(true);
    if (snowTimer.current) clearTimeout(snowTimer.current);
    snowTimer.current = setTimeout(() => setSnow(false), 2200);
  }

  const title = useMemo(() => {
    const pending = orders.filter((o) => o.status === "PENDING").length;
    const ready = orders.filter((o) => o.status === "READY").length;
    return `File de production • ${pending} en attente • ${ready} prêt`;
  }, [orders]);

  async function refresh() {
    setError(null);
    try {
      const r = await postWithFallback<{ orders: Order[] }>("/list", {});
      setOrders(Array.isArray(r?.orders) ? r.orders : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function markReady(orderId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await postWithFallback("/status", { orderId, status: "READY" });
      burstSnow();
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => refresh(), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <View style={styles.page}>
      <SnowOverlay visible={snow} intensity={18} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.push("/")} style={styles.backPill}>
          <Text style={styles.backTxt}>‹ index</Text>
        </Pressable>

        <Text style={styles.title}>Commandes</Text>
      </View>

      <View style={styles.apiRow}>
        <Text style={styles.apiUrl}>API: {API_BASE}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.h1}>{title}</Text>
          <View style={styles.row}>
            <Pressable onPress={() => setAuto((v) => !v)} style={[styles.pillBtn, auto ? styles.pillOn : styles.pillOff]}>
              <Text style={styles.pillTxt}>Auto: {auto ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable onPress={refresh} disabled={busy} style={[styles.pillBtn, busy && styles.btnDisabled]}>
              <Text style={styles.pillTxt}>Rafraîchir</Text>
            </Pressable>
          </View>
        </View>

        {orders.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.sub}>Aucune commande pour le moment.</Text>
            {busy ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}
            {error ? <Text style={styles.err}>Erreur: {error}</Text> : null}
          </View>
        ) : null}

        {orders.map((o) => {
          const niceId = o.orderId.replace(/^demo_/, "");
          const canReady = !busy && o.status === "PENDING";
          return (
            <View key={o.orderId} style={styles.card}>
              <Text style={styles.h1}>Commande #{niceId}</Text>

              <View style={styles.kv}>
                <Text style={styles.k}>status:</Text>
                <View style={[styles.badge, statusStyle(o.status)]}>
                  <Text style={styles.badgeTxt}>{statusLabel(o.status)}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => markReady(o.orderId)}
                disabled={!canReady}
                style={[styles.primaryBtn, !canReady && styles.btnDisabled]}
              >
                <Text style={styles.primaryTxt}>{o.status === "READY" ? "Déjà PRÊT" : "Marquer PRÊT"}</Text>
              </Pressable>

              {error ? <Text style={styles.err}>Erreur: {error}</Text> : null}
            </View>
          );
        })}
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

  apiRow: { paddingHorizontal: 16, paddingTop: 10 },
  apiUrl: { color: "rgba(255,255,255,0.55)" },

  card: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 18, padding: 14, marginTop: 14 },
  h1: { color: "white", fontSize: 18, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.65)", marginTop: 6 },

  row: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  pillBtn: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999 },
  pillTxt: { color: "rgba(255,255,255,0.86)", fontWeight: "800" },
  pillOn: { backgroundColor: "rgba(59,130,246,0.25)", borderColor: "rgba(59,130,246,0.35)" },
  pillOff: { backgroundColor: "rgba(255,255,255,0.07)" },

  kv: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  k: { color: "rgba(255,255,255,0.55)", fontWeight: "800", width: 64 },

  badge: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  badgeTxt: { color: "white", fontWeight: "900", letterSpacing: 0.5 },
  badgePending: { backgroundColor: "rgba(245,158,11,0.18)", borderColor: "rgba(245,158,11,0.40)" },
  badgeReady: { backgroundColor: "rgba(34,211,238,0.16)", borderColor: "rgba(34,211,238,0.38)" },
  badgeDelivered: { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.40)" },
  badgeUnknown: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.14)" },

  primaryBtn: { backgroundColor: "rgba(245,158,11,0.85)", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  primaryTxt: { color: "#0c0a06", fontWeight: "900", fontSize: 16 },

  err: { color: "#ff7b7b", marginTop: 10, fontWeight: "900" },
  btnDisabled: { opacity: 0.45 },
});
TSX
)

COURIER_ORDERS_TSX=$(cat <<'TSX'
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import SnowOverlay from "../src/ui/SnowOverlay";

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

export default function CourierMissions() {
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [snow, setSnow] = useState(false);
  const snowTimer = useRef<any>(null);

  function burstSnow() {
    setSnow(true);
    if (snowTimer.current) clearTimeout(snowTimer.current);
    snowTimer.current = setTimeout(() => setSnow(false), 2200);
  }

  const title = useMemo(() => {
    const ready = orders.filter((o) => o.status === "READY").length;
    const delivered = orders.filter((o) => o.status === "DELIVERED").length;
    return `Missions • ${ready} à livrer • ${delivered} livrées`;
  }, [orders]);

  async function refresh() {
    setError(null);
    try {
      const r = await postWithFallback<{ orders: Order[] }>("/list", {});
      setOrders(Array.isArray(r?.orders) ? r.orders : []);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function markDelivered(orderId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await postWithFallback("/status", { orderId, status: "DELIVERED" });
      burstSnow();
      await refresh();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => refresh(), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <View style={styles.page}>
      <SnowOverlay visible={snow} intensity={18} />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.push("/")} style={styles.backPill}>
          <Text style={styles.backTxt}>‹ index</Text>
        </Pressable>

        <Text style={styles.title}>Missions</Text>
      </View>

      <View style={styles.apiRow}>
        <Text style={styles.apiUrl}>API: {API_BASE}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.h1}>{title}</Text>
          <View style={styles.row}>
            <Pressable onPress={() => setAuto((v) => !v)} style={[styles.pillBtn, auto ? styles.pillOn : styles.pillOff]}>
              <Text style={styles.pillTxt}>Auto: {auto ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable onPress={refresh} disabled={busy} style={[styles.pillBtn, busy && styles.btnDisabled]}>
              <Text style={styles.pillTxt}>Rafraîchir</Text>
            </Pressable>
          </View>
        </View>

        {orders.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.sub}>Aucune mission pour le moment.</Text>
            {busy ? <ActivityIndicator style={{ marginTop: 10 }} /> : null}
            {error ? <Text style={styles.err}>Erreur: {error}</Text> : null}
          </View>
        ) : null}

        {orders.map((o) => {
          const niceId = o.orderId.replace(/^demo_/, "");
          const canDeliver = !busy && o.status === "READY"; // bouton intelligent
          return (
            <View key={o.orderId} style={styles.card}>
              <Text style={styles.h1}>Mission #{niceId}</Text>

              <View style={styles.kv}>
                <Text style={styles.k}>status:</Text>
                <View style={[styles.badge, statusStyle(o.status)]}>
                  <Text style={styles.badgeTxt}>{statusLabel(o.status)}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => markDelivered(o.orderId)}
                disabled={!canDeliver}
                style={[styles.primaryBtn, !canDeliver && styles.btnDisabled]}
              >
                <Text style={styles.primaryTxt}>
                  {o.status === "DELIVERED" ? "Déjà LIVRÉE" : "Marquer LIVRÉE"}
                </Text>
              </Pressable>

              {error ? <Text style={styles.err}>Erreur: {error}</Text> : null}
            </View>
          );
        })}
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

  apiRow: { paddingHorizontal: 16, paddingTop: 10 },
  apiUrl: { color: "rgba(255,255,255,0.55)" },

  card: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 18, padding: 14, marginTop: 14 },
  h1: { color: "white", fontSize: 18, fontWeight: "900" },
  sub: { color: "rgba(255,255,255,0.65)", marginTop: 6 },

  row: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  pillBtn: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999 },
  pillTxt: { color: "rgba(255,255,255,0.86)", fontWeight: "800" },
  pillOn: { backgroundColor: "rgba(59,130,246,0.25)", borderColor: "rgba(59,130,246,0.35)" },
  pillOff: { backgroundColor: "rgba(255,255,255,0.07)" },

  kv: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  k: { color: "rgba(255,255,255,0.55)", fontWeight: "800", width: 64 },

  badge: { alignSelf: "flex-start", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  badgeTxt: { color: "white", fontWeight: "900", letterSpacing: 0.5 },
  badgePending: { backgroundColor: "rgba(245,158,11,0.18)", borderColor: "rgba(245,158,11,0.40)" },
  badgeReady: { backgroundColor: "rgba(34,211,238,0.16)", borderColor: "rgba(34,211,238,0.38)" },
  badgeDelivered: { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.40)" },
  badgeUnknown: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.14)" },

  primaryBtn: { backgroundColor: "rgba(59,130,246,0.85)", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  primaryTxt: { color: "#061019", fontWeight: "900", fontSize: 16 },

  err: { color: "#ff7b7b", marginTop: 10, fontWeight: "900" },
  btnDisabled: { opacity: 0.45 },
});
TSX
)

# ---------- 4) APPLY ----------
info "Backups -> $BACKUP_DIR"

for app in client merchant courier; do
  # Data + UI
  write_file "$ROOT/apps/$app/src/data/ThieypMenu.ts" <<<"$THIEYP_MENU_TS_CONTENT"
  write_file "$ROOT/apps/$app/src/ui/SnowOverlay.tsx" <<<"$SNOW_OVERLAY_TSX"
done

# Screens
write_file "$ROOT/apps/client/app/orders-demo.tsx"  <<<"$CLIENT_ORDERS_TSX"
write_file "$ROOT/apps/merchant/app/orders-demo.tsx" <<<"$MERCHANT_ORDERS_TSX"
write_file "$ROOT/apps/courier/app/orders-demo.tsx"  <<<"$COURIER_ORDERS_TSX"

# Optional: enlever "(démo)" sur les boutons index si présent (safe replace, uniquement si exact match)
for app in client merchant courier; do
  IDX="$ROOT/apps/$app/app/index.tsx"
  if [ -f "$IDX" ]; then
    backup_file "$IDX"
    perl -0777 -i -pe 's/\b\((démo|demo)\)\b//g' "$IDX" || true
  fi
done

ok "Thieyp Real Menu + UX Magie (Snow + boutons intelligents) appliqué."
info "Restore rapide si besoin:"
info "  cp -a $BACKUP_DIR/* $ROOT/"
