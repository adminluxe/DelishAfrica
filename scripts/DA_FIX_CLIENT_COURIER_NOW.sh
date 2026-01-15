#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$ROOT/.backups/DA_FIX_CLIENT_COURIER_NOW_$TS"
mkdir -p "$BACKUP_ROOT"

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local rel="${f#$ROOT/}"
  local dest="$BACKUP_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  cp -a "$f" "$dest"
}

echo "=============================================="
echo "🔥 DA_FIX_CLIENT_COURIER_NOW"
echo "Backup: $BACKUP_ROOT"
echo "=============================================="

echo
echo "✅ (1) FORCE replace CLIENT partner slug screen"
CLIENT_SLUG="$ROOT/apps/client/app/partner/[slug].tsx"
if [ -f "$CLIENT_SLUG" ]; then
  backup_file "$CLIENT_SLUG"
  cat > "$CLIENT_SLUG" <<'TSX'
import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

export default function PartnerSlugScreen() {
  const params = useLocalSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "partner";

  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 26, fontWeight: "800" }}>
          Partenaire
        </Text>

        <View
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <Text style={{ color: "#9AA6C0", fontSize: 13, marginBottom: 6 }}>
            Identifiant
          </Text>
          <Text style={{ color: "#E9EDF7", fontSize: 18, fontWeight: "700" }}>
            {slug}
          </Text>

          <Text style={{ color: "#9AA6C0", fontSize: 13, marginTop: 12 }}>
            Statut
          </Text>
          <Text
            style={{
              color: "#39D98A",
              fontSize: 16,
              fontWeight: "700",
              marginTop: 4,
            }}
          >
            En ligne
          </Text>
        </View>

        <View style={{ height: 16 }} />

        <Pressable
          onPress={() => router.back()}
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
            Retour
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
TSX
else
  echo "⚠️ Client slug screen not found at: $CLIENT_SLUG"
  echo "   Searching any [slug].tsx in client..."
  find "$ROOT/apps/client/app" -type f -name '[slug].tsx' -maxdepth 6 -print || true
fi

echo
echo "✅ (2) FIX COURIER mission [id].tsx broken import"
COURIER_MISSION="$ROOT/apps/courier/app/mission/[id].tsx"
if [ -f "$COURIER_MISSION" ]; then
  backup_file "$COURIER_MISSION"
  cat > "$COURIER_MISSION" <<'TSX'
import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

type MissionStep = "reçu" | "en_route" | "photo" | "terminée";

export default function MissionScreen() {
  const params = useLocalSearchParams();
  const id = typeof params?.id === "string" ? params.id : "mission";

  const steps: MissionStep[] = ["reçu", "en_route", "photo", "terminée"];
  const [step, setStep] = useState<MissionStep>("reçu");

  const stepIndex = useMemo(() => steps.indexOf(step), [step]);

  const next = () => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 26, fontWeight: "800" }}>
          Mission
        </Text>
        <Text style={{ color: "#9AA6C0", marginTop: 6 }}>
          ID: {id}
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
            Étape en cours
          </Text>
          <Text style={{ color: "#E9EDF7", fontSize: 18, fontWeight: "800", marginTop: 6 }}>
            {step}
          </Text>

          <View style={{ height: 12 }} />

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {steps.map((s, idx) => {
              const active = idx <= stepIndex;
              return (
                <View
                  key={s}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? "rgba(57,217,138,0.45)" : "rgba(255,255,255,0.10)",
                    backgroundColor: active ? "rgba(57,217,138,0.10)" : "rgba(255,255,255,0.03)",
                  }}
                >
                  <Text style={{ color: active ? "#39D98A" : "#9AA6C0", fontWeight: "700" }}>
                    {s}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 16 }} />

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
            Étape suivante
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={() => router.back()}
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
            Retour
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
TSX
else
  echo "⚠️ Courier mission screen not found at: $COURIER_MISSION"
fi

echo
echo "✅ (3) Clean caches"
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
rm -rf "$ROOT/apps/client/.expo" "$ROOT/apps/client/.turbo" "$ROOT/apps/client/node_modules/.cache" 2>/dev/null || true
rm -rf "$ROOT/apps/courier/.expo" "$ROOT/apps/courier/.turbo" "$ROOT/apps/courier/node_modules/.cache" 2>/dev/null || true

echo
echo "✅ DONE. Backups: $BACKUP_ROOT"
echo
echo "Restart metros:"
echo "  CLIENT : cd $ROOT/apps/client  && pnpm dev -- --tunnel --port 8081 --clear"
echo "  COURIER: cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear"
