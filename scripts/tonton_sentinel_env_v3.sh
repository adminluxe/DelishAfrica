#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ==========================================================
#  tonton_sentinel_env_v3.sh
#  - Fix définitif ERR_PNPM_INCLUDED_DEPS_CONFLICT
#  - Corrige Expo IDs (slug/owner/projectId) pour 3 apps
#  - Nettoie caches + ports
#  - Recrée/standardise tmux (10 fenêtres définitives)
# ==========================================================

NOW="$(date +%Y%m%d_%H%M%S)"
DEFAULT_ROOT="/opt/delishafrica/monorepo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd 2>/dev/null || true)"

if [[ ! -d "$ROOT_DIR/apps" ]]; then
  ROOT_DIR="$DEFAULT_ROOT"
fi
if [[ ! -d "$ROOT_DIR" ]]; then
  echo "❌ ROOT introuvable. Attendu: $DEFAULT_ROOT"
  exit 1
fi

BACKUP_DIR="$ROOT_DIR/.tonton_backups/sentinel_v3_$NOW"
LOG_DIR="$ROOT_DIR/.tonton_reports"
LOG_FILE="$LOG_DIR/sentinel_v3_$NOW.log"
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
ok(){  echo -e "✅ $*" | tee -a "$LOG_FILE"; }
warn(){ echo -e "⚠️  $*" | tee -a "$LOG_FILE"; }
die(){ echo -e "❌ $*" | tee -a "$LOG_FILE"; exit 1; }

need(){
  command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"
}

need tmux
need node
need pnpm
need npx
need curl

# --- IDs Expo validés (ceux de tes captures)
OWNER="purpleorchidgroup"
CLIENT_SLUG="delishafrica-client"
CLIENT_PID="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
MERCHANT_SLUG="delishafrica-merchant"
MERCHANT_PID="ac87e7fa-1e43-4baa-813e-6174797314a1"
COURIER_SLUG="delishafrica-courier"
COURIER_PID="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"

# --- stop DA_REL fantôme si présent
if tmux has-session -t DA_REL 2>/dev/null; then
  log "Suppression session tmux DA_REL…"
  tmux kill-session -t DA_REL || true
  ok "DA_REL supprimée"
else
  ok "DA_REL absente (ok)"
fi

# --- pnpm : autoriser -w sans warning bloquant
pnpm config set ignore-workspace-root-check true >/dev/null 2>&1 || true

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 - <<PY
import os
print(os.path.relpath("$f","$ROOT_DIR"))
PY
)"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
}

