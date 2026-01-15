#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

PREV="${1:-}"
if [ -z "$PREV" ]; then
  echo "Usage: $0 <previous-tag-or-commit>"
  exit 1
fi

echo "== Rollback to: $PREV =="
git checkout "$PREV"

pnpm -w install --frozen-lockfile
pnpm build

docker compose up -d --build || true
systemctl restart cloudflared 2>/dev/null || true

"$ROOT/scripts/da_smoke.sh"
echo "✅ ROLLBACK OK: $PREV"
