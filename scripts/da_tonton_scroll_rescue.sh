#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# =========================
#  DelishAfrica - Tonton Scroll Rescue (3 apps)
#  Root: /opt/delishafrica/monorepo
#  - Audit + patch scroll suspects (flexGrow + overlays pointerEvents)
#  - Clean ports/caches
#  - Start tmux 10 windows + run metros
# =========================

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
SESSION="${DA_TMUX_SESSION:-delish}"
APPS=(client courier merchant)

# Ports (golden path)
PORT_CLIENT="${DA_PORT_CLIENT:-8081}"
PORT_COURIER="${DA_PORT_COURIER:-8082}"
PORT_MERCHANT="${DA_PORT_MERCHANT:-8083}"

# Optional switches
DO_PATCH="${DA_PATCH:-1}"                 # 1=apply patches, 0=audit only
DO_TMUX="${DA_TMUX:-1}"                   # 1=start tmux, 0=don't
DO_CLEAN="${DA_CLEAN:-1}"                 # 1=kill ports/caches, 0=don't
PATCH_OVERLAYS="${DA_PATCH_OVERLAYS:-1}"  # 1=try overlay pointerEvents fix
DRY_RUN="${DA_DRY_RUN:-0}"                # 1=print actions, do nothing

ts() { date "+%Y%m%d_%H%M%S"; }
NOW="$(ts)"

BACKUP_DIR="$ROOT/.tonton_backups/scroll_rescue_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/scroll_rescue_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log() {
  echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"
}

die() {
  log "❌ $*"
  exit 1
}

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN ▶ $*"
    return 0
  fi
  # shellcheck disable=SC2086
  eval "$@"
}

need_dir() {
  [[ -d "$1" ]] || die "Dossier introuvable: $1"
}

have() { command -v "$1" >/dev/null 2>&1; }

relpath() {
  python3 - <<PY 2>/dev/null || true
import os,sys
root=sys.argv[1]; p=sys.argv[2]
print(os.path.relpath(p, root))
PY
}

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

rg_or_grep() {
  # usage: rg_or_grep "pattern" "path"
  local pattern="$1"
  local path="$2"
  if have rg; then
    rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' "$pattern" "$path" || true
  else
    grep -RIn --exclude-dir node_modules --exclude-dir .git "$pattern" "$path" || true
  fi
}

# ---------- PRECHECK ----------
log "🧭 Root = $ROOT"
need_dir "$ROOT"
need_dir "$ROOT/apps"

for a in "${APPS[@]}"; do
  need_dir "$ROOT/apps/$a"
done

log "🧾 Report: $REPORT"
log "📦 Backup dir: $BACKUP_DIR"

if [[ -d "$ROOT/.git" ]] && have git; then
  log "🔎 Git status (avant):"
  (cd "$ROOT" && git status --porcelain) | tee -a "$REPORT" || true
fi

# ---------- AUDIT ----------
log "🔬 Audit: patterns connus qui tuent le scroll"
{
  echo "---- contentContainerStyle flex:1 (à remplacer) ----"
  rg_or_grep "contentContainerStyle=\\{\\{\\s*flex\\s*:\\s*1" "$ROOT/apps" || true
  echo
  echo "---- PanResponder / GestureDetector (suspects) ----"
  rg_or_grep "PanResponder\\.create\\(|GestureDetector|Gesture\\.Pan\\(" "$ROOT/apps" || true
  echo
  echo "---- pointerEvents (overlays potentiels) ----"
  rg_or_grep "pointerEvents=" "$ROOT/apps" || true
  echo
  echo "---- Touch wrappers plein écran (suspects) ----"
  rg_or_grep "TouchableWithoutFeedback|Keyboard\\.dismiss\\(|onStartShouldSetResponder|onMoveShouldSetResponder" "$ROOT/apps" || true
} | tee -a "$REPORT"

# ---------- PATCHES ----------
patch_flexgrow_in_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  # Only touch ts/tsx
  [[ "$f" =~ \.(ts|tsx)$ ]] || return 0

  # Replace ONLY contentContainerStyle={{ flex: 1 ... }} -> flexGrow
  # (idempotent: won't re-touch flexGrow)
  if rg_or_grep "contentContainerStyle=\\{\\{\\s*flex\\s*:\\s*1" "$f" | head -n1 >/dev/null; then
    backup_file "$f"
    run "perl -0777 -pi -e 's/contentContainerStyle=\\{\\{\\s*flex\\s*:\\s*1\\s*([,}])/contentContainerStyle={{ flexGrow: 1$1/g' \"$f\""
  fi
}

