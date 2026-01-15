#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backups/da_force_scroll_$TS"
mkdir -p "$BACKUP"

apps=("client" "merchant" "courier")

echo "==> BACKUP -> $BACKUP"
for a in "${apps[@]}"; do
  f="$ROOT/apps/$a/ui/ui.tsx"
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/apps/$a/ui"
    cp -a "$f" "$BACKUP/apps/$a/ui/ui.tsx"
  fi
done

patch_one() {
  local APP="$1"
  local FILE="$ROOT/apps/$APP/ui/ui.tsx"
  [ -f "$FILE" ] || { echo "==> [$APP] ui.tsx not found, skip"; return 0; }

  echo
  echo "==> [$APP] Patching Screen() to be ScrollView by default: $FILE"

  # Ensure ScrollView is imported from react-native
  if ! grep -q "ScrollView" "$FILE"; then
    perl -0777 -i -pe '
      if (s/import\s+\{\s*([^}]+)\s*\}\s+from\s+["'\'']react-native["'\''];/import { $1, ScrollView } from "react-native";/s) {
      } else {
        $_ = "import { ScrollView } from \"react-native\";\n" . $_;
      }
    ' "$FILE"
  fi

  # Ensure ScreenProps contains scroll?: boolean
  if grep -qE "type\s+ScreenProps" "$FILE" && ! grep -q "scroll\?: boolean" "$FILE"; then
    perl -0777 -i -pe '
      s/(type\s+ScreenProps\s*=\s*\{)/$1\n  scroll?: boolean;\n/s;
    ' "$FILE" || true
  fi

  # Replace Screen implementation (best-effort): works if Screen is declared as function Screen(...) { ... }
  # We replace the whole function body with a stable implementation.
  perl -0777 -i -pe '
    s/export\s+function\s+Screen\s*\([^)]*\)\s*\{.*?\n\}/export function Screen({ children, style, scroll = true, ...props }: any) {\n  if (!scroll) {\n    return (\n      <ScrollView\n        style={[{ flex: 1 }, style]}\n        contentContainerStyle={{ paddingTop: 16, paddingBottom: 64 }}\n        keyboardShouldPersistTaps=\"handled\"\n        showsVerticalScrollIndicator={false}\n        {...props}\n      >\n        {children}\n      <\/ScrollView>\n    );\n  }\n\n  return (\n    <ScrollView\n      style={[{ flex: 1 }, style]}\n      contentContainerStyle={{ paddingTop: 16, paddingBottom: 64, flexGrow: 1 }}\n      keyboardShouldPersistTaps=\"handled\"\n      showsVerticalScrollIndicator={false}\n      {...props}\n    >\n      {children}\n    <\/ScrollView>\n  );\n}\n/sms;
  ' "$FILE" || true

  # If Screen wasn't found/replaced, add a safe export at the end (won't break imports if they already use Screen)
  if ! grep -qE "export function Screen\(" "$FILE"; then
    cat >> "$FILE" <<'TSX'

/** Injected fallback Screen (ScrollView) */
export function Screen({ children, style, scroll = true, ...props }: any) {
  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 64, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
TSX
  fi

  echo "   - OK"
}

for a in "${apps[@]}"; do patch_one "$a"; done

echo
echo "==> Cleaning caches"
for a in "${apps[@]}"; do
  d="$ROOT/apps/$a"
  rm -rf "$d/.expo" "$d/.turbo" "$d/node_modules/.cache" 2>/dev/null || true
done

echo
echo "✅ DONE. Backup: $BACKUP"
echo "NEXT: restart metros + force close iPhone apps + rescan QR."
