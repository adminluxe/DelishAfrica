#!/usr/bin/env bash
set -euo pipefail
API="https://api.delishafrica.me"

paths=(
  "/api/health"
  "/api/partners"
  "/partners"
  "/api/v1/dispatch/active"
  "/api/v1/missions"
  "/api/v1/couriers/me"
  "/api/dispatch/active"
  "/api/missions"
)

echo "=== PROBE ${API} ==="
for p in "${paths[@]}"; do
  code="$(curl -s -o /tmp/probe_body.$$ -w "%{http_code}" -m 10 "${API}${p}" || true)"
  head="$(head -c 160 /tmp/probe_body.$$ 2>/dev/null | tr '\n' ' ' || true)"
  printf "%-26s -> %s | %s\n" "$p" "$code" "$head"
done
rm -f /tmp/probe_body.$$ 2>/dev/null || true
