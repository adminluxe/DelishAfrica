#!/usr/bin/env bash
set -euo pipefail
API_PORT="${API_PORT:-3010}"
L="http://127.0.0.1:${API_PORT}/api/health"
P="https://api.delishafrica.me/api/health"
TS="$(date -Is)"
ok=1
curl -fsS -m 5 "$L" >/dev/null || ok=0
curl -fsS -m 5 "$P" >/dev/null || ok=0
echo "${TS} ok=${ok} local=${L} public=${P}" >> /opt/delishafrica/monorepo/_ops/health.log
[ "$ok" -eq 1 ]
