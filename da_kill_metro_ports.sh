#!/usr/bin/env bash
set -euo pipefail

ports=(8081 8082 8083)

echo "🔪 Killing listeners on ports: ${ports[*]}"
for p in "${ports[@]}"; do
  sudo fuser -k "${p}/tcp" 2>/dev/null || true
done

echo "✅ Check:"
for p in "${ports[@]}"; do
  if sudo lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "❌ Port $p still busy"
    sudo lsof -nP -iTCP:"$p" -sTCP:LISTEN || true
    exit 1
  else
    echo "✅ Port $p free"
  fi
done
