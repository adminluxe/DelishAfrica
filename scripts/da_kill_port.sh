#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-}"
if [[ -z "$PORT" ]]; then
  echo "Usage: $0 <port>"
  exit 1
fi

echo "== KILL PORT $PORT =="
PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ' || true)"
if [[ -z "${PIDS// }" ]]; then
  echo "OK: no listener on $PORT"
  exit 0
fi

echo "Listener(s) on $PORT: $PIDS"
for pid in $PIDS; do
  echo " - kill -TERM $pid"
  kill -TERM "$pid" 2>/dev/null || true
done
sleep 0.5
PIDS2="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ' || true)"
if [[ -n "${PIDS2// }" ]]; then
  echo " - kill -KILL $PIDS2"
  for pid in $PIDS2; do
    kill -KILL "$pid" 2>/dev/null || true
  done
fi

sleep 0.2
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "!! Still listening on $PORT"
  exit 2
fi

echo "OK: port $PORT is free"
