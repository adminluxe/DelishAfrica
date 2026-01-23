#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="${SESSION:-delishafrica}"

NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/master_doctor_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/master_doctor_$NOW.log"

mkdir -p "$BK" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }
need(){ command -v "$1" >/dev/null 2>&1 || { log "❌ Missing: $1"; exit 1; }; }

backup(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

tmux_win_index(){
  local name="$1"
  tmux list-windows -t "$SESSION" -F '#{window_index}:#{window_name}' \
    | awk -F: -v n="$name" '$2==n{print $1; exit 0}'
}

tmux_clean_env(){
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux set-environment -t "$SESSION" -u CI 2>/dev/null || true
    tmux set-environment -t "$SESSION" -u GITHUB_ACTIONS 2>/dev/null || true
    tmux set-environment -t "$SESSION" -u JENKINS_URL 2>/dev/null || true
    tmux set-environment -t "$SESSION" -u BUILD_NUMBER 2>/dev/null || true
    log "✅ tmux env cleaned: CI/GITHUB_ACTIONS/JENKINS_URL/BUILD_NUMBER unset"
  else
    log "ℹ️ tmux session '$SESSION' introuvable (ok hors tmux)"
  fi
}

fix_appjson_schema(){
  local app="$1"
  local file="$ROOT/apps/$app/app.json"
  [[ -f "$file" ]] || { log "⚠️ $app: app.json absent -> skip"; return 0; }
  backup "$file"
  node - "$file" <<'NODE'
const fs=require('fs');
// node "-" => argv[1] == "-" ; args réels à partir de argv[2]
const file=process.argv[2];
let raw=fs.readFileSync(file,'utf8');
let j=JSON.parse(raw);

if (!j.expo) {
  const {android, ios, plugins, extra, ...rest} = j;
  j = { expo: { ...rest } };
  if (android) j.expo.android = android;
  if (ios) j.expo.ios = ios;
  if (plugins) j.expo.plugins = plugins;
  if (extra) j.expo.extra = extra;
} else {
  if (j.android && !j.expo.android) { j.expo.android = j.android; delete j.android; }
  if (j.ios && !j.expo.ios) { j.expo.ios = j.ios; delete j.ios; }
}
fs.writeFileSync(file, JSON.stringify(j,null,2)+"\n");
NODE
  log "✅ $app: app.json schema nettoyé (android/ios sous expo)"
}

set_appjson_fields(){
  local app="$1" slug="$2" owner="$3" pid="$4"
  local file="$ROOT/apps/$app/app.json"
  [[ -f "$file" ]] || { log "⚠️ $app: app.json absent -> skip"; return 0; }
  backup "$file"
  node - "$file" "$slug" "$owner" "$pid" <<'NODE'
const fs=require('fs');
// node "-" => args à partir de argv[2]
const [file, slug, owner, pid] = process.argv.slice(2);
let j=JSON.parse(fs.readFileSync(file,'utf8'));
if (!j.expo) j={expo:j};
j.expo.slug = slug;
if (owner) j.expo.owner = owner;
j.expo.extra = j.expo.extra || {};
j.expo.extra.eas = j.expo.extra.eas || {};
j.expo.extra.eas.projectId = pid;
fs.writeFileSync(file, JSON.stringify(j,null,2)+"\n");
NODE
  log "✅ $app: slug/owner/projectId mis à jour"
}

restart_metro(){
  local app="$1" port="$2"
  local dir="$ROOT/apps/$app"
  local win
  win="$(tmux_win_index "$app" || true)"
  if [[ -z "${win:-}" ]]; then
    log "⚠️ Fenêtre tmux '$app' introuvable -> relance manuelle si besoin."
    log "   cd $dir && unset CI && export CI=false && npx expo start --dev-client --tunnel --port $port --clear"
    return 0
  fi
  tmux send-keys -t "$SESSION:$win" C-c \
    "cd \"$dir\"; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export CI=false; export EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port $port --clear" C-m
  log "✅ Metro relancé ($app) dans $SESSION:$win (port $port)"
}

fix_scroll_flexgrow(){
  log "=== PATCH SCROLL: contentContainerStyle flex:1 -> flexGrow:1 (safe) ==="
  while IFS= read -r -d '' f; do
    backup "$f"
    node - "$f" <<'NODE'
const fs=require('fs');
const file=process.argv[2];
let s=fs.readFileSync(file,'utf8');
s = s.replace(/(contentContainerStyle\s*=\s*\{[\s\S]{0,400}?)\bflex\s*:\s*1\b/g, '$1flexGrow: 1');
s = s.replace(/(contentContainerStyle\s*=\s*\[[\s\S]{0,400}?)\bflex\s*:\s*1\b/g, '$1flexGrow: 1');
fs.writeFileSync(file,s);
NODE
  done < <(find "$ROOT/apps" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) -print0)
  log "✅ Patch scroll appliqué (backups dans $BK)."
}

fix_eas_ids(){
  log "=== RESYNC EAS projectId via eas project:info (si possible) ==="
  need npx
  if ! npx -y eas-cli@latest whoami >/dev/null 2>&1; then
    log "❌ Pas loggé EAS. Fais: npx -y eas-cli@latest login"
    return 1
  fi

  declare -A SLUG
  SLUG[client]="delishafrica-client"
  SLUG[merchant]="delishafrica-merchant"
  SLUG[courier]="delishafrica-courier"

  for app in client merchant courier; do
    local dir="$ROOT/apps/$app"
    [[ -d "$dir" ]] || { log "⚠️ $app: dossier absent -> skip"; continue; }

    log "→ $app: eas project:info"
    local out
    if ! out="$(cd "$dir" && npx -y eas-cli@latest project:info --json 2>/dev/null)"; then
      log "❌ $app: project:info KO."
      log "   ➜ Fais: cd $dir && npx -y eas-cli@latest project:init"
      continue
    fi

    local pid owner
    pid="$(printf '%s' "$out" | node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(String(j.id||j.projectId||j.project?.id||""));')"
    owner="$(printf '%s' "$out" | node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(String(j.accountName||j.ownerAccount?.name||j.owner||j.account||""));')"

    if [[ -z "${pid:-}" ]]; then
      log "❌ $app: pas de projectId lisible."
      log "   ➜ Fais: cd $dir && npx -y eas-cli@latest project:init"
      continue
    fi

    fix_appjson_schema "$app"
    set_appjson_fields "$app" "${SLUG[$app]}" "$owner" "$pid"
    log "✅ $app: EAS projectId=$pid owner=$owner"
  done
}

usage(){
  cat <<USAGE
Usage: bash scripts/tonton_master_doctor.sh <cmd>
cmd:
  bootstrap        -> clean tmux env + fix app.json schema + restart metros
  fix-scroll       -> patch flexGrow + restart metros
  fix-eas          -> resync EAS projectId (project:info) ou te dit project:init
  restart-metros   -> restart metros uniquement
USAGE
}

cmd="${1:-bootstrap}"
need node

case "$cmd" in
  bootstrap)
    tmux_clean_env
    fix_appjson_schema client
    fix_appjson_schema merchant
    fix_appjson_schema courier
    restart_metro client 8081
    restart_metro courier 8082
    restart_metro merchant 8083
    log "✅ bootstrap fini. Report: $REPORT"
    ;;
  restart-metros)
    tmux_clean_env
    restart_metro client 8081
    restart_metro courier 8082
    restart_metro merchant 8083
    log "✅ metros relancés. Report: $REPORT"
    ;;
  fix-scroll)
    tmux_clean_env
    fix_scroll_flexgrow
    restart_metro client 8081
    restart_metro courier 8082
    restart_metro merchant 8083
    log "✅ fix-scroll fini. Report: $REPORT"
    ;;
  fix-eas)
    fix_eas_ids
    log "✅ fix-eas fini. Report: $REPORT"
    ;;
  *)
    usage
    exit 1
    ;;
esac
