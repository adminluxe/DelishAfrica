#!/usr/bin/env bash
set -euo pipefail

PORT=${PORT:-4001}
API_DIR="services/api"
RUN="pnpm -C $API_DIR exec ts-node --transpile-only src/main.ts"

echo "→ Recherche de processus sur :$PORT"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp | grep ":$PORT" || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -i :$PORT || true
fi

# Tentatives PM2 (au cas où)
if command -v pm2 >/dev/null 2>&1; then
  echo "→ PM2 status (si utilisé)"
  pm2 ls || true
  pm2 stop delish-api >/dev/null 2>&1 || true
  pm2 delete delish-api >/dev/null 2>&1 || true
fi

# Kill process à l'écoute du port
PIDS=$(ss -ltnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' | sort -u)
if [ -z "${PIDS:-}" ] && command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti :$PORT || true)
fi
if [ -n "${PIDS:-}" ]; then
  echo "→ Kill PIDs: $PIDS"
  kill $PIDS || true
  sleep 1
  PIDS2=""
  for pid in $PIDS; do kill -0 "$pid" 2>/dev/null && PIDS2="$PIDS2 $pid"; done
  if [ -n "$PIDS2" ]; then
    echo "→ Forçage kill: $PIDS2"
    kill -9 $PIDS2 || true
  fi
fi

echo "→ Vérification port libre"
ss -ltnp | grep ":$PORT" || echo "OK, port $PORT libre."

# Lancer avec la bonne DB (charge prisma/.env explicitement)
echo "→ Démarrage API sur DB de dev"
( cd "$API_DIR" && set -a; . prisma/.env; set +a; PORT=$PORT pnpm exec ts-node --transpile-only src/main.ts ) &
APP_PID=$!

# Log rapide + rappel
sleep 1
echo "→ API PID: $APP_PID"
echo "→ Test: curl -s http://localhost:$PORT/api/health | jq ."
