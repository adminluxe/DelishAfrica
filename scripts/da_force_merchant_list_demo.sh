#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
TARGET="$APP/app/orders.tsx"

mkdir -p "$ROOT/tonton_backups/merchant_patch"
cp -a "$TARGET" "$ROOT/tonton_backups/merchant_patch/orders_backup.$(date +%s).tsx"

cat > "$TARGET" << 'EOF'
import React, { useEffect, useState } from "react";
import { Text, Pressable, ScrollView, View } from "react-native";

const API_BASE = "https://api.delishafrica.me";
const PARTNER_SLUG = "thieyp";

export default function MerchantOrdersList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusLine, setStatusLine] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  async function fetchOrders() {
    setStatusLine("Loading...");
    try {
      const res = await fetch(`${API_BASE}/api/v1/orders/demo/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerSlug: PARTNER_SLUG }),
      });
      const text = await res.text();
      setStatusLine(`HTTP ${res.status} | bodyLen=${text.length}`);
      let json = null;
      try { json = JSON.parse(text); } catch {}
      const list = json?.orders ?? [];
      setOrders(list);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {
      setStatusLine("ERR " + String(e));
      setOrders([]);
    }
  }

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Commandes</Text>
      <Text style={{ marginTop: 8 }}>{statusLine}</Text>
      <Text style={{ marginBottom: 10 }}>Dernier refresh: {lastRefresh}</Text>

      <Pressable
        onPress={fetchOrders}
        style={{ padding: 10, backgroundColor: "#3182ce", borderRadius: 8, marginBottom: 12 }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Rafraîchir</Text>
      </Pressable>

      {orders.length === 0 ? (
        <Text>Aucune commande trouvée</Text>
      ) : (
        orders.map((o, i) => (
          <View key={i} style={{ padding: 12, borderWidth: 1, marginBottom: 10 }}>
            <Text>ID: {o.id}</Text>
            <Text>Partner: {o.partnerSlug}</Text>
            <Text>Status: {o.status}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
EOF

echo "✅ Merchant list screen patched!"
