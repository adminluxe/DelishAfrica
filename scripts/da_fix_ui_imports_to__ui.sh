#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/ui_imports_fix_$TS"

mkdir -p "$BK"

echo "== Backup apps/*/app -> $BK =="
for a in "${APPS[@]}"; do
  cp -a "$ROOT/apps/$a/app" "$BK/${a}_app"
done

echo "== Sanity: _ui folders =="
for a in "${APPS[@]}"; do
  if [[ ! -d "$ROOT/apps/$a/app/_ui" ]]; then
    echo "ERROR: missing $ROOT/apps/$a/app/_ui"
    exit 1
  fi
done

echo "== Matches BEFORE (ui/ui) =="
rg -n --hidden --glob '!**/node_modules/**' "((?:\\.?\\.?/)+)ui/ui" \
  "$ROOT/apps/client/app" "$ROOT/apps/courier/app" "$ROOT/apps/merchant/app" || true

FILES="$(rg -l --hidden --glob '!**/node_modules/**' "((?:\\.?\\.?/)+)ui/ui" \
  "$ROOT/apps/client/app" "$ROOT/apps/courier/app" "$ROOT/apps/merchant/app" || true)"

if [[ -n "${FILES:-}" ]]; then
  echo "$FILES" | xargs -r perl -pi -e 's#((?:\.\.?/)+)ui/ui#${1}_ui/ui#g'
fi

echo "== Matches AFTER (ui/ui) should be empty =="
rg -n --hidden --glob '!**/node_modules/**' "((?:\\.?\\.?/)+)ui/ui" \
  "$ROOT/apps/client/app" "$ROOT/apps/courier/app" "$ROOT/apps/merchant/app" && {
    echo "ERROR: still found ui/ui imports."
    exit 1
  } || true

echo "OK. Now restart Expo with --clear in each app window."
