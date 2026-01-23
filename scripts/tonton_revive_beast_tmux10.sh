#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

###############################################################################
# DelishAfrica — TONTON REVIVE BEAST (tmux 10 windows) — v1.1
# Fix: pnpm path/strict + fallbacks scripts + logs + stabilité
###############################################################################

DEFAULT_ROOT="/opt/delishafrica/monorepo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd 2>/dev/null || echo "$DEFAULT_ROOT")"

SESSION="${SESSION:-DA_REL}"
API_URL_PUBLIC_DEFAULT="https://api.delishafrica.me"

PORTS_KILL_DEFAULT=(
  8081 8082 8083 8084 8085 8086
  19000 19001 19002 19003 19004
  3000 3010 4000 4001 4010 5173
)

NOW="$(date +%Y%m%d_%H%M%S)"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/revive_beast_$NOW.log"
mkdir -p "$REPORT_DIR"

ts(){ date "+%Y-%m-%d %H:%M:%S"; }
log(){ echo -e "\n[$(ts)] $*" | tee -a "$REPORT"; }
die(){ echo -e "\n[ERROR $(ts)] $*" | tee -a "$REPORT" >&2; exit 1; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

is_root(){ [[ "${EUID:-$(id -u)}" -eq 0 ]]; }
SUDO=""; if ! is_root; then SUDO="sudo"; fi

log "Root détecté: $ROOT"
[[ -d "$ROOT" ]] || die "ROOT introuvable: $ROOT"
[[ -d "$ROOT/apps" ]] || die "Dossier apps introuvable dans $ROOT"

# ---- pnpm sanity (on force /usr/local/bin en tête si dispo) ----
sanitize_path(){
  if [[ -x /usr/local/bin/pnpm ]]; then
    export PATH="/usr/local/bin:$PATH"
  fi
  hash -r || true
}

pnpm_sanity(){
  sanitize_path
  need node
  need corepack
  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm absent -> corepack prepare pnpm@9.15.4"
    corepack enable || true
    corepack prepare pnpm@9.15.4 --activate
    sanitize_path
  fi
  log "pnpm path(s):"
  (type -a pnpm || true) | tee -a "$REPORT"
  pnpm -v | tee -a "$REPORT" || die "pnpm KO (pnpm -v échoue). Lance d'abord tonton_force_pnpm_packageManager.sh"
}

detect_api_dir(){
  local cand=(
    "$ROOT/services/api-nest"
    "$ROOT/services/api"
    "$ROOT/services/backend"
    "$ROOT/api"
  )
  for d in "${cand[@]}"; do
    [[ -d "$d" && -f "$d/package.json" ]] && { echo "$d"; return 0; }
  done
  if [[ -d "$ROOT/services" ]]; then
    local found
    found="$(find "$ROOT/services" -maxdepth 2 -name package.json -print -quit 2>/dev/null || true)"
    [[ -n "${found:-}" ]] && { echo "$(dirname "$found")"; return 0; }
  fi
  echo ""
}

detect_app_dir(){ [[ -d "$ROOT/apps/$1" ]] && echo "$ROOT/apps/$1" || echo ""; }

detect_platform_dir(){
  local cand=(
    "$ROOT/apps/platform" "$ROOT/apps/ops" "$ROOT/apps/ops-web"
    "$ROOT/apps/dashboard" "$ROOT/apps/admin"
    "$ROOT/platform" "$ROOT/ops"
  )
  for d in "${cand[@]}"; do
    [[ -d "$d" && -f "$d/package.json" ]] && { echo "$d"; return 0; }
  done
  echo ""
}

kill_matching(){
  local pattern="$1"
  if pgrep -af "$pattern" >/dev/null 2>&1; then
    log "Killing processes matching: $pattern"
    $SUDO pkill -f "$pattern" || true
  fi
}

free_port(){
  local port="$1"
  local pids=""
  pids="$($SUDO lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids:-}" ]]; then
    log "Freeing port $port (PIDs: $pids)"
    echo "$pids" | xargs -r $SUDO kill -9 || true
  fi
}

