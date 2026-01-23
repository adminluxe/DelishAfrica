#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="${SESSION:-delishafrica}"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/bury_scroll_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/bury_scroll_$NOW.log"

mkdir -p "$BK" "$REPORT_DIR"

log(){ echo -e "[$(date +%H:%M:%S)] $*" | tee -a "$REPORT"; }
need(){ command -v "$1" >/dev/null 2>&1 || { log "✖ Missing $1"; exit 1; }; }

need node
need tmux
need perl

RG_OK=1
command -v rg >/dev/null 2>&1 || RG_OK=0

apps=(client merchant courier)

backup(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

patch_ui_safe_flex(){
  local app="$1"
  local f="$ROOT/apps/$app/ui/ui.tsx"
  [[ -f "$f" ]] || return 0
  backup "$f"
  node -e '
const fs=require("fs");
const file=process.argv[1];
let s=fs.readFileSync(file,"utf8");

const re=/safe\s*:\s*{/m;
const m=s.match(re);
if(!m) process.exit(0);

const start=s.indexOf(m[0]);
const brace=s.indexOf("{", start);
const end=s.indexOf("}", brace);
if(brace<0 || end<0) process.exit(0);

const block=s.slice(brace+1,end);
if(/\bflex\s*:\s*1\b/.test(block)) process.exit(0);

s = s.slice(0, brace+1) + "\n    flex: 1," + s.slice(brace+1);
fs.writeFileSync(file, s);
' "$f"
  log "✅ $app: ui/ui.tsx -> styles.safe a maintenant flex:1"
}

patch_content_container_flexgrow(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  if [[ "$RG_OK" -eq 0 ]]; then
    log "ℹ️ rg absent -> skip patch contentContainerStyle pour $app"
    return 0
  fi

  # fichiers qui contiennent contentContainerStyle={{ ... flex: 1 ... }}
  local files
  files="$(rg -l --no-messages 'contentContainerStyle=\{\{[^}]*\bflex:\s*1\b' "$dir" || true)"
  [[ -n "$files" ]] || return 0

  log "🔧 $app: contentContainerStyle flex:1 -> flexGrow:1 (safe)"
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    backup "$f"
    perl -pi -e 's/contentContainerStyle=\{\{([^}]*)\bflex:\s*1\b/contentContainerStyle={{$1flexGrow: 1/g' "$f"
  done <<<"$files"
}

patch_parallax_files(){
  local app="$1"
  local dir="$ROOT/apps/$app"
  local files
  files="$(find "$dir" -maxdepth 6 -type f \( -name '*parallax*scroll*.tsx' -o -name '*Parallax*Scroll*.tsx' \) 2>/dev/null || true)"
  [[ -n "$files" ]] || return 0

  log "🔎 $app: patch parallax*scroll*"
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    backup "$f"

    # 1) contentContainerStyle flex -> flexGrow (dans ce fichier)
    perl -pi -e 's/contentContainerStyle=\{\{([^}]*)\bflex:\s*1\b/contentContainerStyle={{$1flexGrow: 1/g' "$f"

    # 2) force flex:1 dans styles.container ou styles.root si présents
    node -e '
const fs=require("fs");
const file=process.argv[1];
let s=fs.readFileSync(file,"utf8");

function ensureFlex(styleName){
  const re=new RegExp(styleName+"\\s*:\\s*\\{","m");
  const m=s.match(re);
  if(!m) return false;
  const idx=s.indexOf(m[0]);
  const brace=s.indexOf("{", idx);
  const end=s.indexOf("}", brace);
  if(brace<0 || end<0) return false;

  const block=s.slice(brace+1,end);
  if(/\bflex\s*:\s*1\b/.test(block)) return false;

  s = s.slice(0, brace+1) + "\n    flex: 1," + s.slice(brace+1);
  return true;
}

let changed=false;
changed = ensureFlex("container") || changed;
changed = ensureFlex("root") || changed;

if(changed) fs.writeFileSync(file, s);
' "$f"

    log "✅ patched: ${f#$ROOT/}"
  done <<<"$files"
}

tmux_win_index(){
  local name="$1"
  tmux list-windows -t "$SESSION" -F '#{window_index}:#{window_name}' \
    | awk -F: -v n="$name" '$2==n{print $1; exit 0}'
}

restart_metros(){
  tmux has-session -t "$SESSION" >/dev/null 2>&1 || { log "✖ tmux session '$SESSION' introuvable"; return 0; }
  log "🔁 Restart metros (NO CI) dans tmux '$SESSION'"

  local w

  w="$(tmux_win_index client || true)"
  if [[ -n "${w:-}" ]]; then
    tmux send-keys -t "$SESSION:$w" C-c \
      "cd '$ROOT/apps/client'; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export CI=false EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port 8081 --clear" C-m
  fi

  w="$(tmux_win_index courier || true)"
  if [[ -n "${w:-}" ]]; then
    tmux send-keys -t "$SESSION:$w" C-c \
      "cd '$ROOT/apps/courier'; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export CI=false EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port 8082 --clear" C-m
  fi

  w="$(tmux_win_index merchant || true)"
  if [[ -n "${w:-}" ]]; then
    tmux send-keys -t "$SESSION:$w" C-c \
      "cd '$ROOT/apps/merchant'; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export CI=false EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port 8083 --clear" C-m
  fi

  log "✅ Restart envoyés. QR attendus dans 5/6/7."
}

log "=== TONTON BURY SCROLL (bounded height + flexGrow + parallax) ==="
log "Backup: $BK"
log "Report:  $REPORT"

for app in "${apps[@]}"; do
  patch_ui_safe_flex "$app"
  patch_content_container_flexgrow "$app"
  patch_parallax_files "$app"
done

restart_metros

log "✅ DONE. Test scroll sur iPhone."
log "Si scroll KO encore: on passe en mode overlay-killer (pointerEvents/zIndex) avec ton rapport candidates."
