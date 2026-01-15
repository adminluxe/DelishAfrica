#!/usr/bin/env bash
set -euo pipefail

SESSION="${1:-DA_REL}"
ROOT="/opt/delishafrica/monorepo"
COMPOSE="/opt/delishafrica/compose"

echo "== DelishAfrica ONRAILS =="
echo "root: $ROOT"
echo "tmux session: $SESSION"

# 0) kill tmux session (si existe)
if command -v tmux >/dev/null 2>&1; then
  tmux kill-session -t "$SESSION" 2>/dev/null || true
fi

# 1) libérer ports (API + metros + expo classiques)
PORTS=(3010 8081 8082 8083 19000 19001 19002 19006)
kill_port() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"
    [[ -z "$pids" ]] && return 0
    echo "kill port $p -> $pids"
    kill -TERM $pids 2>/dev/null || true
    sleep 0.4
    kill -KILL $pids 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k -TERM "$p"/tcp 2>/dev/null || true
    sleep 0.4
    fuser -k -KILL "$p"/tcp 2>/dev/null || true
  else
    echo "WARN: ni lsof ni fuser -> skip kill port $p"
  fi
}
for p in "${PORTS[@]}"; do kill_port "$p"; done

# 2) clean caches légers (sans toucher node_modules)
for app in client courier merchant; do
  rm -rf "$ROOT/apps/$app/.expo" "$ROOT/apps/$app/.expo-shared" "$ROOT/apps/$app/.metro" 2>/dev/null || true
  rm -rf "$ROOT/apps/$app/node_modules/.cache" 2>/dev/null || true
done
rm -rf "$ROOT/node_modules/.cache" "$ROOT/.turbo" 2>/dev/null || true

# 3) docker compose up (si infra présente)
if [[ -d "$COMPOSE" ]] && (ls "$COMPOSE"/docker-compose*.yml "$COMPOSE"/compose.yml >/dev/null 2>&1) && command -v docker >/dev/null 2>&1; then
  echo "docker compose up -d (compose stack)"
  (cd "$COMPOSE" && docker compose up -d) || true
fi

# 4) rebuild config (si script présent)
if [[ -x "$ROOT/scripts/da_rebuild_app_config_ts.sh" ]]; then
  echo "rebuild app.config.ts..."
  bash "$ROOT/scripts/da_rebuild_app_config_ts.sh"
fi

# 5) hard-lock app.config.ts (anti-régression)
for f in "$ROOT/apps/client/app.config.ts" "$ROOT/apps/courier/app.config.ts" "$ROOT/apps/merchant/app.config.ts"; do
  [[ -f "$f" ]] || continue
  chattr +i "$f" 2>/dev/null || true
done

# 6) launch tmux 10 windows
exec bash "$ROOT/scripts/da_tmux_10win.sh" "$SESSION"
