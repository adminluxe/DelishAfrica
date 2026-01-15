#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG_DIR="$ROOT/tonton_logs"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOG_DIR/ops_3011_$TS.log"
PORT=3011

mkdir -p "$LOG_DIR"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }
need find
need lsof
need node

echo "== OPS START SAFE 3011 ==" | tee -a "$LOG"

# 1) locate ops dir
CANDIDATES=(
  "/opt/delishafrica-ops"
  "/opt/delishafrica/ops"
  "/srv/delishafrica-ops"
  "/srv/delishafrica/ops"
)

OPS_DIR=""
for c in "${CANDIDATES[@]}"; do
  if [[ -f "$c/package.json" ]]; then OPS_DIR="$c"; break; fi
done

if [[ -z "$OPS_DIR" ]]; then
  echo "[1] brute search (maxdepth 6)..." | tee -a "$LOG"
  OPS_DIR="$(find /opt /srv -maxdepth 6 -type f -name package.json 2>/dev/null \
    | grep -E '/delishafrica-ops/|/ops/' \
    | head -n 1 \
    | sed 's|/package.json$||' || true)"
fi

if [[ -z "$OPS_DIR" ]] || [[ ! -f "$OPS_DIR/package.json" ]]; then
  echo "❌ delishafrica-ops introuvable. Donne-moi le path exact du repo OPS." | tee -a "$LOG"
  echo "LOG: $LOG"
  exit 1
fi

echo "✅ OPS_DIR=$OPS_DIR" | tee -a "$LOG"

# 2) free port 3011 ONLY (never touch 3010)
echo "[2] free port $PORT (ONLY)" | tee -a "$LOG"
bash "$ROOT/scripts/da_kill_port.sh" "$PORT" | tee -a "$LOG"

# 3) start
cd "$OPS_DIR"
echo "[3] install + start PORT=$PORT" | tee -a "$LOG"
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install 2>&1 | tee -a "$LOG"
  PORT="$PORT" pnpm dev 2>&1 | tee -a "$LOG"
else
  npm install 2>&1 | tee -a "$LOG"
  PORT="$PORT" npm run dev 2>&1 | tee -a "$LOG"
fi
