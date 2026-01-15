#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 <git-ref-or-tag>"
  exit 1
fi

TS="$(date -Is | tr ':' '-')"
REL_DIR="${ROOT}/_snapshots/release-${TS}"
mkdir -p "$REL_DIR"

echo "== 0) Pre-snapshot =="
"$ROOT/ops_snapshot.sh" || true

echo "== 1) Save rollback bundle (even if dirty) =="
git diff > "${REL_DIR}/working-tree.patch" || true
tar -czf "${REL_DIR}/critical-files.tgz" \
  docker-compose.yml package.json pnpm-lock.yaml turbo.json \
  scripts 2>/dev/null || true

echo "== 2) Checkout target =="
git fetch --all --tags || true
git checkout "$TARGET"

echo "== 3) Install/build =="
pnpm -w install --frozen-lockfile
pnpm build

echo "== 4) Restart services (best effort) =="
# adapte selon ta réalité : docker compose / systemd / pm2
docker compose up -d --build || true
systemctl restart cloudflared 2>/dev/null || true

echo "== 5) Smoke =="
"$ROOT/scripts/da_smoke.sh"

echo "✅ DEPLOY OK: $TARGET"
echo "Rollback bundle: ${REL_DIR}"
