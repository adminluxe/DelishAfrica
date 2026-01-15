#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")
FILES=("app/orders-demo.tsx" "app/thieyp-demo.tsx")

echo "=== Restore demo files from latest .bak ==="

for app in "${APPS[@]}"; do
  BASE="$ROOT/apps/$app"
  echo "---- APP: $app"

  for rel in "${FILES[@]}"; do
    f="$BASE/$rel"
    if [[ ! -f "$f" ]]; then
      echo "  skip missing: $f"
      continue
    fi

    latest_bak="$(ls -1t "${f}".bak.* 2>/dev/null | head -n 1 || true)"
    if [[ -n "${latest_bak}" ]]; then
      cp -a "$latest_bak" "$f"
      echo "  restored: $f  <=  $(basename "$latest_bak")"
    else
      echo "  no backup found for: $f"
    fi
  done

  echo
done

echo "=== DONE ==="
