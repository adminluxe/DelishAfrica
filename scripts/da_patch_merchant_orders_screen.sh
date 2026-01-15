#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/tonton_backups/merchant_orders_patch_$TS"
LOG_DIR="$ROOT/tonton_logs"
LOG="$LOG_DIR/merchant_orders_patch_${TS}.log"

mkdir -p "$BK" "$LOG_DIR"
log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== PATCH MERCHANT ORDERS SCREEN ==="
log "APP=$APP"
log "BK=$BK"
log "LOG=$LOG"

# 1) Trouver le fichier le plus probable (UI text)
FILE="$(grep -RIl --exclude-dir=node_modules --exclude-dir=.expo --exclude-dir=.git \
  -e "File de production" -e "Aucune commande en attente" -e "Commandes" \
  "$APP/app" "$APP/src" 2>/dev/null | head -n 1 || true)"

if [ -z "${FILE:-}" ]; then
  log "❌ Impossible de trouver l'écran Commandes automatiquement."
  log "Astuce: cherche manuellement dans $APP/app (expo-router) ou $APP/src."
  exit 1
fi

log "✅ Cible: $FILE"
cp -a "$FILE" "$BK/$(basename "$FILE").bak"
log "Backup: $BK/$(basename "$FILE").bak"

# 2) Remplacer le fichier par un écran stable (list + refresh + logs)
cat > "$FILE" <<'EOF'
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

const PARTNER = "thieyp";

function pickApiBase() {
  // Si tu as déjà EXPO_PUBLIC_API_BASE_URL, on l'utilise.
  // Sinon fallback vers prod (ton cas actuel sur les screenshots).
  // @ts-ignore
  const envBase = typeof process !== "undefined" ? process?.env?.EXPO_PUBLIC_API_BASE_URL : undefined;
  return envBase || "https://api.delishafrica.me";
}

export default function OrdersScreen() {
  const API_BASE = useMemo(() => pickApiBase(), []);
  const [auto, setAuto] = useState(true);
  const [last, setLast] = useState<string>("-");
  const [statusLine, setStatusLine] = useState<string>("");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchList() {
    setLoading(true);
    const url = `${API_BASE}/api/v1/orders/demo/list`;
    try {
      const t0 = Date.now();
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partnerSlug: PARTNER }),
      });
      const body = await res.text();
      const ms = Date.now() - t0;

      setStatusLine(`[${new Date().toLocaleTimeString()}] HTTP ${res.status} | ${ms}ms | bodyLen=${body.length}`);
      setLast(new Date().toLocaleTimeString());

      let json: any = null;
      try {
        json = JSON.parse(body);
      } catch {
        json = null;
      }

      const list = json?.orders || json?.data || json?.items || [];
      if (Array.isArray(list)) setOrders(list);
      else setOrders([]);

      // Si ça renvoie bien une liste mais vide => on veut le savoir
      if (!Array.isArray(list)) {
        // eslint-disable-next-line no-console
        console.log("MERCHANT list parse: unexpected shape", { url, bodyPreview: body.slice(0, 400) });
      }
    } catch (e: any) {
      setStatusLine(`ERR: ${String(e?.message || e)}`);
      Alert.alert("Erreur fetch", String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
    // auto refresh
    const id = setInterval(() => {
      if (auto) fetchList();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0B0F14" }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
      <Text style={{ color: "white", fontSize: 38, fontWeight: "800", marginBottom: 8 }}>Commandes</Text>
      <Text style={{ color: "#AAB4C0", marginBottom: 14 }}>API: {API_BASE}</Text>

      <View style={{ backgroundColor: "#111826", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "800", marginBottom: 10 }}>
          File de production • {orders.length} en attente
        </Text>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable
            onPress={() => setAuto((v) => !v)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: auto ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: auto ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Auto: {auto ? "ON" : "OFF"}</Text>
          </Pressable>

          <Pressable
            onPress={fetchList}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>{loading ? "..." : "Rafraîchir"}</Text>
          </Pressable>
        </View>

        <Text style={{ color: "#AAB4C0", marginTop: 10 }}>Dernier refresh: {last}</Text>
        {!!statusLine && <Text style={{ color: "#AAB4C0", marginTop: 6 }}>{statusLine}</Text>}
      </View>

      {orders.length === 0 ? (
        <Text style={{ color: "#AAB4C0" }}>Aucune commande en attente.</Text>
      ) : (
        orders.map((o, idx) => (
          <View key={o?.id || idx} style={{ backgroundColor: "#0F1623", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "white", fontWeight: "800" }}>{o?.id || "order"}</Text>
            <Text style={{ color: "#AAB4C0" }}>partnerSlug: {o?.partnerSlug}</Text>
            <Text style={{ color: "#AAB4C0" }}>status: {o?.status}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
EOF

log "✅ Patch appliqué sur $FILE"
log "Next: relance Merchant ULTRA (clear + nouveau QR)."
