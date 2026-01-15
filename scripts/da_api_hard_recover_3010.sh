#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d-%H%M%S)"
MONO="/opt/delishafrica/monorepo"
LOG_DIR="$MONO/.tonton_logs"
BK_DIR="$MONO/.tonton_backups/api_recover_$TS"
mkdir -p "$LOG_DIR" "$BK_DIR"

log(){ echo -e "[$(date +%H:%M:%S)] $*"; }

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }

need node
need pnpm

log "== API HARD RECOVER 3010 =="

log "[1] Kill anything on port 3010 (safe)"
if command -v ss >/dev/null 2>&1; then
  PIDS="$(ss -lntp 2>/dev/null | grep -E ':3010\s' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)"
else
  PIDS="$(lsof -tiTCP:3010 -sTCP:LISTEN 2>/dev/null || true)"
fi
if [ -n "${PIDS:-}" ]; then
  log "PIDs: $PIDS"
  for pid in $PIDS; do kill -9 "$pid" 2>/dev/null || true; done
else
  log "No listener on 3010."
fi

log "[2] Find API dir (Nest) inside monorepo"
# Priorité: services/api-nest sinon le premier projet Nest trouvé
API_DIR=""
if [ -d "$MONO/services/api-nest" ]; then
  API_DIR="$MONO/services/api-nest"
else
  API_DIR="$(find "$MONO" -maxdepth 5 -type f -name "main.ts" 2>/dev/null \
    | grep "/src/main.ts$" \
    | sed 's#/src/main.ts##' \
    | head -n 1 || true)"
fi

if [ -z "${API_DIR:-}" ] || [ ! -f "$API_DIR/package.json" ]; then
  log "❌ API_DIR introuvable. Lance: bash $MONO/scripts/da_find_projects.sh"
  exit 1
fi
log "✅ API_DIR=$API_DIR"

log "[3] Backup package.json + lockfiles"
cp -a "$API_DIR/package.json" "$BK_DIR/package.json" || true
[ -f "$API_DIR/pnpm-lock.yaml" ] && cp -a "$API_DIR/pnpm-lock.yaml" "$BK_DIR/" || true
[ -f "$MONO/pnpm-lock.yaml" ] && cp -a "$MONO/pnpm-lock.yaml" "$BK_DIR/monorepo.pnpm-lock.yaml" || true

log "[4] Install deps from monorepo root (workspace) if possible"
cd "$MONO"
if [ -f "$MONO/pnpm-lock.yaml" ] || [ -f "$MONO/pnpm-workspace.yaml" ]; then
  log "pnpm -w install (workspace)"
  pnpm -w install | tee "$LOG_DIR/pnpm_install_workspace_$TS.log"
else
  log "No workspace lock found. Installing inside API_DIR"
  cd "$API_DIR"
  pnpm install | tee "$LOG_DIR/pnpm_install_api_$TS.log"
  cd "$MONO"
fi

log "[5] Build API (and ensure dist exists)"
cd "$API_DIR"

# Clean build artifacts safely
rm -rf dist .tsbuildinfo 2>/dev/null || true

# Try common scripts in order
if cat package.json | grep -q '"build"'; then
  log "pnpm run build"
  pnpm run build | tee "$LOG_DIR/api_build_$TS.log"
else
  log "⚠️ No build script found in API. Trying tsc."
  pnpm exec tsc -p tsconfig.json | tee "$LOG_DIR/api_build_tsc_$TS.log"
fi

if [ ! -f "$API_DIR/dist/main.js" ]; then
  log "❌ dist/main.js not found after build. Check build log: $LOG_DIR/api_build_$TS.log"
  exit 1
fi

log "[6] Start API on 3010 (node dist/main.js) in background (nohup)"
API_LOG="$LOG_DIR/api_3010_$TS.log"
# stop previous api_3010 if any (best effort)
pkill -f "dist/main.js" 2>/dev/null || true

PORT=3010 NODE_ENV=production nohup node "$API_DIR/dist/main.js" >"$API_LOG" 2>&1 & disown || true
sleep 1

log "[7] Health check"
set +e
curl -sS -m 4 "http://127.0.0.1:3010/api/v1/orders/demo/health" | head -c 400
echo
curl -sS -m 4 "http://127.0.0.1:3010/api/health" | head -c 400
echo
set -e

log "✅ API started. Log: $API_LOG"
log "== DONE =="
