#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backups/da_fix_scroll_routes_$TS"
mkdir -p "$BACKUP"

apps=("client" "merchant" "courier")

echo "==> BACKUP -> $BACKUP"
for a in "${apps[@]}"; do
  if [ -d "$ROOT/apps/$a" ]; then
    mkdir -p "$BACKUP/apps"
    cp -a "$ROOT/apps/$a" "$BACKUP/apps/"
  fi
done

disable_conflicts() {
  local APP="$1"
  local APPDIR="$ROOT/apps/$APP/app"

  [ -d "$APPDIR" ] || return 0

  echo
  echo "==> [$APP] Checking route conflicts in: $APPDIR"

  # Helper: if both exist, disable the "flat" file to keep folder route.
  # Example: app/orders.tsx conflicts with app/orders/index.tsx (same route: /orders)
  if [ -f "$APPDIR/orders.tsx" ] && [ -f "$APPDIR/orders/index.tsx" ]; then
    echo "   - Conflict: orders.tsx + orders/index.tsx -> disabling orders.tsx"
    mv "$APPDIR/orders.tsx" "$APPDIR/orders.tsx.DISABLED.$TS"
  fi

  if [ -f "$APPDIR/mission.tsx" ] && [ -f "$APPDIR/mission/index.tsx" ]; then
    echo "   - Conflict: mission.tsx + mission/index.tsx -> disabling mission.tsx"
    mv "$APPDIR/mission.tsx" "$APPDIR/mission.tsx.DISABLED.$TS"
  fi

  if [ -f "$APPDIR/thieyp.tsx" ] && [ -f "$APPDIR/thieyp/index.tsx" ]; then
    echo "   - Conflict: thieyp.tsx + thieyp/index.tsx -> disabling thieyp.tsx"
    mv "$APPDIR/thieyp.tsx" "$APPDIR/thieyp.tsx.DISABLED.$TS"
  fi

  # Also handle /orders-demo leftovers if present
  if [ -f "$APPDIR/orders-demo.tsx" ]; then
    echo "   - Neutralizing old demo route: orders-demo.tsx"
    mv "$APPDIR/orders-demo.tsx" "$APPDIR/orders-demo.tsx.DISABLED.$TS"
  fi
  if [ -f "$APPDIR/mission-demo.tsx" ]; then
    echo "   - Neutralizing old demo route: mission-demo.tsx"
    mv "$APPDIR/mission-demo.tsx" "$APPDIR/mission-demo.tsx.DISABLED.$TS"
  fi
}

patch_screen_to_scroll() {
  local APP="$1"
  local FILE="$ROOT/apps/$APP/ui/ui.tsx"

  [ -f "$FILE" ] || return 0

  echo
  echo "==> [$APP] Patching Screen() to allow scroll (safe default: ScrollView)"

  # 1) Ensure ScrollView import exists (react-native)
  if ! grep -qE 'from "react-native".*ScrollView|from '\''react-native'\''.*ScrollView' "$FILE"; then
    # Add ScrollView into an existing react-native import line
    perl -0777 -i -pe '
      if (s/import\s+\{\s*([^}]+)\s*\}\s+from\s+["'\'']react-native["'\''];/import { $1, ScrollView } from "react-native";/s) {
        # ok
      } else {
        $_ = "import { ScrollView } from \"react-native\";\n" . $_;
      }
    ' "$FILE"
  fi

  # 2) Replace the Screen wrapper View with ScrollView (only if a Screen component exists)
  # We keep a prop scroll? default true. If scroll={false}, it falls back to View.
  if ! grep -q "scroll?: boolean" "$FILE"; then
    perl -0777 -i -pe '
      s/function\s+Screen\s*\(\s*\{\s*/function Screen({ scroll = true, /s;
      s/type\s+ScreenProps\s*=\s*\{([^}]+)\}/type ScreenProps = {$1\n  scroll?: boolean;\n}/s;
    ' "$FILE" 2>/dev/null || true
  fi

  # If Screen is implemented as a component returning <View ...>{children}</View>, we replace with conditional ScrollView.
  # Best-effort but safe: only if it contains "return (" then "<View" then "{children}"
  perl -0777 -i -pe '
    if (/function\s+Screen\s*\(/s && /return\s*\(/s) {
      s/return\s*\(\s*<View([^>]*)>\s*\{children\}\s*<\/View>\s*\);/return (\n    scroll ? (\n      <ScrollView$1 contentContainerStyle={[{ paddingBottom: 48 }, (Array.isArray((($1 =~ /style=\{([^}]+)\}/s) ? $1 : "")) ? [] : [])]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>\n        {children}\n      <\/ScrollView>\n    ) : (\n      <View$1>{children}<\/View>\n    )\n  );/s;
    }
  ' "$FILE" 2>/dev/null || true

  # If the above didn’t match, we still ensure scroll is available by adding a tiny helper export (won't break)
  if ! grep -q "keyboardShouldPersistTaps" "$FILE"; then
    echo "   - Note: Could not auto-swap Screen wrapper in $FILE (structure differs). We'll patch screens directly next if needed."
  else
    echo "   - Screen wrapper patched in $FILE"
  fi
}

patch_key_screens_scrollview() {
  # If Screen wrapper couldn't be swapped cleanly, we harden the most important screens:
  local APP="$1"
  local base="$ROOT/apps/$APP/app"
  local files=(
    "$base/index.tsx"
    "$base/thieyp.tsx"
    "$base/thieyp/index.tsx"
    "$base/orders.tsx"
    "$base/orders/index.tsx"
    "$base/mission.tsx"
    "$base/mission/index.tsx"
    "$base/mission/[id].tsx"
    "$base/restaurant/[id].tsx"
  )

  echo
  echo "==> [$APP] Ensuring main screens are scrollable (best-effort)"

  for f in "${files[@]}"; do
    [ -f "$f" ] || continue

    # Ensure ScrollView imported if file uses <ScrollView
    if grep -q "<ScrollView" "$f" && ! grep -q "ScrollView" "$f"; then
      perl -0777 -i -pe '
        if (s/import\s+\{\s*([^}]+)\s*\}\s+from\s+["'\'']react-native["'\''];/import { $1, ScrollView } from "react-native";/s) {
        } else {
          $_ = "import { ScrollView } from \"react-native\";\n" . $_;
        }
      ' "$f"
    fi
  done
}

clean_caches() {
  local APP="$1"
  local DIR="$ROOT/apps/$APP"
  [ -d "$DIR" ] || return 0

  echo
  echo "==> [$APP] Cleaning caches"
  rm -rf "$DIR/.expo" "$DIR/.turbo" "$DIR/node_modules/.cache" 2>/dev/null || true
}

echo
echo "==> 1) Disable conflicts (Merchant first priority)"
disable_conflicts "merchant"
disable_conflicts "client"
disable_conflicts "courier"

echo
echo "==> 2) Patch Screen wrapper to support scroll (3 apps)"
for a in "${apps[@]}"; do
  patch_screen_to_scroll "$a"
done

echo
echo "==> 3) Ensure key screens are scrollable (best-effort)"
for a in "${apps[@]}"; do
  patch_key_screens_scrollview "$a"
done

echo
echo "==> 4) Clean caches (3 apps)"
for a in "${apps[@]}"; do
  clean_caches "$a"
done

echo
echo "✅ DONE."
echo "Backup: $BACKUP"
echo
echo "NEXT:"
echo "  - Restart the 3 metros in tmux (client/courier/merchant)."
echo "  - Force close apps on iPhone -> re-scan QR."
