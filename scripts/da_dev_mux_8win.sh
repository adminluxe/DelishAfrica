#!/usr/bin/env bash
set -euo pipefail

SESSION="DA_DEV"
ROOT="/opt/delishafrica/monorepo"
LOGDIR="/opt/delishafrica/logs"
mkdir -p "$LOGDIR"

PORTS=(
  8081 8082 8083 8084 8085 8086 8090
  19000 19001 19002 19003 19004 19005 19006 19007 19008 19009 19010
  3000 3001 3010 3011 3012
  4000 4001 4010 4011
  5173 5174 5555
)

say() { printf "\n\033[1;36m[DA_DEV]\033[0m %s\n" "$*"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" >&2; exit 1; }; }

kill_all_tmux() {
  say "Killing ALL tmux sessions (kill-server)"
  tmux kill-server >/dev/null 2>&1 || true
}

kill_zombies() {
  say "Killing common dev processes (expo/metro/ngrok)"
  pkill -f "expo start" >/dev/null 2>&1 || true
  pkill -f "metro" >/dev/null 2>&1 || true
  pkill -f "react-native" >/dev/null 2>&1 || true
  pkill -f "ngrok" >/dev/null 2>&1 || true
}

free_ports() {
  say "Freeing ports"
  for p in "${PORTS[@]}"; do
    if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
    fi
  done
}

clear_caches() {
  say "Clearing caches (Expo/Metro + app caches)"
  rm -rf /root/.expo /root/.expo-shared /root/.metro-cache /root/.cache/metro 2>/dev/null || true
  rm -rf "$ROOT/apps/client/.expo" "$ROOT/apps/courier/.expo" "$ROOT/apps/merchant/.expo" 2>/dev/null || true
  rm -rf "$ROOT/apps/client/node_modules/.cache" "$ROOT/apps/courier/node_modules/.cache" "$ROOT/apps/merchant/node_modules/.cache" 2>/dev/null || true
}

pm_for_dir() {
  local dir="$1"
  if [[ -f "$dir/pnpm-lock.yaml" ]] || [[ -f "$ROOT/pnpm-lock.yaml" ]]; then echo "pnpm"
  elif [[ -f "$dir/yarn.lock" ]]; then echo "yarn"
  else echo "npm"
  fi
}

find_platform_dir() {
  for d in \
    "/opt/delishafrica/delishafrica-ops" \
    "/opt/delishafrica/ops" \
    "$ROOT/apps/platform" \
    "$ROOT/platform" \
    "/opt/delishafrica/platform" \
  ; do
    if [[ -f "$d/package.json" ]]; then echo "$d"; return 0; fi
  done

  local hit=""
  hit="$(find /opt/delishafrica -maxdepth 5 -name package.json 2>/dev/null \
    | head -n 2500 \
    | while read -r pj; do
        if grep -qiE '"name"\s*:\s*".*(delishafrica-ops|ops).*"' "$pj"; then
          dirname "$pj"; break
        fi
      done)"
  [[ -n "${hit:-}" ]] && echo "$hit" && return 0
  return 1
}

api_cmd() {
  if [[ -f "$ROOT/docker-compose.yml" ]] || [[ -f "$ROOT/docker-compose.yaml" ]]; then
    cat <<'CMD'
cd /opt/delishafrica/monorepo
docker compose up -d || true
docker compose ps
(docker compose logs -f api-rest || docker compose logs -f api || docker compose logs -f backend || docker compose logs -f) 2>&1 | tee -a /opt/delishafrica/logs/api.log
CMD
  else
    cat <<'CMD'
cd /opt/delishafrica/monorepo
pnpm --filter services/api dev 2>&1 | tee -a /opt/delishafrica/logs/api.log
CMD
  fi
}

expo_cmd_by_cd() {
  local app="$1" port="$2"
  cat <<CMD
cd /opt/delishafrica/monorepo/apps/$app
pnpm exec expo start --dev-client -c --tunnel --port $port 2>&1 | tee -a "/opt/delishafrica/logs/${app}.log"
CMD
}

platform_cmd() {
  local pdir="$1"
  local pm; pm="$(pm_for_dir "$pdir")"
  cat <<CMD
cd "$pdir"
echo "[platform] dir: $pdir"
echo "[platform] pm:  $pm"
$pm install || true
$pm run dev 2>&1 | tee -a "/opt/delishafrica/logs/platform.log"
CMD
}

health_watch_cmd() {
  cat <<'CMD'
bash -lc '
while true; do
  echo "---- $(date) ----"
  curl -fsS http://127.0.0.1:3010/api/health && echo "  (health:3010 OK)" || echo "  (health:3010 FAIL)"
  curl -fsS http://127.0.0.1:4001/api/health && echo "  (health:4001 OK)" || echo "  (health:4001 FAIL)"
  sleep 3
done
'
CMD
}

ports_watch_cmd() {
  cat <<'CMD'
bash -lc '
watch -n 2 "echo \"LISTEN:\"; ss -ltnp | egrep \"(:8081|:8082|:8083|:19000|:3010|:4001|:5173)\" || true; echo; echo \"TMUX:\"; tmux ls 2>/dev/null || true"
'
CMD
}

main() {
  need tmux
  need lsof
  [[ -d "$ROOT/apps/client" ]] || { echo "Missing: $ROOT/apps/client"; exit 1; }
  [[ -d "$ROOT/apps/courier" ]] || { echo "Missing: $ROOT/apps/courier"; exit 1; }
  [[ -d "$ROOT/apps/merchant" ]] || { echo "Missing: $ROOT/apps/merchant"; exit 1; }

  say "FULL RESET: tmux + processes + ports + caches"
  kill_all_tmux
  kill_zombies
  free_ports
  clear_caches

  say "Create tmux session: $SESSION (8 windows)"
  tmux new-session -d -s "$SESSION" -n "shell" "cd $ROOT && bash"
  tmux new-window -t "$SESSION:1" -n "api"      "bash -lc '$(api_cmd)'"
  tmux new-window -t "$SESSION:2" -n "health"   "$(health_watch_cmd)"
  tmux new-window -t "$SESSION:3" -n "client"   "bash -lc '$(expo_cmd_by_cd client 8081)'"
  tmux new-window -t "$SESSION:4" -n "courier"  "bash -lc '$(expo_cmd_by_cd courier 8082)'"
  tmux new-window -t "$SESSION:5" -n "merchant" "bash -lc '$(expo_cmd_by_cd merchant 8083)'"

  if pdir="$(find_platform_dir)"; then
    tmux new-window -t "$SESSION:6" -n "platform" "bash -lc '$(platform_cmd "$pdir")'"
  else
    tmux new-window -t "$SESSION:6" -n "platform" "bash -lc 'echo \"[platform] NOT FOUND\"; echo \"Run: find /opt/delishafrica -maxdepth 5 -name package.json | head -n 80\"; bash'"
  fi

  tmux new-window -t "$SESSION:7" -n "ports" "$(ports_watch_cmd)"
  tmux select-window -t "$SESSION:0"
  say "Attach: tmux attach -t $SESSION"
}

main "$@"