clean_caches(){
  log "Nettoyage caches (safe)"
  $SUDO rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-* 2>/dev/null || true
  find "$ROOT" -maxdepth 4 -type d -name ".expo" -prune -exec rm -rf {} + 2>/dev/null || true
  find "$ROOT" -maxdepth 6 -type d -path "*/node_modules/.cache" -prune -exec rm -rf {} + 2>/dev/null || true
}

stop_old_stack(){
  log "Stop tmux session: $SESSION (si existe)"
  tmux kill-session -t "$SESSION" >/dev/null 2>&1 || true

  log "Stop anciens procesos dev"
  kill_matching "expo start" || true
  kill_matching "expo-dev-server" || true
  kill_matching "metro" || true
  kill_matching "react-native" || true

  if command -v pm2 >/dev/null 2>&1; then
    log "PM2 détecté -> stop all (safe)"
    pm2 stop all >/dev/null 2>&1 || true
    pm2 delete all >/dev/null 2>&1 || true
  fi

  log "Libération ports fantômes"
  for p in "${PORTS_KILL_DEFAULT[@]}"; do free_port "$p"; done
}

docker_up_if_present(){
  if [[ -f "$ROOT/docker-compose.yml" || -f "$ROOT/compose.yml" ]]; then
    need docker
    log "Docker compose up -d"
    ( cd "$ROOT" && $SUDO docker compose up -d ) || true
  else
    log "Docker compose non trouvé -> skip"
  fi
}

pnpm_install_root(){
  pnpm_sanity
  [[ -f "$ROOT/package.json" ]] || die "package.json introuvable à la racine"

  log "pnpm -w install (workspace) à la racine"
  ( cd "$ROOT" && pnpm -w install ) | tee -a "$REPORT"
}

