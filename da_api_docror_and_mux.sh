#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="delish"

cd "$ROOT"

echo "=== DelishAfrica Doctor ==="
echo "ROOT=$ROOT"
date

echo
echo "== 0) Hard-kill tmux + vieux process Expo/Node (sans casser Docker) =="
tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true

# Expo/Metro (best effort)
pkill -f "expo start" >/dev/null 2>&1 || true
pkill -f "metro" >/dev/null 2>&1 || true
pkill -f "react-native" >/dev/null 2>&1 || true

# Ports usuels Expo + API (best effort)
for p in 8081 8082 8083 19000 19001 19002 3010 4001; do
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 >/dev/null 2>&1 || true
  fi
done

echo
echo "== 1) Docker: détecte compose et remonte les services =="
COMPOSE_FILE=""
if [ -f "$ROOT/docker-compose.yml" ]; then COMPOSE_FILE="$ROOT/docker-compose.yml"; fi
if [ -f "$ROOT/compose.yml" ]; then COMPOSE_FILE="$ROOT/compose.yml"; fi
if [ -f "$ROOT/docker-compose.yaml" ]; then COMPOSE_FILE="$ROOT/docker-compose.yaml"; fi
if [ -f "$ROOT/compose.yaml" ]; then COMPOSE_FILE="$ROOT/compose.yaml"; fi

if command -v docker >/dev/null 2>&1 && [ -n "$COMPOSE_FILE" ]; then
  echo "Compose file: $COMPOSE_FILE"
  docker compose -f "$COMPOSE_FILE" up -d
  docker compose -f "$COMPOSE_FILE" ps
else
  echo "⚠️  docker/compose introuvable ou aucun compose file détecté dans $ROOT"
fi

echo
echo "== 2) Healthcheck local: essaye 3010 puis 4001 =="
set +e
H3010="$(curl -fsS --max-time 2 http://127.0.0.1:3010/api/health 2>/dev/null)"
RC3010=$?
H4001="$(curl -fsS --max-time 2 http://127.0.0.1:4001/api/health 2>/dev/null)"
RC4001=$?
set -e

API_LOCAL=""
if [ $RC3010 -eq 0 ]; then
  API_LOCAL="http://127.0.0.1:3010"
  echo "✅ Local API OK on 3010 -> $H3010"
elif [ $RC4001 -eq 0 ]; then
  API_LOCAL="http://127.0.0.1:4001"
  echo "✅ Local API OK on 4001 -> $H4001"
else
  echo "❌ Local API KO sur 3010 ET 4001"
fi

echo
echo "== 3) Healthcheck public (si tunnel/CF) =="
set +e
HPUB="$(curl -fsS --max-time 4 https://api.delishafrica.me/api/health 2>/dev/null)"
RCPUB=$?
set -e
if [ $RCPUB -eq 0 ]; then
  echo "✅ Public API OK -> $HPUB"
else
  echo "⚠️  Public API KO (https://api.delishafrica.me/api/health ne répond pas)"
fi

echo
echo "== 4) Scan rapide des env API dans les apps =="
for APP in client courier merchant; do
  echo "-- apps/$APP"
  ENV1="$ROOT/apps/$APP/.env"
  ENV2="$ROOT/apps/$APP/.env.development"
  for F in "$ENV1" "$ENV2"; do
    if [ -f "$F" ]; then
      echo "   $F"
      egrep -n "API|EXPO_PUBLIC_API|BASE_URL|API_URL" "$F" || true
    fi
  done
done

echo
echo "== 5) Recréation TMUX: shell + api-logs + 3 apps =="
tmux new-session -d -s "$SESSION" -n "shell" -c "$ROOT"

# Fenêtre API logs (docker si possible)
tmux new-window -t "$SESSION:1" -n "api" -c "$ROOT" \
  "bash -lc 'echo \"[API] docker logs (Ctrl+C n\\x27arrête pas Docker)\"; \
  if command -v docker >/dev/null 2>&1 && [ -n \"$COMPOSE_FILE\" ]; then \
    docker compose -f \"$COMPOSE_FILE\" logs -f --tail=200; \
  else \
    echo \"No compose file => montre juste health curl\"; \
    watch -n 2 \"curl -sS http://127.0.0.1:3010/api/health || curl -sS http://127.0.0.1:4001/api/health || echo API_KO\"; \
  fi'"

# Apps (ports fixes 8081/8082/8083 comme d’hab)
tmux new-window -t "$SESSION:2" -n "client" -c "$ROOT/apps/client" \
  "bash -lc 'pnpm exec expo start --dev-client -c --tunnel --port 8081'"

tmux new-window -t "$SESSION:3" -n "courier" -c "$ROOT/apps/courier" \
  "bash -lc 'pnpm exec expo start --dev-client -c --tunnel --port 8082'"

tmux new-window -t "$SESSION:4" -n "merchant" -c "$ROOT/apps/merchant" \
  "bash -lc 'pnpm exec expo start --dev-client -c --tunnel --port 8083'"

tmux select-window -t "$SESSION:1"

echo
echo "✅ Done. Attache-toi : tmux attach -t $SESSION"
echo "Tip: la fenêtre 1 = API logs, 2/3/4 = Metro."
