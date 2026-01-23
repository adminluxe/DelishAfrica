#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="${SESSION:-delishafrica}"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/rescue_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/rescue_$NOW.log"

mkdir -p "$BK" "$REPORT_DIR"

log(){ echo -e "\n[$(date +%H:%M:%S)] $*" | tee -a "$REPORT"; }
need(){ command -v "$1" >/dev/null 2>&1 || { log "❌ Missing '$1'"; exit 1; }; }

need tmux
need node

apps=("client" "merchant" "courier")
declare -A ports=(["client"]=8081 ["courier"]=8082 ["merchant"]=8083)

clean_tmux_env(){
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    for k in CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; do
      tmux set-environment -t "$SESSION" -u "$k" 2>/dev/null || true
    done
    log "✅ tmux env cleaned (CI/GITHUB_ACTIONS/JENKINS_URL/BUILD_NUMBER unset)"
  else
    log "ℹ️ tmux session '$SESSION' not found (ok)"
  fi

  # IMPORTANT: never CI=""
  unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER || true
  export CI=false
}

fix_ci_in_env_files(){
  log "== Remove CI= from app .env files (avoid empty/invalid booleans) =="
  for app in "${apps[@]}"; do
    dir="$ROOT/apps/$app"
    for f in "$dir/.env.local" "$dir/.env.development" "$dir/.env"; do
      [[ -f "$f" ]] || continue
      cp -a "$f" "$BK/${app}_$(basename "$f").bak"
      perl -pi -e 's/^\s*CI\s*=.*\n//mg' "$f"
    done
  done
  log "✅ CI= removed from .env* (backups in $BK)"
}

enable_scalpel_env(){
  local enable="$1" # true/false
  log "== Set scalpel env = $enable =="
  for app in "${apps[@]}"; do
    dir="$ROOT/apps/$app"
    f="$dir/.env.local"
    [[ -f "$f" ]] || touch "$f"
    cp -a "$f" "$BK/${app}_.env.local.bak"

    perl -pi -e '
      s/^\s*EXPO_PUBLIC_BG_OFF\s*=.*\n//mg;
      s/^\s*EXPO_PUBLIC_LAYOUT_SCALPEL\s*=.*\n//mg;
      s/^\s*EXPO_PUBLIC_RESPONDER_SCALPEL\s*=.*\n//mg;
      s/^\s*EXPO_PUBLIC_SCROLL_FIX\s*=.*\n//mg;
    ' "$f"

    cat >>"$f" <<EOT

# --- tonton scalpel ($NOW) ---
EXPO_PUBLIC_BG_OFF=$enable
EXPO_PUBLIC_LAYOUT_SCALPEL=$enable
EXPO_PUBLIC_RESPONDER_SCALPEL=$enable
EXPO_PUBLIC_SCROLL_FIX=true
EOT
  done
  log "✅ apps/*/.env.local updated (backups in $BK)"
}

patch_scroll_patterns(){
  log "== Patch scroll/responder patterns (backups) =="

  local cand="$BK/candidates.txt"
  : > "$cand"

  if command -v rg >/dev/null 2>&1; then
    rg -n --no-heading 'contentContainerStyle\s*=\s*\{\{[^}]*\bflex\s*:\s*1\b' "$ROOT/apps" "$ROOT/packages" >>"$cand" || true
    rg -n --no-heading 'scrollEnabled\s*=\s*\{\s*false\s*\}' "$ROOT/apps" "$ROOT/packages" >>"$cand" || true
    rg -n --no-heading 'on(Start|Move)ShouldSetResponder(Capture)?\s*=\s*\{\s*\(\)\s*=>\s*true\s*\}' "$ROOT/apps" "$ROOT/packages" >>"$cand" || true
  else
    grep -RIn 'contentContainerStyle' "$ROOT/apps" "$ROOT/packages" >>"$cand" || true
    grep -RIn 'scrollEnabled' "$ROOT/apps" "$ROOT/packages" >>"$cand" || true
    grep -RIn 'ShouldSetResponder' "$ROOT/apps" "$ROOT/packages" >>"$cand" || true
  fi

  awk -F: '{print $1}' "$cand" | sort -u | while read -r f; do
    [[ -f "$f" ]] || continue
    mkdir -p "$BK/files/$(dirname "${f#$ROOT/}")"
    cp -a "$f" "$BK/files/${f#$ROOT/}"
  done

  awk -F: '{print $1}' "$cand" | sort -u | while read -r f; do
    [[ -f "$f" ]] || continue
    perl -0777 -pi -e '
      s/(contentContainerStyle\s*=\s*\{\{[^}]*?)\bflex\s*:\s*1\b/\1flexGrow: 1/g;
      s/\bscrollEnabled\s*=\s*\{\s*false\s*\}/scrollEnabled={true \/* tonton */}/g;
      s/\bonStartShouldSetResponder(Capture)?\s*=\s*\{\s*\(\)\s*=>\s*true\s*\}/onStartShouldSetResponder$1={() => false \/* tonton */}/g;
      s/\bonMoveShouldSetResponder(Capture)?\s*=\s*\{\s*\(\)\s*=>\s*true\s*\}/onMoveShouldSetResponder$1={() => false \/* tonton */}/g;
    ' "$f"
  done

  log "✅ Patch applied. Backups: $BK/files"
  log "Candidates: $cand"
}

restart_metros(){
  clean_tmux_env

  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    log "ℹ️ tmux '$SESSION' not found; printing commands"
    for app in "${apps[@]}"; do
      port="${ports[$app]}"
      echo "cd \"$ROOT/apps/$app\"; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export CI=false EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port $port --clear"
    done | tee -a "$REPORT"
    return 0
  fi

  get_win(){
    local name="$1"
    tmux list-windows -t "$SESSION" -F '#{window_index}:#{window_name}' | awk -F: -v n="$name" '$2==n{print $1; exit}'
  }

  w_client="$(get_win client || true)";   [[ -n "$w_client" ]]   || w_client=5
  w_merchant="$(get_win merchant || true)"; [[ -n "$w_merchant" ]] || w_merchant=6
  w_courier="$(get_win courier || true)"; [[ -n "$w_courier" ]] || w_courier=7

  send_restart(){
    local w="$1" app="$2" port="$3"
    local cmd="cd \"$ROOT/apps/$app\"; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export CI=false EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port $port --clear"
    tmux send-keys -t "$SESSION:$w" C-c 2>/dev/null || true
    sleep 0.2
    tmux send-keys -t "$SESSION:$w" "$cmd" C-m
  }

  send_restart "$w_client" client "${ports[client]}"
  send_restart "$w_merchant" merchant "${ports[merchant]}"
  send_restart "$w_courier" courier "${ports[courier]}"

  log "✅ Metros restarted (client/merchant/courier). Report: $REPORT"
}

usage(){
  cat <<USAGE
Usage: $0 <cmd>
  bootstrap       : clean env + remove CI from .env + patch scroll/responder + restart metros
  patch-scroll    : patch scroll/responder only
  scalpel-on      : set EXPO_PUBLIC_* scalpel flags true
  scalpel-off     : set EXPO_PUBLIC_* scalpel flags false
  restart-metros  : restart metros safely (CI=false, never empty)
USAGE
}

cmd="${1:-}"
case "$cmd" in
  bootstrap) clean_tmux_env; fix_ci_in_env_files; patch_scroll_patterns; restart_metros ;;
  patch-scroll) patch_scroll_patterns ;;
  scalpel-on) enable_scalpel_env true ;;
  scalpel-off) enable_scalpel_env false ;;
  restart-metros) restart_metros ;;
  *) usage; exit 1 ;;
esac
