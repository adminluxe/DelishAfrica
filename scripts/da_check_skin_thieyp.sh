#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)

cd "$ROOT"

echo "== Repo: $ROOT =="
echo

echo "== THEME FILES (exist + quick preview) =="
for a in "${APPS[@]}"; do
  f="apps/$a/ui/theme.ts"
  echo "--- $a: $f"
  test -f "$f" && echo "OK" || { echo "MISSING"; exit 1; }
  sed -n '1,80p' "$f" | sed 's/^/  /'
done
echo

echo "== THEME CONSUMPTION (imports + theme usage) =="
for a in "${APPS[@]}"; do
  echo "--- $a imports ui/theme from routes"
  rg -n "ui/theme" "apps/$a/app" || echo "  (no direct import found)"
  echo "--- $a theme. usage"
  rg -n "theme\." "apps/$a" || echo "  (no theme usage found)"
done
echo

echo "== ASSETS (icon/splash) =="
for a in "${APPS[@]}"; do
  echo "--- $a assets folder"
  ls -la "apps/$a/assets" || true
  echo "--- $a app.config.ts references"
  rg -n "icon:\s*\"\.\/assets\/icon\.png\"|splash:\s*\{.*\.\/assets\/splash\.png" "apps/$a/app.config.ts" || \
    echo "  (no icon/splash refs detected)"
done
echo

echo "== API SANITY =="
API="https://api.delishafrica.me"
curl -fsS "$API/api/health" | head -c 200; echo
curl -fsS "$API/api/partners" | head -c 200; echo
curl -fsS "$API/api/partners/thieyp" | head -c 200; echo
echo

echo "== OPTIONAL: demo reset endpoint (if exists) =="
curl -fsS -X POST "$API/api/v1/orders/demo/reset" -H "content-type: application/json" -d '{}' | head -c 200 && echo || \
  echo "(demo/reset not reachable yet - OK if not implemented in this env)"
echo

echo "✅ CHECK DONE"
