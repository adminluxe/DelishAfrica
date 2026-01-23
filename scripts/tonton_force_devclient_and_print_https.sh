#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="${1:-DA_REL}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }
need tmux
need python3
need pnpm

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "❌ tmux session '$SESSION' introuvable. Sessions dispo:"
  tmux ls || true
  exit 1
fi

log(){ echo -e "\n[$(date +%H:%M:%S)] $*"; }

# Trouve la window par nom (client/merchant/courier). Fallback: index connu.
win_by_name(){
  local name="$1"
  tmux list-windows -t "$SESSION" -F "#{window_index}:#{window_name}" \
    | awk -F: -v n="$name" '$2==n {print $1; exit 0}'
}

capture(){
  local win="$1"
  tmux capture-pane -p -t "$SESSION:$win" -S -2000 2>/dev/null || true
}

is_devclient(){
  local win="$1"
  local t; t="$(capture "$win")"
  echo "$t" | grep -qE 'expo-development-client/\?url='
}

is_expo_go(){
  local win="$1"
  local t; t="$(capture "$win")"
  echo "$t" | grep -qE 'Using Expo Go|Switching to --go| exp://'
}

toggle_s(){
  local win="$1"
  tmux send-keys -t "$SESSION:$win" "s" >/dev/null 2>&1 || true
}

restart_expo_devclient(){
  local win="$1" app="$2" port="$3"
  log "Restart $app en --dev-client (port $port, tunnel, clear) sur window $win"
  tmux send-keys -t "$SESSION:$win" C-c >/dev/null 2>&1 || true
  tmux send-keys -t "$SESSION:$win" C-m >/dev/null 2>&1 || true
  tmux send-keys -t "$SESSION:$win" "cd '$ROOT/apps/$app' && pnpm dev -- --dev-client --tunnel --port $port --clear" C-m
}

extract_https(){
  local win="$1"
  local t enc
  t="$(capture "$win")"
  enc="$(echo "$t" | grep -Eo 'expo-development-client/\?url=[^ ]+' | tail -n 1 | sed 's/.*url=//')"
  if [[ -z "${enc:-}" ]]; then
    echo ""
    return 0
  fi
  python3 - <<PY "$enc"
import sys, urllib.parse
print(urllib.parse.unquote(sys.argv[1]))
PY
}

# Mapping attendu
CLIENT_WIN="$(win_by_name client || true)";   [[ -n "$CLIENT_WIN"   ]] || CLIENT_WIN="5"
MERCH_WIN="$(win_by_name merchant || true)"; [[ -n "$MERCH_WIN"    ]] || MERCH_WIN="6"
COUR_WIN="$(win_by_name courier || true)";   [[ -n "$COUR_WIN"     ]] || COUR_WIN="7"

declare -A PORT=( ["client"]="8081" ["courier"]="8082" ["merchant"]="8083" )
declare -A WIN=(  ["client"]="$CLIENT_WIN" ["merchant"]="$MERCH_WIN" ["courier"]="$COUR_WIN" )

log "Session=$SESSION | windows: client=${WIN[client]} merchant=${WIN[merchant]} courier=${WIN[courier]}"

for app in client merchant courier; do
  w="${WIN[$app]}"
  log "Check $app (win $w)"

  # 1) Si déjà devclient: OK
  if is_devclient "$w"; then
    log "✅ $app est déjà en Dev Client."
    continue
  fi

  # 2) Si Expo Go: tente toggle 's' 2x
  if is_expo_go "$w"; then
    log "⚠️ $app semble en Expo Go → toggle 's'"
    toggle_s "$w"; sleep 1
    if ! is_devclient "$w"; then
      toggle_s "$w"; sleep 1
    fi
  fi

  # 3) Si toujours pas devclient: restart forcé
  if ! is_devclient "$w"; then
    restart_expo_devclient "$w" "$app" "${PORT[$app]}"
  fi

  # 4) Attendre apparition lien devclient (max ~60s)
  ok="0"
  for i in $(seq 1 60); do
    if is_devclient "$w"; then ok="1"; break; fi
    sleep 1
  done
  if [[ "$ok" != "1" ]]; then
    echo "❌ $app: pas de lien Dev Client détecté après restart. Va voir les logs dans tmux window $w."
    exit 2
  fi
  log "✅ $app: lien Dev Client détecté."
done

TS="$(date +%Y%m%d_%H%M%S)"
OUT="/tmp/devclient_https_$TS.txt"

{
  echo "=== HTTPS exp.direct (à coller dans iPhone > Dev Client > Enter URL manually) ==="
  for app in client merchant courier; do
    w="${WIN[$app]}"
    https="$(extract_https "$w")"
    printf "%-8s %s\n" "$(echo "$app" | tr '[:lower:]' '[:upper:]'):" "$https"
  done
  echo
  echo "Astuce: si tu colles l’URL en http:// -> iOS peut bloquer (ATS). On garde https:// uniquement."
} | tee "$OUT"

log "✅ Saved: $OUT"
