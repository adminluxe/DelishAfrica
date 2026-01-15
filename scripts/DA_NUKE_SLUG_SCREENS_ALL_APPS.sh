#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$ROOT/.backups/DA_NUKE_SLUG_SCREENS_$TS"
mkdir -p "$BACKUP_ROOT"

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local rel="${f#$ROOT/}"
  local dest="$BACKUP_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  cp -a "$f" "$dest"
}

write_safe_slug_screen() {
  local file="$1"
  cat > "$file" <<'TSX'
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
          <Text style={{ color: "#39D98A", fontSize: 16, fontWeight: "700", marginTop: 4 }}>
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
}

echo "=============================================="
echo "🔥 DA_NUKE_SLUG_SCREENS_ALL_APPS"
echo "Backup: $BACKUP_ROOT"
echo "=============================================="

for app in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$app"
  [ -d "$APPDIR" ] || { echo "❌ Missing $APPDIR"; exit 1; }

  echo
  echo "==> [$app] Searching slug screens..."

  # Find common slug screens (exact filenames with brackets)
  mapfile -t TARGETS < <(
    find "$APPDIR/app" -type f \
      \( -name '[slug].tsx' -o -name '[slug].ts' -o -name '[slug].jsx' -o -name '[slug].js' \) \
      ! -path "*/node_modules/*" ! -path "*/.expo/*" ! -path "*/dist/*" ! -path "*/.git/*" \
      2>/dev/null
  )

  if [ "${#TARGETS[@]}" -eq 0 ]; then
    echo "   ⚠️ No [slug] files found under $APPDIR/app (skip)."
    continue
  fi

  for f in "${TARGETS[@]}"; do
    # Only nuke the ones that are likely to be the problematic screen:
    # - path contains /partner/ OR file contains pointerEvents (decor overlays)
    if echo "$f" | grep -q "/partner/"; then
      echo "   ✅ Nuke: $f"
      backup_file "$f"
      write_safe_slug_screen "$f"
      continue
    fi

    if grep -q 'pointerEvents=' "$f" 2>/dev/null; then
      echo "   ✅ Nuke (pointerEvents found): $f"
      backup_file "$f"
      write_safe_slug_screen "$f"
      continue
    fi

    echo "   ➖ Keep: $f (not partner + no pointerEvents)"
  done
done

echo
echo "✅ DONE."
echo "Backups: $BACKUP_ROOT"
echo
echo "Now restart Metro (tmux):"
echo "  CLIENT : cd $ROOT/apps/client   && pnpm dev -- --tunnel --port 8081 --clear"
echo "  COURIER: cd $ROOT/apps/courier  && pnpm dev -- --tunnel --port 8082 --clear"
echo "  MERCH  : cd $ROOT/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear"
