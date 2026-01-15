#!/usr/bin/env bash
set -euo pipefail

BASE="/opt/delishafrica"
PORT="3011"

echo "🧡 Recherche delishafrica-ops sous $BASE ..."
OPS_DIR="$(find "$BASE" -maxdepth 3 -type d -name "delishafrica-ops" 2>/dev/null | head -n 1 || true)"

if [ -z "${OPS_DIR:-}" ]; then
  echo "❌ delishafrica-ops introuvable sous $BASE (maxdepth 3)."
  echo "➡️ Fais: find /opt/delishafrica -maxdepth 6 -type d -name delishafrica-ops"
  exit 1
fi

echo "✅ OPS: $OPS_DIR"
cd "$OPS_DIR"

if [ -f pnpm-lock.yaml ]; then
  echo "➡️ pnpm install"
  pnpm install
  echo "➡️ start sur port $PORT"
  PORT="$PORT" pnpm dev
else
  echo "➡️ npm install"
  npm install
  echo "➡️ start sur port $PORT"
  PORT="$PORT" npm run dev
fi
