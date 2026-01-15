#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG_DIR="$ROOT/tonton_logs"
TS="$(date +'%Y%m%d-%H%M%S')"
LOG="$LOG_DIR/ops_3011_$TS.log"
mkdir -p "$LOG_DIR"
log(){ echo "[$(date +'%H:%M:%S')] $*" | tee -a "$LOG"; }

log "== OPS LOCATE + START 3011 =="
log "LOG=$LOG"

# locate by common candidates + find fallback
CANDIDATES=(
  "/opt/delishafrica/delishafrica-ops"
  "/opt/delishafrica/ops"
  "/opt/delishafrica/platform"
  "/srv/delishafrica/delishafrica-ops"
  "/srv/delishafrica/ops"
)

OPS_DIR=""
for d in "${CANDIDATES[@]}"; do
  if [[ -f "$d/package.json" ]]; then OPS_DIR="$d"; break; fi
done

if [[ -z "$OPS_DIR" ]]; then
  log "Candidate not found. Trying find under /opt and /srv (maxdepth 6)..."
  OPS_DIR="$( (find /opt /srv -maxdepth 6 -type f -name package.json 2>/dev/null | grep -i 'ops' | head -n1 | xargs -r dirname) || true )"
fi

if [[ -z "$OPS_DIR" ]] || [[ ! -f "$OPS_DIR/package.json" ]]; then
  log "❌ OPS not found. Give me the exact folder (contains package.json)."
  log "Tip: find /opt -maxdepth 6 -type f -name package.json | grep -i ops"
  exit 1
fi

log "OPS_DIR=$OPS_DIR"

# free 3011
bash "$ROOT/scripts/da_kill_port.sh" 3011 || true

# start
export HUSKY=0
export CI=1
export npm_config_ignore_scripts=true

cd "$OPS_DIR"
if [[ -f pnpm-lock.yaml ]]; then
  log "pnpm install (scripts OFF)"
  pnpm install 2>&1 | tee -a "$LOG" || true
  log "start on 3011"
  PORT=3011 pnpm dev 2>&1 | tee -a "$LOG"
else
  log "npm install (scripts OFF)"
  npm install 2>&1 | tee -a "$LOG" || true
  log "start on 3011"
  PORT=3011 npm run dev 2>&1 | tee -a "$LOG"
fi
