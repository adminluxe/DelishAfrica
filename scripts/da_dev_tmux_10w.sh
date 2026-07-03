#!/usr/bin/env bash
set -Eeuo pipefail

# DelishAfrica - official 10-window tmux dev cockpit
# Repo: /opt/delishafrica/monorepo
# Session: DA_DEV
#
# Windows:
# 0-shell
# 1-cmd
# 2-api-logs
# 3-health
# 4-ports
# 5-client
# 6-merchant
# 7-courier
# 8-platform
# 9-shell
#
# Expo ports:
# client 8081
# courier 8082
# merchant 8083
#
# API:
# 127.0.0.1:3010

SESSION="${DA_TMUX_SESSION:-DA_DEV}"
ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"

API_PORT="${DA_API_PORT:-3010}"
CLIENT_PORT="${DA_CLIENT_PORT:-8081}"
COURIER_PORT="${DA_COURIER_PORT:-8082}"
MERCHANT_PORT="${DA_MERCHANT_PORT:-8083}"

EXPO_MODE="${DA_EXPO_MODE:---tunnel}"

API_URL_LOCAL="http://127.0.0.1:${API_PORT}/api/v1/health"
API_URL_PUBLIC="https://api.delishafrica.me/api/v1/health"

die(){ echo "[DA][ERR] $*" >&2; exit 1; }
info(){ echo "[DA] $*"; }

need(){
command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"
}

usage(){
cat <<EOF
Usage:
bash scripts/da_dev_tmux_10w.sh [--attach|--fresh|--no-attach]

Modes:
--attach Attache la session existante si elle existe, sinon crée.
--fresh Recrée la session DA_DEV après confirmation douce.
--no-attach Crée la session sans attacher.

Variables:
DA_EXPO_MODE=--tunnel|--lan|--localhost
DA_ROOT=/opt/delishafrica/monorepo
DA_TMUX_SESSION=DA_DEV
EOF
}

MODE="${1:---attach}"

case "$MODE" in
--attach|--fresh|--no-attach) ;;
-h|--help) usage; exit 0 ;;
*) die "Mode invalide: $MODE" ;;
esac

need tmux
need bash
need curl
need ss

[ -d "$ROOT" ] || die "Repo introuvable: $ROOT"
[ -f "$ROOT/scripts/da_expo_runner.sh" ] || die "Runner officiel absent: $ROOT/scripts/da_expo_runner.sh"
[ -d "$ROOT/apps/client" ] || die "App client absente"
[ -d "$ROOT/apps/merchant" ] || die "App merchant absente"
[ -d "$ROOT/apps/courier" ] || die "App courier absente"

case "$EXPO_MODE" in
--tunnel|--lan|--localhost) ;;
*) die "DA_EXPO_MODE invalide: $EXPO_MODE" ;;
esac

if tmux has-session -t "$SESSION" 2>/dev/null; then
if [ "$MODE" = "--fresh" ]; then
info "Session $SESSION existante: arrêt contrôlé."
tmux kill-session -t "$SESSION" || true
else
info "Session $SESSION existe déjà."
if [ "$MODE" = "--attach" ]; then
exec tmux attach -t "$SESSION"
fi
exit 0
fi
fi

mkdir -p "$HOME/.cache/delishafrica/tmp" "$HOME/.cache/delishafrica/metro"

export TMPDIR="$HOME/.cache/delishafrica/tmp"
export METRO_CACHE_DIR="$HOME/.cache/delishafrica/metro"

tmux new-session -d -s "$SESSION" -n "shell" -c "$ROOT"

tmux set-option -t "$SESSION" -g base-index 0
tmux set-option -t "$SESSION" -g pane-base-index 0
tmux set-option -t "$SESSION" -g renumber-windows off
tmux set-option -t "$SESSION" -g remain-on-exit on
tmux set-option -t "$SESSION" -g detach-on-destroy off
tmux set-option -t "$SESSION" -g allow-rename off
tmux set-option -t "$SESSION" -g history-limit 200000
tmux set-option -t "$SESSION" -g mouse on
tmux set-option -t "$SESSION" -g status-interval 2
tmux set-option -t "$SESSION" -g set-titles on
tmux set-option -t "$SESSION" -g status-left " DelishAfrica | #S "
tmux set-option -t "$SESSION" -g status-right " %Y-%m-%d %H:%M:%S "

