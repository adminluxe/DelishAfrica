#!/usr/bin/env bash
set -euo pipefail

SESSION="DA_DEV"
ROOT="/opt/delishafrica/monorepo"
LOGDIR="/opt/delishafrica/logs"
mkdir -p "$LOGDIR"

PORTS=(8081 8082 8083 19000 19001 19002 3010 4001)

say() { printf "\n\033[1;36m[DA_DEV]\033[0m %s\n" "$*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }
}

free_ports() {
  say "Freeing ports: ${PORTS[*]}"
  for p in "${PORTS[@]}"; do
    if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
    fi
  done
}

kill_zombies() {
  say "Killing common dev zombies (expo/metro/ngrok) (safe kill)"
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
  pkill -f "react-native" >/dev/null 2>&1 || true
  pkill -f "ngrok" >/dev/null 2>&1 || true
}

find_platform_dir() {
  # 1) common known paths
  for d in \
    "/opt/delishafrica/delishafrica-ops" \
    "/opt/delishafrica/ops" \
    "$ROOT/apps/platform" \
    "$ROOT/platform" \
    "/opt/delishafrica/platform" \
  ; do
    if [[ -f "$d/package.json" ]]; then echo "$d"; return 0; fi
  done

  # 2) heuristic search: package.json containing "ops" or "delishafrica-ops"
  local hit
  hit="$(find /opt/delishafrica -maxdepth 5 -name package.json 2>/dev/null \
        | head -n 2000 \
        | while read -r pj; do
            if grep -qiE '"name"\s*:\s*".*(delishafrica-ops|ops).*"' "$pj"; then
              dirname "$pj"; break
            fi
          done)"
  [[ -n "${hit:-}" ]] && echo "$hit" && return 0
  return 1
}

pm_for_dir() {
  local dir="$1"
  if [[ -f "$dir/pnpm-lock.yaml" ]] || [[ -f "$ROOT/pnpm-lock.yaml" ]]; then
    echo "pnpm"
  elif [[ -f "$dir/yarn.lock" ]]; then
    echo "yarn"
  else
    echo "npm"
  fi
}

start_api_cmd() {
  # Prefer docker compose logs if a compose file exists in ROOT
  if [[ -f "$ROOT/docker-compose.yml" ]] || [[ -f "$ROOT/docker-compose.yaml" ]]; then
    cat <<'CMD'
cd /opt/delishafrica/monorepo
docker compose up -d || true
docker compose ps
# try common service names for logs:
(docker compose logs -f api || docker compose logs -f api-rest || docker compose logs -f backend || docker compose logs -f) 2>&1 | tee -a /opt/delishafrica/logs/api.log
CMD
  else
    cat <<'CMD'
cd /opt/delishafrica/monorepo
pnpm --filter services/api dev 2>&1 | tee -a /opt/delishafrica/logs/api.log
CMD
  fi
}

start_expo_cmd() {
  local app="$1" port="$2"
  cat <<CMD
cd /opt/delishafrica/monorepo
# Expo tunnel + dev-client + cache reset, pinned port
pnpm --filter "apps/$app" exec expo start --dev-client -c --tunnel --port $port 2>&1 | tee -a "$LOGDIR/${app}.log"
CMD
}

start_platform_cmd() {
  local pdir="$1"
  local pm
  pm="$(pm_for_dir "$pdir")"
  cat <<CMD
cd "$pdir"
echo "[platform] dir: $pdir"
echo "[platform] pm:  $pm"
$pm install || true
$pm run dev 2>&1 | tee -a "$LOGDIR/platform.log"
CMD
}

main() {
  need tmux
  need lsof

  say "Root: $ROOT"
  cd "$ROOT"

  free_ports
  kill_zombies

  say "Reset tmux session if exists: $SESSION"
  tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true

  say "Creating tmux session: $SESSION"
  tmux new-session -d -s "$SESSION" -n "shell" "cd $ROOT && bash"

  tmux new-window -t "$SESSION:1" -n "api-logs"  "bash -lc '$(start_api_cmd)'"
  tmux new-window -t "$SESSION:2" -n "client"    "bash -lc '$(start_expo_cmd client 8081)'"
  tmux new-window -t "$SESSION:3" -n "courier"   "bash -lc '$(start_expo_cmd courier 8082)'"
  tmux new-window -t "$SESSION:4" -n "merchant"  "bash -lc '$(start_expo_cmd merchant 8083)'"

  if pdir="$(find_platform_dir)"; then
    tmux new-window -t "$SESSION:5" -n "platform" "bash -lc '$(start_platform_cmd "$pdir")'"
  else
    tmux new-window -t "$SESSION:5" -n "platform" "bash -lc 'echo \"[platform] NOT FOUND under /opt/delishafrica\"; echo \"Try: find /opt/delishafrica -maxdepth 4 -name package.json | head\"; bash'"
  fi

  tmux select-window -t "$SESSION:0"
  say "Attach: tmux attach -t $SESSION"
}

main "$@"
