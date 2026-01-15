#!/usr/bin/env bash
set -euo pipefail

echo "== DelishAfrica: FIND PROJECTS =="

ROOT="/opt/delishafrica"
MONO="/opt/delishafrica/monorepo"

echo "[1] Check monorepo:"
if [ -d "$MONO" ]; then
  echo "✅ monorepo: $MONO"
else
  echo "❌ monorepo introuvable: $MONO"
fi

echo
echo "[2] Locate API (Nest) candidates:"
# Heuristique: cherche un src/main.ts + app.module.ts
find "$MONO" -maxdepth 5 -type f \( -name "main.ts" -o -name "app.module.ts" \) 2>/dev/null \
  | grep -E "/src/(main\.ts|app\.module\.ts)$" \
  | sed 's#/src/.*##' \
  | sort -u \
  | while read -r d; do
      if [ -f "$d/package.json" ]; then
        echo " - $d"
      fi
    done || true

echo
echo "[3] Locate delishafrica-ops anywhere under /opt:"
OPS_DIR="$(find /opt -maxdepth 6 -type d -name "delishafrica-ops" 2>/dev/null | head -n 1 || true)"
if [ -n "${OPS_DIR:-}" ]; then
  echo "✅ OPS: $OPS_DIR"
else
  echo "⚠️ OPS introuvable sous /opt (on élargira si besoin)."
fi

echo
echo "[4] Ports listeners (3010/3011/8083/8082/8081):"
for p in 3010 3011 8083 8082 8081; do
  echo "--- port $p ---"
  (ss -lntp 2>/dev/null || true) | grep -E ":$p\s" || echo "no listener"
done

echo
echo "== DONE =="