patch_overlay_pointerevents_in_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  [[ "$f" =~ \.(ts|tsx)$ ]] || return 0

  # Only target decorative files by name (safe zone)
  case "$f" in
    *Background*.ts*|*Overlay*.ts*|*Snow*.ts* ) ;;
    *) return 0 ;;
  esac

  # If file has absoluteFill / position absolute and NO pointerEvents, inject pointerEvents="none"
  if rg_or_grep "absoluteFill|position\\s*:\\s*['\\\"]absolute['\\\"]" "$f" | head -n1 >/dev/null; then
    if ! rg_or_grep "pointerEvents=" "$f" | head -n1 >/dev/null; then
      backup_file "$f"
      # Inject on first <View ...> OR <Animated.View ...>
      run "perl -0777 -pi -e '
        if (\$_ !~ /pointerEvents=/) {
          \$_ =~ s/<View(?![^>]*\\bpointerEvents=)/<View pointerEvents=\"none\"/;
          \$_ =~ s/<Animated\\.View(?![^>]*\\bpointerEvents=)/<Animated.View pointerEvents=\"none\"/;
        }
      ' \"$f\""
    fi
  fi
}

if [[ "$DO_PATCH" == "1" ]]; then
  log "🩺 Patch: flexGrow (safe) sur les 3 apps"
  while IFS= read -r f; do
    patch_flexgrow_in_file "$f"
  done < <(find "$ROOT/apps" -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*")

  if [[ "$PATCH_OVERLAYS" == "1" ]]; then
    log "🩹 Patch: overlays décoratifs -> pointerEvents=\"none\" (safe zone: *Background*/*Overlay*)"
    while IFS= read -r f; do
      patch_overlay_pointerevents_in_file "$f"
    done < <(find "$ROOT/apps" -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*")
  else
    log "⏭️ Overlay patch désactivé (DA_PATCH_OVERLAYS=0)"
  fi

  log "✅ Patch terminé."
else
  log "⏭️ Mode audit only (DA_PATCH=0) : aucun fichier modifié."
fi

if [[ -d "$ROOT/.git" ]] && have git; then
  log "🔎 Git status (après):"
  (cd "$ROOT" && git status --porcelain) | tee -a "$REPORT" || true
fi

# ---------- CLEAN ----------
kill_port() {
  local p="$1"
  if have lsof; then
    local pids
    pids="$(lsof -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids:-}" ]]; then
      log "🧨 Kill port :$p -> $pids"
      run "echo \"$pids\" | xargs -r kill -9"
    fi
  fi
}

if [[ "$DO_CLEAN" == "1" ]]; then
  log "🧼 Clean: kill processes Expo/Metro + libérer ports + caches"
  run "tmux kill-session -t \"$SESSION\" >/dev/null 2>&1 || true"

  # Kill common processes
  run "pkill -f \"expo start\" >/dev/null 2>&1 || true"
  run "pkill -f \"expo-dev-server\" >/dev/null 2>&1 || true"
  run "pkill -f \"metro\" >/dev/null 2>&1 || true"
  run "pkill -f \"react-native\" >/dev/null 2>&1 || true"

  # Ports
  for p in 8081 8082 8083 8084 8085 8086 19000 19001 19002 19003 19004 3010 3000 4001; do
    kill_port "$p"
  done

  # Caches
  run "rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true"
  run "rm -rf \"$ROOT/node_modules/.cache\" 2>/dev/null || true"
  for a in \"${APPS[@]}\"; do
    run "rm -rf \"$ROOT/apps/$a/.expo\" 2>/dev/null || true"
    run "rm -rf \"$ROOT/apps/$a/node_modules/.cache\" 2>/dev/null || true"
  done

  log "✅ Clean terminé."
else
  log "⏭️ Clean désactivé (DA_CLEAN=0)"
fi

# ---------- TMUX ----------
tmux_cmd_keep() {
  # runs command and keeps shell even if ctrl+c or exit
  # usage: tmux_cmd_keep "cd ...; cmd"
  local cmd="$1"
  printf "bash -lc '%s; echo; echo \"[pane] terminé/interrompu → shell actif\"; exec bash'\n" "$cmd"
}

start_metro_cmd() {
  local app="$1"
  local port="$2"
  local dir="$ROOT/apps/$app"

  # Prefer pnpm if available
  if have pnpm; then
    echo "cd \"$dir\" && pnpm dev -- --tunnel --port $port --clear"
  else
    echo "cd \"$dir\" && npx expo start --dev-client --tunnel --port $port --clear"
  fi
}

