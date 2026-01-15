#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="client"
APP_DIR="$ROOT/apps/$APP"
BACKUP_DIR="$ROOT/.backups/orders-demo-click-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "==> Backup dir: $BACKUP_DIR"
cd "$APP_DIR"

# 0) Sanity
if [ ! -d "$APP_DIR" ]; then
  echo "❌ Missing app dir: $APP_DIR"
  exit 1
fi

# 1) Ensure route exists and is TSX with default export
ROUTE_TS="$APP_DIR/app/orders-demo.ts"
ROUTE_TSX="$APP_DIR/app/orders-demo.tsx"

if [ -f "$ROUTE_TS" ]; then
  echo "==> Found ghost route (ts): $ROUTE_TS -> will backup & replace with tsx"
  cp -a "$ROUTE_TS" "$BACKUP_DIR/"
fi

mkdir -p "$APP_DIR/app"

if [ -f "$ROUTE_TSX" ]; then
  echo "==> Route exists: $ROUTE_TSX (backup)"
  cp -a "$ROUTE_TSX" "$BACKUP_DIR/"
fi

cat > "$ROUTE_TSX" <<'TSX'
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";

export default function OrdersDemo() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#070A12", padding: 20, paddingTop: 28 }}>
      <Stack.Screen options={{ title: "Order (démo)" }} />

      <Text style={{ color: "white", fontSize: 28, fontWeight: "800", marginBottom: 10 }}>
        Commande Thieyp (démo)
      </Text>

      <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 16, marginTop: 12 }}>
        <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 16, fontWeight: "700" }}>✔ Commande créée</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 6 }}>⏳ En préparation</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Retour</Text>
        </Pressable>

        <Pressable
          onPress={() => {}}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: "#2EE889",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#06110B", fontWeight: "900" }}>Suivre (démo)</Text>
        </Pressable>
      </View>
    </View>
  );
}
TSX

# If a ghost .ts exists, neutralize it (keep backup already taken)
if [ -f "$ROUTE_TS" ]; then
  echo "==> Neutralizing $ROUTE_TS (so Router stops being confused)"
  cat > "$ROUTE_TS" <<'TS'
export default function _noop() { return null; }
TS
fi

# 2) Force the "Commander (démo)" button to navigate via expo-router Link/asChild
echo "==> Searching for the screen that contains 'Commander (démo)'..."
TARGET_FILE="$(grep -RIn --exclude-dir node_modules --exclude-dir .expo --exclude-dir dist --exclude-dir .git \
  "Commander (démo)" "$APP_DIR" | head -n 1 | cut -d: -f1 || true)"

if [ -z "${TARGET_FILE:-}" ]; then
  echo "⚠️ Could not find 'Commander (démo)' text in code. Skipping button patch."
else
  echo "==> Found candidate file: $TARGET_FILE"
  cp -a "$TARGET_FILE" "$BACKUP_DIR/"

  # Ensure Link import exists
  if ! grep -q 'from "expo-router"' "$TARGET_FILE"; then
    # Add a safe import block at top
    perl -0777 -i -pe 's/^/import { Link } from "expo-router";\n/s' "$TARGET_FILE"
  else
    # Add Link if missing in existing expo-router import
    perl -i -pe 'if (/from "expo-router"/ && !/Link/) { s/\{([^}]*)\}/\{$1, Link\}/ }' "$TARGET_FILE"
  fi

  # Wrap the green button area with <Link href="/orders-demo" asChild> ... </Link>
  # Heuristic: replace the first Pressable/Button that contains the literal "Commander (démo)"
  perl -0777 -i -pe '
    s{
      (<Pressable\b[\s\S]*?>\s*[\s\S]*?<Text\b[\s\S]*?>\s*Commander\s*\(démo\)\s*</Text>[\s\S]*?</Pressable>)
    }{
      <Link href="/orders-demo" asChild>\n$1\n</Link>
    }gx;
    s{
      (<Button\b[\s\S]*?title=\{?"Commander\s*\(démo\)"\}?[\s\S]*?)(/?>)
    }{
      <Link href="/orders-demo" asChild>\n$1$2\n</Link>
    }gx;
  ' "$TARGET_FILE"

  echo "==> Button patch applied (best-effort)."
fi

# 3) Anti-overlay (pointerEvents) on likely decorative layers
echo "==> Applying anti-overlay patch (pointerEvents) on decorative components (best-effort)..."
# Common keywords that often float above UI
for k in "Snow" "Particles" "Glow" "Decor" "Background" "Aurora"; do
  while IFS= read -r f; do
    cp -a "$f" "$BACKUP_DIR/$(basename "$f").bak.$(date +%s)" 2>/dev/null || true
    perl -0777 -i -pe 's/<View([^>]*?)(style=\{[\s\S]*?\})([^>]*?)>/<View$1$2 pointerEvents="none"$3>/g if $ARGV =~ /\.tsx$/;' "$f" || true
  done < <(grep -RIl --exclude-dir node_modules --exclude-dir .expo --exclude-dir dist --exclude-dir .git \
    "$k" "$APP_DIR" 2>/dev/null | head -n 10)
done

# 4) Clear caches for this app (no refactor)
echo "==> Clearing caches (client)..."
rm -rf "$APP_DIR/.expo" "$APP_DIR/.turbo" "$APP_DIR/node_modules/.cache" 2>/dev/null || true
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true

echo
echo "✅ DONE. Backups in: $BACKUP_DIR"
echo
echo "NEXT: restart Metro for client with clear cache:"
echo "  cd $APP_DIR && pnpm dev -- --tunnel --port 8081 --clear"
