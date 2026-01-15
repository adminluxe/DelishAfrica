#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$ROOT/.backups/DA_FIX_THIEYP_DEMO_IMPORTS_NOW_$TS"
mkdir -p "$BACKUP_ROOT"

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local rel="${f#$ROOT/}"
  local dest="$BACKUP_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  cp -a "$f" "$dest"
}

write_client_orders() {
  local file="$1"
  cat > "$file" <<'TSX'
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

type Step = "créée" | "préparation" | "pickup" | "livrée";

export default function OrdersScreen() {
  const steps: Step[] = ["créée", "préparation", "pickup", "livrée"];
  const [step, setStep] = useState<Step>("créée");
  const idx = useMemo(() => steps.indexOf(step), [step]);

  const next = () => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 26, fontWeight: "900" }}>
          Commande
        </Text>
        <Text style={{ color: "#9AA6C0", marginTop: 6 }}>
          Restaurant : Thieyp
        </Text>

        <View
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <Text style={{ color: "#9AA6C0", fontSize: 13 }}>
            Statut actuel
          </Text>
          <Text style={{ color: "#39D98A", fontSize: 18, fontWeight: "900", marginTop: 6 }}>
            {step}
          </Text>

          <View style={{ height: 12 }} />

          {steps.map((s, i) => {
            const active = i <= idx;
            return (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    marginRight: 10,
                    backgroundColor: active ? "rgba(57,217,138,0.95)" : "rgba(255,255,255,0.15)",
                  }}
                />
                <Text style={{ color: active ? "#E9EDF7" : "#9AA6C0", fontWeight: "800" }}>
                  {s}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 14 }} />

        <Pressable
          onPress={next}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: "rgba(57,217,138,0.90)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#04110A", fontSize: 16, fontWeight: "900" }}>
            Avancer statut
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={() => setStep("créée")}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.06)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#E9EDF7", fontSize: 16, fontWeight: "800" }}>
            Réinitialiser
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
TSX
}

write_thieyp_entry_no_demo() {
  local file="$1"
  cat > "$file" <<'TSX'
import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";

export default function ThieypScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 28, fontWeight: "900" }}>
          Thieyp
        </Text>
        <Text style={{ color: "#9AA6C0", marginTop: 8, lineHeight: 20 }}>
          Le goût authentique, une UX premium — commande rapide et suivi clair.
        </Text>

        <View style={{ height: 16 }} />

        <Pressable
          onPress={() => router.push("/orders")}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderRadius: 18,
            backgroundColor: "rgba(57,217,138,0.90)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#04110A", fontSize: 16, fontWeight: "900" }}>
            Commander
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={() => router.back()}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.06)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#E9EDF7", fontSize: 16, fontWeight: "800" }}>
            Retour
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
TSX
}

echo "=============================================="
echo "🔥 DA_FIX_THIEYP_DEMO_IMPORTS_NOW"
echo "Backup: $BACKUP_ROOT"
echo "=============================================="

# --- CLIENT ---
CLIENT_APP="$ROOT/apps/client/app"
CLIENT_ORDERS="$CLIENT_APP/orders.tsx"
CLIENT_THIEYP_DEMO="$CLIENT_APP/thieyp-demo.tsx"

echo
echo "✅ CLIENT: create/overwrite /orders route"
backup_file "$CLIENT_ORDERS"
write_client_orders "$CLIENT_ORDERS"

if [ -f "$CLIENT_THIEYP_DEMO" ]; then
  echo "✅ CLIENT: overwrite thieyp-demo.tsx -> clean Thieyp entry (no demo, no broken import)"
  backup_file "$CLIENT_THIEYP_DEMO"
  write_thieyp_entry_no_demo "$CLIENT_THIEYP_DEMO"
fi

# --- COURIER ---
COURIER_APP="$ROOT/apps/courier/app"
COURIER_THIEYP_DEMO="$COURIER_APP/thieyp-demo.tsx"
COURIER_ORDERS="$COURIER_APP/orders.tsx"

echo
echo "✅ COURIER: create lightweight /orders route (safe)"
backup_file "$COURIER_ORDERS"
write_client_orders "$COURIER_ORDERS"

if [ -f "$COURIER_THIEYP_DEMO" ]; then
  echo "✅ COURIER: overwrite thieyp-demo.tsx -> clean Thieyp entry (no demo, no broken import)"
  backup_file "$COURIER_THIEYP_DEMO"
  write_thieyp_entry_no_demo "$COURIER_THIEYP_DEMO"
fi

echo
echo "✅ Clean caches"
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
rm -rf "$ROOT/apps/client/.expo" "$ROOT/apps/client/.turbo" "$ROOT/apps/client/node_modules/.cache" 2>/dev/null || true
rm -rf "$ROOT/apps/courier/.expo" "$ROOT/apps/courier/.turbo" "$ROOT/apps/courier/node_modules/.cache" 2>/dev/null || true

echo
echo "✅ DONE. Backups: $BACKUP_ROOT"
echo
echo "Restart metros:"
echo "  CLIENT : cd $ROOT/apps/client  && pnpm dev -- --tunnel --port 8081 --clear"
echo "  COURIER: cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear"
