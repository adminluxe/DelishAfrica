#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="delishafrica"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/rescue_metros_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/rescue_metros_$NOW.log"

mkdir -p "$BK" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }
need(){ command -v "$1" >/dev/null 2>&1 || { log "❌ Missing: $1"; exit 1; }; }

need node
need tmux

log "== TONTON RESCUE: clean CI + fix app.json schema + restart metros =="
log "Backup: $BK"
log "Report: $REPORT"

cd "$ROOT"

# 1) Nettoyage CI (IMPORTANT: ne jamais faire export CI=)
unset CI || true
unset GITHUB_ACTIONS || true
unset JENKINS_URL || true
unset BUILD_NUMBER || true

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux set-environment -t "$SESSION" -u CI 2>/dev/null || true
  tmux set-environment -t "$SESSION" -u GITHUB_ACTIONS 2>/dev/null || true
  tmux set-environment -t "$SESSION" -u JENKINS_URL 2>/dev/null || true
  tmux set-environment -t "$SESSION" -u BUILD_NUMBER 2>/dev/null || true
  log "✅ tmux env cleaned: CI/GITHUB_ACTIONS/JENKINS_URL/BUILD_NUMBER unset"
else
  log "ℹ️ tmux session '$SESSION' introuvable (skip tmux env clean)"
fi

# 2) Fix app.json schema: si android/ios sont au root -> les remettre dans expo.*
patch_appjson(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  cp -a "$f" "$BK/$(echo "$f" | sed 's#/#__#g')" || true

  node - <<NODE
const fs = require("fs");
const path = "$f";
let raw = fs.readFileSync(path, "utf8");
let json;
try { json = JSON.parse(raw); } catch (e) {
  console.error("JSON parse failed:", path, e.message);
  process.exit(2);
}
if (!json.expo || typeof json.expo !== "object") json.expo = {};
// move root android/ios into expo.android/expo.ios
for (const k of ["android","ios"]) {
  if (json[k] && typeof json[k] === "object") {
    json.expo[k] = { ...(json.expo[k]||{}), ...json[k] };
    delete json[k];
  }
}
fs.writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
NODE
}

log "== Fix app.json schema (android/ios root-level -> expo.android/expo.ios) =="
patch_appjson "$ROOT/apps/client/app.json"
patch_appjson "$ROOT/apps/merchant/app.json"
patch_appjson "$ROOT/apps/courier/app.json"
log "✅ app.json schema patched (si nécessaire)"

# 3) Restart metros dans tmux (windows: 5 client, 6 merchant, 7 courier)
restart_metro(){
  local win="$1" dir="$2" port="$3"
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    log "❌ tmux session '$SESSION' missing, cannot restart metros automatically."
    return 1
  fi

  tmux send-keys -t "$SESSION:$win" C-c 2>/dev/null || true
  sleep 0.2
  tmux send-keys -t "$SESSION:$win" "cd \"$dir\"; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port $port --clear" C-m
  log "🔁 Metro restarted in window $win on port $port ($dir)"
}

log "== Restart metros (NO CI !) =="
restart_metro 5 "$ROOT/apps/client" 8081 || true
restart_metro 6 "$ROOT/apps/merchant" 8083 || true
restart_metro 7 "$ROOT/apps/courier" 8082 || true

log "✅ Done. QR attendu dans 5/6/7."
log "NB: si tu vois encore 'Metro is running in CI mode' => il reste une variable CI dans le pane. Re-run ce script."