api_logs_cmd() {
  # Best-effort: show docker compose logs if possible, otherwise show hints.
  local cmd="cd \"$ROOT\"; "

  if have docker && [[ -f "$ROOT/docker-compose.yml" ]]; then
    cmd+="docker compose ps || true; "
    # choose a service name that contains api
    cmd+="SVC=\$(docker compose config --services 2>/dev/null | grep -E \"api|backend\" | head -n1 || true); "
    cmd+="if [ -n \"\$SVC\" ]; then echo \"[api-logs] docker compose logs -f \$SVC\"; docker compose logs -f --tail=200 \"\$SVC\"; else echo \"[api-logs] Aucun service api/backend détecté dans docker-compose.yml\"; fi"
    echo "$cmd"
    return 0
  fi

  # systemd hint
  cmd+="echo \"[api-logs] Hint: si service systemd existe → sudo journalctl -u delish-stack.service -f\"; exec bash"
  echo "$cmd"
}

health_watch_cmd() {
  cat <<'CMD'
set -e
echo "[health] ping toutes les 2s (CTRL+C pour stopper)"
while true; do
  printf "%s  " "$(date '+%H:%M:%S')"
  (curl -fsS http://127.0.0.1:3010/api/v1/health \
    || curl -fsS http://127.0.0.1:3010/api/health \
    || curl -fsS https://api.delishafrica.me/api/v1/health \
    || curl -fsS https://api.delishafrica.me/api/health \
    || echo "KO") 2>/dev/null | head -c 120
  echo
  sleep 2
done
CMD
}

ports_watch_cmd() {
  cat <<'CMD'
echo "[ports] refresh 1s (CTRL+C pour stopper)"
while true; do
  clear
  date
  echo
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP -sTCP:LISTEN -P | egrep ":(3010|8081|8082|8083|19000|19001|19002|19003)" || true
  else
    ss -ltnp | egrep ":(3010|8081|8082|8083|19000|19001|19002|19003)" || true
  fi
  sleep 1
done
CMD
}

if [[ "$DO_TMUX" == "1" ]]; then
  log "🧱 Start tmux layout (10 fenêtres) : 0..9"

  run "tmux kill-session -t \"$SESSION\" >/dev/null 2>&1 || true"
  run "tmux new-session -d -s \"$SESSION\" -n \"shell0\" \"bash\""

  # harden-ish
  run "tmux set -t \"$SESSION\" remain-on-exit on"
  run "tmux set -t \"$SESSION\" mouse on"
  run "tmux set -t \"$SESSION\" history-limit 50000"
  run "tmux set -t \"$SESSION\" status on"

  # Window 1: cmd (empty)
  run "tmux new-window -t \"$SESSION\":1 -n \"cmd\" \"bash\""

  # Window 2: api
  run "tmux new-window -t \"$SESSION\":2 -n \"api\" \"$(tmux_cmd_keep "$(api_logs_cmd)")\""

  # Window 3: health
  run "tmux new-window -t \"$SESSION\":3 -n \"health\" \"$(tmux_cmd_keep "$(health_watch_cmd)")\""

  # Window 4: ports
  run "tmux new-window -t \"$SESSION\":4 -n \"ports\" \"$(tmux_cmd_keep "$(ports_watch_cmd)")\""

  # Window 5: client
  run "tmux new-window -t \"$SESSION\":5 -n \"client\" \"$(tmux_cmd_keep "$(start_metro_cmd client "$PORT_CLIENT")")\""

  # Window 6: merchant
  run "tmux new-window -t \"$SESSION\":6 -n \"merchant\" \"$(tmux_cmd_keep "$(start_metro_cmd merchant "$PORT_MERCHANT")")\""

  # Window 7: courier
  run "tmux new-window -t \"$SESSION\":7 -n \"courier\" \"$(tmux_cmd_keep "$(start_metro_cmd courier "$PORT_COURIER")")\""

  # Window 8: platform (best effort)
  if [[ -d "$ROOT/apps/platform" ]]; then
    if have pnpm; then
      run "tmux new-window -t \"$SESSION\":8 -n \"platform\" \"$(tmux_cmd_keep "cd \"$ROOT/apps/platform\" && pnpm dev")\""
    else
      run "tmux new-window -t \"$SESSION\":8 -n \"platform\" \"bash\""
    fi
  else
    run "tmux new-window -t \"$SESSION\":8 -n \"platform\" \"bash\""
  fi

  # Window 9: shell2
  run "tmux new-window -t \"$SESSION\":9 -n \"shell2\" \"bash\""

  run "tmux select-window -t \"$SESSION\":1"
  log "✅ tmux prêt : tmux attach -t $SESSION"
else
  log "⏭️ tmux désactivé (DA_TMUX=0)"
fi

log "🎯 FIN. Rapport: $REPORT"
log "🧯 Rollback: restaure depuis $BACKUP_DIR (ou git checkout .)"
