#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/backup_safe_padding_${TS}"
mkdir -p "$BACKUP_DIR"

echo "== DelishAfrica | Safe padding Screen (top/bottom) =="
echo "Backup dir: $BACKUP_DIR"
echo

patch_one() {
  local app="$1"
  local f="$ROOT/apps/$app/ui/ui.tsx"

  if [[ ! -f "$f" ]]; then
    echo "❌ [$app] Missing: $f"
    return 1
  fi

  mkdir -p "$BACKUP_DIR/$app"
  cp -a "$f" "$BACKUP_DIR/$app/ui.tsx"

  # 1) Ensure import useSafeAreaInsets exists
  if ! grep -q "useSafeAreaInsets" "$f"; then
    # Insert after first react-native import line if possible
    if grep -qE '^import .* from "react-native";' "$f"; then
      perl -0777 -i -pe 's/(^import .* from "react-native";\s*\n)/$1import { useSafeAreaInsets } from "react-native-safe-area-context";\n/m' "$f"
      echo "✅ [$app] Added import: useSafeAreaInsets"
    else
      # Fallback: add near top (after React import)
      perl -0777 -i -pe 's/(^import React[^;]*;\s*\n)/$1import { useSafeAreaInsets } from "react-native-safe-area-context";\n/m' "$f"
      echo "✅ [$app] Added import (fallback): useSafeAreaInsets"
    fi
  else
    echo "ℹ️  [$app] Import already present: useSafeAreaInsets"
  fi

  # 2) Inject const insets inside Screen function if not present
  if grep -qE 'export function Screen\(' "$f"; then
    if ! grep -qE 'const insets = useSafeAreaInsets\(\);' "$f"; then
      perl -0777 -i -pe 's/(export function Screen\([^\)]*\)\s*\{\s*\n)/$1  const insets = useSafeAreaInsets();\n/m' "$f"
      echo "✅ [$app] Injected: const insets = useSafeAreaInsets()"
    else
      echo "ℹ️  [$app] Insets const already present"
    fi
  elif grep -qE 'export const Screen\s*=' "$f"; then
    # Common arrow func pattern: export const Screen = (...) => {
    if ! grep -qE 'const insets = useSafeAreaInsets\(\);' "$f"; then
      perl -0777 -i -pe 's/(export const Screen\s*=\s*\([^\)]*\)\s*=>\s*\{\s*\n)/$1  const insets = useSafeAreaInsets();\n/m' "$f"
      echo "✅ [$app] Injected in arrow Screen: const insets = useSafeAreaInsets()"
    else
      echo "ℹ️  [$app] Insets const already present (arrow)"
    fi
  else
    echo "⚠️  [$app] Could not detect Screen component signature. SKIP style injection."
    return 0
  fi

  # 3) Inject paddingTop/paddingBottom into first Screen wrapper style={[ ... ]}
  # Only if not already present
  if grep -qE 'paddingTop:\s*insets\.top' "$f" || grep -qE 'paddingBottom:\s*insets\.bottom' "$f"; then
    echo "ℹ️  [$app] Safe padding already present"
    return 0
  fi

  # Try to inject into a pattern like: style={[{ ... }, style]}
  # We add: { paddingTop: insets.top, paddingBottom: insets.bottom },
  # right after the first object in the first style={[ ... ]} in Screen.
  local before_hash after_hash
  before_hash="$(sha1sum "$f" | awk '{print $1}')"

  perl -0777 -i -pe '
    # Work on the first occurrence of style={[{ ... }, ... ]} inside Screen return
    s/(style=\[\s*\{\s*[^}]*\}\s*,\s*)/$1{ paddingTop: insets.top, paddingBottom: insets.bottom }, /s
  ' "$f" || true

  after_hash="$(sha1sum "$f" | awk '{print $1}')"

  if [[ "$before_hash" == "$after_hash" ]]; then
    echo "⚠️  [$app] Pattern not matched for style injection (no changes). Keeping file safe."
    echo "    👉 Open $f and confirm Screen wrapper uses style={[{...}, ...]} (then we adapt)."
  else
    echo "✅ [$app] Injected safe padding into Screen wrapper style"
  fi
}

patch_one "client"
patch_one "merchant"
patch_one "courier"

echo
echo "== DONE =="
echo "Backups saved at: $BACKUP_DIR"
echo "Next: in each Metro window press: r"
