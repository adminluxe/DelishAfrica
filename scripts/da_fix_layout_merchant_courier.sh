#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"

fix_one () {
  local app="$1"
  local f="$ROOT/apps/$app/app/_layout.tsx"

  echo "==> [$app] checking $f"

  if [ ! -f "$f" ]; then
    echo "!! [$app] NOT FOUND: $f"
    return 1
  fi

  # backup
  cp -a "$f" "$f.BAK.$TS"

  # Only fix if it contains the problematic pattern
  if ! grep -q 'Stack\.Screen[[:space:]]\+name=' "$f"; then
    echo "==> [$app] OK: no Stack.Screen name= found (no change). Backup kept: $f.BAK.$TS"
    return 0
  fi

  echo "==> [$app] PATCHING (removing Stack.Screen name= usage) ..."

  cat > "$f" <<'TSX'
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
TSX

  echo "==> [$app] DONE. New layout written. Backup: $f.BAK.$TS"
}

fix_one "merchant"
fix_one "courier"

echo
echo "✅ Patch completed."
echo "Next: restart Expo for merchant + courier (tmux windows 6 and 7)."
