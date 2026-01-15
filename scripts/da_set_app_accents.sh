#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
ts="$(date +%Y%m%d_%H%M%S)"

declare -A ACCENT=(
  [client]="#FF3B30"   # rouge premium client
  [courier]="#0A84FF"  # bleu courier
  [merchant]="#34C759" # vert merchant
)

cd "$ROOT"

for a in client courier merchant; do
  f="apps/$a/ui/theme.ts"
  test -f "$f" || { echo "Missing $f"; exit 1; }

  cp -a "$f" "$f.bak.$ts"

  color="${ACCENT[$a]:-}"
  if [[ -z "$color" ]]; then
    echo "No accent defined for app=$a"
    exit 1
  fi

  # Remplace la 1ère occurrence de accent: '...'
  perl -0777 -i -pe "s/(accent\\s*:\\s*['\"])#[0-9a-fA-F]{3,8}(['\"])/\$1${color}\$2/s" "$f"

  echo "✅ $a accent => $color"
done

echo
echo "== Vérif accents =="
for a in client courier merchant; do
  echo "--- $a"
  rg -n "accent\\s*:" "apps/$a/ui/theme.ts" || true
done
