#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TARGETS=(
  "$ROOT/apps/client/app.config.ts"
  "$ROOT/apps/merchant/app.config.ts"
  "$ROOT/apps/courier/app.config.ts"
)

echo "== Unlock (chattr -i) for app.config.ts files if needed =="
for f in "${TARGETS[@]}"; do
  if [[ -f "$f" ]]; then
    if command -v lsattr >/dev/null 2>&1 && lsattr -d "$f" 2>/dev/null | awk '{print $1}' | grep -q 'i'; then
      echo "unlock: $f"
      chattr -i "$f" || true
    else
      echo "ok: $f (not immutable)"
    fi
    chmod u+w "$f" || true
  else
    echo "skip: $f (not found)"
  fi
done

echo
echo "== Also show other immutable files under apps (top 50) =="
if command -v lsattr >/dev/null 2>&1; then
  (cd "$ROOT" && lsattr -R apps 2>/dev/null | grep -E '^[^-]*i' | head -n 50) || true
else
  echo "lsattr not available."
fi

echo
echo "DONE."