tmux_new_session(){
  need tmux
  log "Création tmux session: $SESSION (10 fenêtres fixes 0..9)"
  tmux new-session -d -s "$SESSION" -n root

  tmux set-option -t "$SESSION" -g mouse on
  tmux set-option -t "$SESSION" -g history-limit 200000
  tmux set-option -t "$SESSION" -g remain-on-exit on
  tmux set-option -t "$SESSION" -g renumber-windows off

  tmux send-keys -t "$SESSION:0" "cd '$ROOT' && clear && echo '[0] ROOT | $ROOT' && echo 'Log: $REPORT' && exec bash" C-m

  tmux new-window -t "$SESSION:1" -n cmd
  tmux new-window -t "$SESSION:2" -n api
  tmux new-window -t "$SESSION:3" -n health
  tmux new-window -t "$SESSION:4" -n ports
  tmux new-window -t "$SESSION:5" -n client
  tmux new-window -t "$SESSION:6" -n merchant
  tmux new-window -t "$SESSION:7" -n courier
  tmux new-window -t "$SESSION:8" -n platform
  tmux new-window -t "$SESSION:9" -n shell

  tmux send-keys -t "$SESSION:1" "cd '$ROOT' && clear && echo '[1] CMD (shell vide)' && exec bash" C-m

  local API_DIR CLIENT_DIR MERCHANT_DIR COURIER_DIR PLATFORM_DIR
  API_DIR="$(detect_api_dir)"
  CLIENT_DIR="$(detect_app_dir client)"
  MERCHANT_DIR="$(detect_app_dir merchant)"
  COURIER_DIR="$(detect_app_dir courier)"
  PLATFORM_DIR="$(detect_platform_dir)"

  if [[ -n "${API_DIR:-}" ]]; then
    tmux send-keys -t "$SESSION:2" "cd '$API_DIR' && clear && echo '[2] API dir: $API_DIR' && bash -lc 'pnpm -v && (pnpm run dev || pnpm run start:dev || pnpm run start || npm run dev || npm run start) ; exec bash'" C-m
  else
    tmux send-keys -t "$SESSION:2" "cd '$ROOT' && clear && echo '[2] API non détectée (shell)' && exec bash" C-m
  fi

  tmux send-keys -t "$SESSION:3" "cd '$ROOT' && clear && echo '[3] HEALTH watcher' && bash -lc 'while true; do for PORT in 3010 4001; do for PATH in /api/v1/health /api/health /health; do URL=\"http://127.0.0.1:\$PORT\$PATH\"; if curl -fsS \"\$URL\" >/dev/null 2>&1; then echo \"✅ \$URL\"; else echo \"❌ \$URL\"; fi; done; done; echo \"----\"; sleep 2; done; exec bash'" C-m

  tmux send-keys -t "$SESSION:4" "cd '$ROOT' && clear && echo '[4] PORTS monitor' && bash -lc 'while true; do date; (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null || true) | egrep \"(:8081|:8082|:8083|:3010|:4001|:19000|:19001)\" || true; echo \"----\"; sleep 2; done; exec bash'" C-m

  local expo_env="export EXPO_PUBLIC_API_URL=\${EXPO_PUBLIC_API_URL:-$API_URL_PUBLIC_DEFAULT};"

  if [[ -n "${CLIENT_DIR:-}" ]]; then
    tmux send-keys -t "$SESSION:5" "cd '$CLIENT_DIR' && clear && echo '[5] CLIENT metro (8081)' && bash -lc '$expo_env (pnpm run dev -- --tunnel --port 8081 --clear || pnpm run start -- --tunnel --port 8081 --clear || npm run dev -- --tunnel --port 8081 --clear || npm run start -- --tunnel --port 8081 --clear) ; exec bash'" C-m
  else
    tmux send-keys -t "$SESSION:5" "cd '$ROOT' && clear && echo '[5] CLIENT introuvable' && exec bash" C-m
  fi

  if [[ -n "${MERCHANT_DIR:-}" ]]; then
    tmux send-keys -t "$SESSION:6" "cd '$MERCHANT_DIR' && clear && echo '[6] MERCHANT metro (8083)' && bash -lc '$expo_env (pnpm run dev -- --tunnel --port 8083 --clear || pnpm run start -- --tunnel --port 8083 --clear || npm run dev -- --tunnel --port 8083 --clear || npm run start -- --tunnel --port 8083 --clear) ; exec bash'" C-m
  else
    tmux send-keys -t "$SESSION:6" "cd '$ROOT' && clear && echo '[6] MERCHANT introuvable' && exec bash" C-m
  fi

  if [[ -n "${COURIER_DIR:-}" ]]; then
    tmux send-keys -t "$SESSION:7" "cd '$COURIER_DIR' && clear && echo '[7] COURIER metro (8082)' && bash -lc '$expo_env (pnpm run dev -- --tunnel --port 8082 --clear || pnpm run start -- --tunnel --port 8082 --clear || npm run dev -- --tunnel --port 8082 --clear || npm run start -- --tunnel --port 8082 --clear) ; exec bash'" C-m
  else
    tmux send-keys -t "$SESSION:7" "cd '$ROOT' && clear && echo '[7] COURIER introuvable' && exec bash" C-m
  fi

  if [[ -n "${PLATFORM_DIR:-}" ]]; then
    tmux send-keys -t "$SESSION:8" "cd '$PLATFORM_DIR' && clear && echo '[8] PLATFORM dir: $PLATFORM_DIR' && bash -lc '(pnpm run dev || pnpm run start || npm run dev || npm run start) ; exec bash'" C-m
  else
    tmux send-keys -t "$SESSION:8" "cd '$ROOT' && clear && echo '[8] PLATFORM non détectée (shell)' && exec bash" C-m
  fi

  tmux send-keys -t "$SESSION:9" "cd '$ROOT' && clear && echo '[9] SHELL (secours)' && exec bash" C-m

  tmux select-window -t "$SESSION:1"
}

log "1) Stop ancien stack + ports"
stop_old_stack

log "2) Clean caches"
clean_caches

log "3) pnpm install workspace"
pnpm_install_root

log "4) docker compose up (si présent)"
docker_up_if_present

log "5) tmux 10 fenêtres"
tmux_new_session

log "✅ OK. Attache:"
echo "tmux attach -t $SESSION"
log "Log complet: $REPORT"
