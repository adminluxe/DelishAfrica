#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/tonton_backups/merchant_orders_patch_$TS"
LOG="$ROOT/tonton_logs/merchant_orders_patch_$TS.log"
mkdir -p "$BK" "$(dirname "$LOG")"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

log "=== PATCH MERCHANT ORDERS SCREENS (multi-target) ==="
log "APP=$APP"
log "BK=$BK"
log "LOG=$LOG"

cd "$APP"

# Cibles probables (déduites de ton repo + nos détections)
TARGETS=(
  "app/orders-demo.tsx"
  "app/order.tsx"
  "app/thieyp-demo.tsx"
  "components/DemoFab.tsx"
)

PATCHED=0

for rel in "${TARGETS[@]}"; do
  file="$APP/$rel"
  if [[ -f "$file" ]]; then
    log "-> Found: $rel"
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$file" "$BK/$rel.bak"
    log "   Backup: $BK/$rel.bak"

    # On remplace par un écran DEBUG ultra fiable.
    # - POST /api/v1/orders/demo/list
    # - partnerSlug="thieyp"
    # - Logs status + bodyLen
    cat > "$file" <<'EOF'
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

function pickApiBase() {
  // Expo env (si dispo) sinon prod
  const anyEnv = (globalThis as any)?.process?.env || {};
  return (
    anyEnv.EXPO_PUBLIC_API_BASE_URL ||
    anyEnv.API_BASE ||
    "https://api.delishafrica.me"
  );
}

export default function OrdersDebugScreen() {
  const API_BASE = useMemo(() => pickApiBase(), []);
  const PARTNER_SLUG = "thieyp";

  const [auto, setAuto] = useState(true);
  const [lastRefresh, setLastRefresh] = useState("");
  const [statusLine, setStatusLine] = useState("");
  const [orders, setOrders] = useState<any[]>([]);

  const fetchOrders = async () => {
    try {
      setStatusLine("Loading...");
      const url = `${API_BASE}/api/v1/orders/demo/list`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerSlug: PARTNER_SLUG }),
      });

      const text = await res.text();
      setStatusLine(`HTTP ${res.status} | bodyLen=${text.length}`);

      let json: any = null;
      try { json = JSON.parse(text); } catch {}

      const list = json?.orders ?? [];
      setOrders(Array.isArray(list) ? list : []);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e: any) {
      setStatusLine("ERR: " + String(e?.message || e));
      setOrders([]);
    }
  };

  useEffect(() => {
    fetchOrders();
    if (!auto) return;
    const id = setInterval(fetchOrders, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const first = orders?.[0];

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 6 }}>
        Commandes (DEBUG)
      </Text>

      <Text style={{ opacity: 0.8, marginBottom: 8 }}>
        API: {API_BASE}
      </Text>

      <View style={{ padding: 12, borderWidth: 1, borderRadius: 12, marginBottom: 12 }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>
          File de production • {orders.length} en attente
        </Text>
        <Text style={{ opacity: 0.8, marginBottom: 6 }}>
          {statusLine || "—"}
        </Text>
        <Text style={{ opacity: 0.6 }}>
          Dernier refresh: {lastRefresh || "—"}
        </Text>

        <View style={{ flexDirection: "row", gap: 10 as any, marginTop: 10 }}>
          <Pressable
            onPress={() => setAuto((v) => !v)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: auto ? "#1b3f8f" : "#333",
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              Auto: {auto ? "ON" : "OFF"}
            </Text>
          </Pressable>

          <Pressable
            onPress={fetchOrders}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: "#2a2a2a",
              borderRadius: 999,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              Rafraîchir
            </Text>
          </Pressable>
        </View>
      </View>

      {orders.length === 0 ? (
        <Text style={{ opacity: 0.65 }}>Aucune commande en attente.</Text>
      ) : (
        <>
          <Pressable
            onPress={() =>
              Alert.alert(
                "List (preview)",
                JSON.stringify({ ok: true, orders: orders.slice(0, 5) }, null, 2)
              )
            }
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: "#0b6b3a",
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "white", fontWeight: "800", textAlign: "center" }}>
              Ouvrir preview (top 5)
            </Text>
          </Pressable>

          <View style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>
              First order
            </Text>
            <Text>id: {String(first?.id || "—")}</Text>
            <Text>partner: {String(first?.partnerSlug || "—")}</Text>
            <Text>status: {String(first?.status || "—")}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
EOF

    PATCHED=$((PATCHED+1))
    log "   Patched: $rel"
  else
    log "-> Skip missing: $rel"
  fi
done

log "DONE. patched_count=$PATCHED"
log "Next: hard restart Merchant (new QR) + rescan iPhone."
