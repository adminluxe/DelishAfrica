#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="delishafrica"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/surgeon_qr_scroll_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/surgeon_qr_scroll_$NOW.log"

mkdir -p "$BK" "$REPORT_DIR" "$ROOT/scripts"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

need(){ command -v "$1" >/dev/null 2>&1 || { log "❌ Missing: $1"; exit 1; }; }

need node
need tmux

# ripgrep optionnel
RG_OK=1
command -v rg >/dev/null 2>&1 || RG_OK=0

log "=== TONTON SURGEON: QR + app.json schema + scroll scan ==="
log "Backup: $BK"
log "Report: $REPORT"

# 1) FIX: ne JAMAIS laisser CI=""
# - enlever CI de l'environnement tmux (si présent)
if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux set-environment -t "$SESSION" -u CI 2>/dev/null || true
  tmux set-environment -t "$SESSION" -u GITHUB_ACTIONS 2>/dev/null || true
  tmux set-environment -t "$SESSION" -u JENKINS_URL 2>/dev/null || true
  tmux set-environment -t "$SESSION" -u BUILD_NUMBER 2>/dev/null || true
  log "✅ tmux env cleaned: CI/GITHUB_ACTIONS/JENKINS_URL/BUILD_NUMBER unset"
else
  log "ℹ️ tmux session '$SESSION' not found (ok)"
fi

# 2) FIX app.json schema + ids (supprime android/ios root-level + force expo.extra.eas.projectId)
OWNER="delishafrica"

declare -A SLUG PID
SLUG[client]="delishafrica-client"
PID[client]="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"

SLUG[merchant]="delishafrica-merchant"
PID[merchant]="ac87e7fa-1e43-4baa-813e-6174797314a1"

SLUG[courier]="delishafrica-courier"
PID[courier]="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"

patch_appjson(){
  local app="$1"
  local file="$ROOT/apps/$app/app.json"
  if [[ ! -f "$file" ]]; then
    log "⚠️ $app: app.json introuvable ($file) — skip"
    return 0
  fi

  mkdir -p "$BK/apps/$app"
  cp -a "$file" "$BK/apps/$app/app.json.bak"

  node - "$file" "${SLUG[$app]}" "${PID[$app]}" "$OWNER" <<'NODE'
const fs = require("fs");

const file = process.argv[1];
const slug = process.argv[2];
const projectId = process.argv[3];
const owner = process.argv[4];

let raw = fs.readFileSync(file, "utf8");

// tolérance BOM
raw = raw.replace(/^\uFEFF/, "");

let obj;
try { obj = JSON.parse(raw); }
catch (e) {
  console.error("JSON parse failed:", file, e.message);
  process.exit(2);
}

if (!obj || typeof obj !== "object") obj = {};
if (!obj.expo || typeof obj.expo !== "object") obj.expo = {};

const rootAndroid = obj.android;
const rootIos = obj.ios;

// move root android/ios -> expo.android/ios (merge, prefer expo on conflicts)
if (rootAndroid && typeof rootAndroid === "object") {
  obj.expo.android = Object.assign({}, rootAndroid, obj.expo.android || {});
  delete obj.android;
}
if (rootIos && typeof rootIos === "object") {
  obj.expo.ios = Object.assign({}, rootIos, obj.expo.ios || {});
  delete obj.ios;
}

obj.expo.slug = slug;
obj.expo.owner = owner;

if (!obj.expo.extra || typeof obj.expo.extra !== "object") obj.expo.extra = {};
if (!obj.expo.extra.eas || typeof obj.expo.extra.eas !== "object") obj.expo.extra.eas = {};
obj.expo.extra.eas.projectId = projectId;

fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
NODE

  log "✅ $app: app.json patched (owner=$OWNER slug=${SLUG[$app]} projectId=${PID[$app]})"
}

log "--- Fixing app.json schema/ids ---"
patch_appjson client
patch_appjson merchant
patch_appjson courier

# 3) RELANCE METROS (sans CI, et avec vrais booléens 0/1)
restart_metro(){
  local win="$1" dir="$2" port="$3"
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    log "⚠️ Session tmux '$SESSION' introuvable, je ne relance pas les metros automatiquement."
    return 0
  fi

  # stop éventuel
  tmux send-keys -t "$SESSION:$win" C-c 2>/dev/null || true
  tmux send-keys -t "$SESSION:$win" C-c 2>/dev/null || true

  # IMPORTANT: PAS de "export CI=" !!!
  local cmd="cd \"$dir\"; unset CI; unset GITHUB_ACTIONS; unset JENKINS_URL; unset BUILD_NUMBER; export EXPO_NO_TELEMETRY=1; \
EXPO_PUBLIC_SCROLL_DIAG=1 EXPO_PUBLIC_SCROLL_FIX=1 EXPO_PUBLIC_LAYOUT_SCALPEL=0 EXPO_PUBLIC_RESPONDER_SCALPEL=0 EXPO_PUBLIC_BG_OFF=0 \
npx expo start --dev-client --tunnel --port $port --clear"
  tmux send-keys -t "$SESSION:$win" "$cmd" C-m
  log "✅ Metro relaunched in $SESSION:$win (port $port)"
}

log "--- Restart metros (client/merchant/courier) ---"
restart_metro 5 "$ROOT/apps/client" 8081
restart_metro 6 "$ROOT/apps/merchant" 8083
restart_metro 7 "$ROOT/apps/courier" 8082

# 4) SCAN “Scroll killers” (rapport)
log "--- Scroll scan report ---"
{
  echo "ROOT=$ROOT"
  echo "DATE=$(date)"
  echo
  if [[ "$RG_OK" == "1" ]]; then
    echo "[A] Responder / PanResponder suspects"
    rg -n "onMoveShouldSetResponderCapture|onStartShouldSetResponderCapture|onMoveShouldSetResponder|onStartShouldSetResponder|PanResponder\.create|onResponderMove" "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" || true
    echo
    echo "[B] scrollEnabled={false} suspects"
    rg -n "scrollEnabled=\{false\}|scrollEnabled:\s*false" "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" || true
    echo
    echo "[C] contentContainerStyle flex:1 suspects (souvent tue le scroll)"
    rg -n "contentContainerStyle=\{\{[^}]*flex:\s*1" "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" || true
    echo
    echo "[D] pointerEvents='none' wrappers (danger si wrap children)"
    rg -n "pointerEvents=\"none\"|pointerEvents='none'" "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" || true
    echo
    echo "[E] TouchTrace still referenced?"
    rg -n "TouchTrace" "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" || true
  else
    echo "rg not installed; install ripgrep or use grep -R manually."
  fi
} | tee -a "$REPORT"

log "✅ Done. If QR still missing, DO NOT set CI to empty. Only 'unset CI'."
log "Next: test scroll in the 3 apps; report is: $REPORT"