send(){
local target="$1"
shift
tmux send-keys -t "$target" "$*" C-m
}

mk_shell_window(){
local index="$1"
local name="$2"
local dir="$3"
tmux new-window -t "${SESSION}:${index}" -n "$name" -c "$dir"
}

keep_shell_cmd(){
local title="$1"
local cmd="$2"
cat <<EOF
clear
echo '[DA][$title]'
echo 'Repo: $ROOT'
echo 'Ctrl+C: la commande s arrete mais le shell reste ouvert.'
echo
bash -lc '$cmd'
echo
echo '[DA][$title] commande terminee - shell garde vivant.'
exec bash -i
EOF
}

loop_cmd(){
local title="$1"
local cmd="$2"
cat <<EOF
clear
echo '[DA][$title]'
echo 'Double Ctrl+C rapide pour sortir du shell si besoin.'
echo
while true; do
echo
echo '------------------------------------------------------------'
echo '[DA][$title] start' \$(date '+%F %T')
echo '------------------------------------------------------------'
bash -lc '$cmd' || true
echo
echo '[DA][$title] exited - restart in 2s. Ctrl+C puis Ctrl+C pour interrompre.'
sleep 2
done
EOF
}

# 0-shell already exists
send "${SESSION}:0" "cd '$ROOT'; clear; echo '[DA] 0-shell ready'; pwd; exec bash -i"

mk_shell_window 1 "cmd" "$ROOT"
send "${SESSION}:1" "cd '$ROOT'; clear; echo '[DA] 1-cmd ready'; echo 'Commandes manuelles ici.'; exec bash -i"

mk_shell_window 2 "api-logs" "$ROOT"
send "${SESSION}:2" "$(loop_cmd "api-logs" "cd '$ROOT'; docker compose logs -f --tail=200 api 2>/dev/null || docker compose logs -f --tail=200")"

mk_shell_window 3 "health" "$ROOT"
send "${SESSION}:3" "$(loop_cmd "health" "while true; do date; echo 'LOCAL:'; curl -fsS '$API_URL_LOCAL' || true; echo; echo 'PUBLIC:'; curl -fsS '$API_URL_PUBLIC' || true; echo; sleep 3; done")"

mk_shell_window 4 "ports" "$ROOT"
send "${SESSION}:4" "$(loop_cmd "ports" "while true; do date; ss -ltnp 2>/dev/null | egrep ':(3010|8081|8082|8083)\\b' || true; echo; sleep 3; done")"

mk_shell_window 5 "client" "$ROOT/apps/client"
send "${SESSION}:5" "$(loop_cmd "client" "cd '$ROOT'; bash scripts/da_expo_runner.sh client '$CLIENT_PORT' '$EXPO_MODE'")"

mk_shell_window 6 "merchant" "$ROOT/apps/merchant"
send "${SESSION}:6" "$(loop_cmd "merchant" "cd '$ROOT'; bash scripts/da_expo_runner.sh merchant '$MERCHANT_PORT' '$EXPO_MODE'")"

mk_shell_window 7 "courier" "$ROOT/apps/courier"
send "${SESSION}:7" "$(loop_cmd "courier" "cd '$ROOT'; bash scripts/da_expo_runner.sh courier '$COURIER_PORT' '$EXPO_MODE'")"

mk_shell_window 8 "platform" "$ROOT"
send "${SESSION}:8" "cd '$ROOT'; clear; echo '[DA] 8-platform ready'; echo 'Fenetre ops/platform libre.'; exec bash -i"

mk_shell_window 9 "shell" "$ROOT"
send "${SESSION}:9" "cd '$ROOT'; clear; echo '[DA] 9-shell ready'; exec bash -i"

tmux select-window -t "${SESSION}:1"

info "Session créée: $SESSION"
info "Attacher: tmux attach -t $SESSION"
info "Mode Expo: $EXPO_MODE"
info "Ports: API $API_PORT / client $CLIENT_PORT / merchant $MERCHANT_PORT / courier $COURIER_PORT"

if [ "$MODE" = "--no-attach" ]; then
exit 0
fi

exec tmux attach -t "$SESSION"