# --- patch configs Expo (app.json / app.config.*)
fix_config(){
  local app="$1" slug="$2" pid="$3"
  local cfg=""
  for cand in \
    "$ROOT_DIR/apps/$app/app.json" \
    "$ROOT_DIR/apps/$app/app.config.ts" \
    "$ROOT_DIR/apps/$app/app.config.js"
  do
    [[ -f "$cand" ]] && cfg="$cand" && break
  done

  if [[ -z "$cfg" ]]; then
    warn "Aucun config Expo trouvé pour $app (apps/$app/app.json ou app.config.*)"
    return 0
  fi

  backup_file "$cfg"

  node - "$cfg" "$slug" "$pid" "$OWNER" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const SLUG  = process.argv[3];
const PID   = process.argv[4];
const OWNER = process.argv[5];

let s = fs.readFileSync(file, 'utf8');

if (file.endsWith('.json')) {
  const j = JSON.parse(s);
  j.expo = j.expo || {};
  j.expo.slug = SLUG;
  j.expo.owner = OWNER;
  j.expo.extra = j.expo.extra || {};
  j.expo.extra.eas = j.expo.extra.eas || {};
  j.expo.extra.eas.projectId = PID;
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
  process.exit(0);
}

function forceConst(name, value) {
  const re = new RegExp(`(^\\s*(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*=)[^;]*;`, 'm');
  if (re.test(s)) s = s.replace(re, `$1 "${value}";`);
}
forceConst('SLUG', SLUG);
forceConst('EAS_PROJECT_ID', PID);
forceConst('OWNER', OWNER);

// patch objets config (slug/projectId/owner)
s = s.replace(/(\\bslug\\s*:\\s*)(['"`])[^'"`]*\\2/g, `$1"${SLUG}"`);
s = s.replace(/(\\bprojectId\\s*:\\s*)(['"`])[^'"`]*\\2/g, `$1"${PID}"`);
s = s.replace(/(\\bowner\\s*:\\s*)(['"`])[^'"`]*\\2/g, `$1"${OWNER}"`);

fs.writeFileSync(file, s);
NODE

  ok "Config Expo $app OK → $cfg (slug=$slug, pid=$pid, owner=$OWNER)"
}

log "Patch configs Expo (3 apps)…"
fix_config client   "$CLIENT_SLUG"   "$CLIENT_PID"
fix_config merchant "$MERCHANT_SLUG" "$MERCHANT_PID"
fix_config courier  "$COURIER_SLUG"  "$COURIER_PID"

# --- nettoyage node_modules + caches (LA CLÉ DU FIX PNPM)
clean_all(){
  log "Nettoyage node_modules + caches (pour casser le conflit pnpm)…"
  # node_modules (racine + sous-projets)
  find "$ROOT_DIR" -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true
  # caches Expo/Metro
  find "$ROOT_DIR" -type d \( -name .expo -o -name .expo-shared -o -name .turbo -o -name .cache \) -prune -exec rm -rf {} + 2>/dev/null || true
  rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
  ok "Nettoyage terminé"
}

clean_all

# --- install workspace robuste (pas de prune prod !!)
install_workspace(){
  log "pnpm -w install --force (prod+dev+optional)…"
  ( cd "$ROOT_DIR" && pnpm -w install --force --color=always ) 2>&1 | tee -a "$LOG_FILE" || return 1
  ok "pnpm install OK"
  return 0
}

if ! install_workspace; then
  warn "Échec pnpm install. Nettoyage + store prune + retry…"
  clean_all
  pnpm store prune >/dev/null 2>&1 || true
  install_workspace || die "pnpm install échoue encore. Voir log: $LOG_FILE"
fi

# --- vérifier/installer RNGH (après install !)
has_rngh(){
  ( cd "$ROOT_DIR" && pnpm -w -r list react-native-gesture-handler --depth 0 2>/dev/null | grep -q "react-native-gesture-handler@" )
}

log "Vérif react-native-gesture-handler (RNGH)…"
if has_rngh; then
  ok "RNGH déjà présent dans le workspace"
else
  warn "RNGH absent → ajout"
  # Si les apps ont leur package.json, on ajoute par app ; sinon on ajoute au workspace root
  added_any="0"
  for app in client merchant courier; do
    if [[ -f "$ROOT_DIR/apps/$app/package.json" ]]; then
      log "Ajout RNGH dans apps/$app…"
      ( cd "$ROOT_DIR/apps/$app" && pnpm add react-native-gesture-handler ) 2>&1 | tee -a "$LOG_FILE" || true
      added_any="1"
    fi
  done

  if [[ "$added_any" == "0" ]]; then
    log "Ajout RNGH au workspace root (-w)…"
    ( cd "$ROOT_DIR" && pnpm -w add react-native-gesture-handler ) 2>&1 | tee -a "$LOG_FILE" || true
  fi

  # recheck
  if has_rngh; then
    ok "RNGH installé"
  else
    warn "RNGH pas détecté après install (on continue, mais EAS dev-client devra confirmer)"
  fi
fi

# --- kill ports (Expo + API)
kill_port(){
  local p="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$p" 2>/dev/null || true)"
  elif command -v ss >/dev/null 2>&1; then
    pids="$(ss -lptn "sport = :$p" 2>/dev/null | awk -F'pid=' 'NF>1{print $2}' | awk -F',' '{print $1}' | sort -u || true)"
  fi
  [[ -z "$pids" ]] && return 0
  for pid in $pids; do
    kill -9 "$pid" 2>/dev/null || true
  done
  ok "Port $p libéré (pids: $pids)"
}

log "Libération ports classiques…"
for p in 8081 8082 8083 19000 19001 19002 3010 4001 3000 3001; do
  kill_port "$p" || true
done

# --- détecter dossier API (monorepo vs delishafrica-monorepo)
API_DIR=""
for cand in \
  "/opt/delishafrica/delishafrica-monorepo/services/api" \
  "$ROOT_DIR/services/api"
do
  [[ -f "$cand/package.json" ]] && API_DIR="$cand" && break
done

# --- tmux layout (10 fenêtres définitives)
SESSION="delishafrica"

ensure_window(){
  local idx="$1" name="$2" cwd="$3"
  if tmux list-windows -t "$SESSION" -F '#{window_index}' 2>/dev/null | grep -qx "$idx"; then
    tmux rename-window -t "$SESSION:$idx" "$name" || true
    tmux send-keys -t "$SESSION:$idx" "cd \"$cwd\" && clear" C-m
  else
    tmux new-window -t "$SESSION:$idx" -n "$name" -c "$cwd"
  fi
}

log "Setup tmux session '$SESSION' (10 fenêtres)…"
if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux new-session -d -s "$SESSION" -n root -c "$ROOT_DIR"
fi

# Important: ne pas fermer les fenêtres quand une commande crash
tmux setw -t "$SESSION" -g remain-on-exit on || true

# indices imposés
ensure_window 0 root     "$ROOT_DIR"
ensure_window 1 cmd      "$ROOT_DIR"
ensure_window 2 api      "$ROOT_DIR"
ensure_window 3 health   "$ROOT_DIR"
ensure_window 4 ports    "$ROOT_DIR"
ensure_window 5 client   "$ROOT_DIR/apps/client"
ensure_window 6 merchant "$ROOT_DIR/apps/merchant"
ensure_window 7 courier  "$ROOT_DIR/apps/courier"
ensure_window 8 platform "$ROOT_DIR/apps"
ensure_window 9 shell    "$ROOT_DIR"

# commandes (send-keys, donc ctrl+c ne ferme pas la fenêtre)
tmux send-keys -t "$SESSION:1" "cd \"$ROOT_DIR\" && clear" C-m

if [[ -n "$API_DIR" ]]; then
  tmux send-keys -t "$SESSION:2" "cd \"$API_DIR\" && (pnpm dev || pnpm start || pnpm start:dev)" C-m
else
  tmux send-keys -t "$SESSION:2" "echo '⚠️ API_DIR introuvable (attendu services/api).'" C-m
fi

tmux send-keys -t "$SESSION:3" "bash -lc 'while true; do echo; date; for u in http://127.0.0.1:3010/api/health http://127.0.0.1:4001/api/health http://127.0.0.1:3010/health http://127.0.0.1:4001/health; do echo \"-> \$u\"; curl -fsS \"\$u\" && echo; done || true; sleep 2; done'" C-m

tmux send-keys -t "$SESSION:4" "bash -lc 'command -v ss >/dev/null && watch -n 1 \"ss -lptn | egrep \\\"(:3010|:4001|:8081|:8082|:8083|:19000|:19001|:19002)\\\"\" || (while true; do echo; date; lsof -iTCP -sTCP:LISTEN -P | egrep \"(3010|4001|8081|8082|8083|19000|19001|19002)\" || true; sleep 2; done)'" C-m

expo_cmd(){
  local dir="$1" port="$2"
  # Toujours expo start --dev-client --tunnel --port --clear (QR propre)
  echo "cd \"$dir\" && export EXPO_NO_TELEMETRY=1 && export CI=1 && npx expo start --dev-client --tunnel --port $port --clear"
}

tmux send-keys -t "$SESSION:5" "$(expo_cmd "$ROOT_DIR/apps/client" 8081)" C-m
tmux send-keys -t "$SESSION:6" "$(expo_cmd "$ROOT_DIR/apps/merchant" 8083)" C-m
tmux send-keys -t "$SESSION:7" "$(expo_cmd "$ROOT_DIR/apps/courier" 8082)" C-m

if [[ -d "$ROOT_DIR/apps/platform" ]]; then
  tmux send-keys -t "$SESSION:8" "cd \"$ROOT_DIR/apps/platform\" && (pnpm dev || pnpm start || npm run dev || true)" C-m
else
  tmux send-keys -t "$SESSION:8" "echo 'ℹ️ apps/platform absent (ok).'" C-m
fi

tmux send-keys -t "$SESSION:9" "cd \"$ROOT_DIR\" && clear" C-m

ok "Sentinel v3 terminé."
log "➡️ Attache (si besoin) : tmux attach -t $SESSION"
log "🧾 Log: $LOG_FILE"
log "🧰 Backup: $BACKUP_DIR"
