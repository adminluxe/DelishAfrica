#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
# scripts/finalize_local_api.sh
set -Eeuo pipefail

QUIET=0
TIMEOUT_SECS=90

for arg in "$@"; do
  case "$arg" in
    --quiet|-q) QUIET=1 ;;
    --timeout=*) TIMEOUT_SECS="${arg#*=}" ;;
    --timeout) shift; TIMEOUT_SECS="${1:-90}" ;;
    *) ;;
  esac
done

log() { [[ "$QUIET" == "1" ]] && return 0 || echo -e "$*"; }
err() { echo -e "❌ $*" >&2; }
ok()  { echo -e "✅ $*"; }
warn(){ echo -e "⚠️  $*"; }
need(){ command -v "$1" >/dev/null 2>&1 || { err "Manquant: $1"; exit 1; }; }

# localise racine du repo
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --show-toplevel >/dev/null 2>&1; then
  ROOT="$(git -C "$ROOT" rev-parse --show-toplevel)"
fi
cd "$ROOT"

APP_NAME="delish-api"
API_DIR="$ROOT/services/api"
ECOSYSTEM="$ROOT/ecosystem.config.js"
RESTART_SH="$API_DIR/scripts/restart_api.sh"
DUMP="$HOME/.pm2/dump.pm2"
README="$ROOT/README.md"
MAKEFILE="$ROOT/Makefile"
PKG="$ROOT/package.json"

need pnpm; need pm2; need curl; need sed; need bash

# ---------- 1) restart_api.sh ----------
mkdir -p "$API_DIR/scripts"
cat > "$RESTART_SH" <<"EOF"
#!/usr/bin/env bash
set -Eeuo pipefail
QUIET=0
TIMEOUT_SECS="${TIMEOUT_SECS:-90}"

for arg in "$@"; do
  case "$arg" in
    --quiet|-q) QUIET=1 ;;
    --timeout=*) TIMEOUT_SECS="${arg#*=}" ;;
    --timeout) shift; TIMEOUT_SECS="${1:-90}" ;;
    *) ;;
  esac
done

log(){ [[ "$QUIET" == "1" ]] && return 0 || echo -e "$*"; }

API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$API_DIR/../.." && pwd)"

cd "$API_DIR"
log "🔨 Build API…"
pnpm -C "$API_DIR" build

log "🚀 (Re)start via PM2…"
pm2 restart delish-api --update-env || pm2 start "$REPO_ROOT/ecosystem.config.js" --only delish-api --update-env

log "⏳ Attente de la health (${TIMEOUT_SECS}s max)…"
SECS=0
until curl -sf http://localhost:4001/api/health >/dev/null 2>&1; do
  sleep 0.5
  SECS=$((SECS+1))
  if (( SECS >= TIMEOUT_SECS )); then
    echo "❌ L'API n'est pas healthy sous ${TIMEOUT_SECS}s."
    echo "— Derniers logs PM2 —"
    pm2 logs delish-api --lines 120 --nostream || true
    exit 1
  fi
done
echo "✓ API OK :4001"
EOF
chmod +x "$RESTART_SH"
ok "Script API → $RESTART_SH"

# ---------- 2) Neutraliser NODE_OPTIONS (ecosystem + dump) ----------
if [[ -f "$ECOSYSTEM" ]]; then
  if grep -q "env:" "$ECOSYSTEM"; then
    if ! grep -q "NODE_OPTIONS" "$ECOSYSTEM"; then
      sed -i '0,/env:[[:space:]]*{/s//&\
      NODE_OPTIONS: "",/' "$ECOSYSTEM"
    else
      sed -i 's/NODE_OPTIONS:[^,}]*/NODE_OPTIONS: ""/g' "$ECOSYSTEM"
    fi
    ok "NODE_OPTIONS vidé dans $ECOSYSTEM"
  else
    warn "Bloc env: manquant dans $ECOSYSTEM — ajoute NODE_OPTIONS: \"\" à la main si besoin."
  fi
else
  warn "ecosystem.config.js introuvable — étape ecosystem sautée."
fi

if [[ -f "$DUMP" ]]; then
  cp -f "$DUMP" "$DUMP.bak" || true
  sed -i '/"NODE_OPTIONS":[[:space:]]*".*"/d' "$DUMP" || true
  sed -i '/--enable-source-maps/d' "$DUMP" || true
  ok "Purge NODE_OPTIONS dans ~/.pm2/dump.pm2 (backup: dump.pm2.bak)"
fi

# ---------- 3) PM2 (process + save) ----------
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 start "$ECOSYSTEM" --only "$APP_NAME" --update-env
pm2 save
ok "PM2 prêt (process list sauvegardée)."

# ---------- 4) PM2 au boot ----------
if command -v systemctl >/dev/null 2>&1; then
  sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null
  pm2 save >/dev/null
  ok "Démarrage auto via systemd configuré."
else
  warn "systemctl introuvable — étape startup sautée."
fi

# ---------- 5) Makefile ----------
touch "$MAKEFILE"
add_target () {
  local name="$1"; shift
  local body="$*"
  if ! grep -qE "^$name:" "$MAKEFILE" 2>/dev/null; then
    {
      echo
      echo ".PHONY: $name"
      echo "$name:"
      printf '\t%s\n' "$body"
    } >> "$MAKEFILE"
    ok "Makefile → cible '$name' ajoutée."
  fi
}
add_target "api/build"    "pnpm -C services/api build"
add_target "api/restart"  "services/api/scripts/restart_api.sh"
add_target "api/restartq" "services/api/scripts/restart_api.sh --quiet"
add_target "api/health"   "curl -sf http://localhost:4001/api/health && echo OK"
add_target "api/logs"     "pm2 logs delish-api --lines 200"
add_target "api/tail"     "pm2 logs delish-api --lines 200 --timestamp"

# import menu utilitaire
add_target "api/import-menu" '@MID=$${MID:?Usage: make api/import-menu MID=<merchant_id>}; curl -i -X POST "http://localhost:4001/api/merchants/$${MID}/import-menu" -F "file=@/tmp/$${MID}-menu.csv;type=text/csv"'

# ---------- 6) README (sans heredoc) ----------
if ! grep -q "## Local API: build → restart → wait (PM2)" "$README" 2>/dev/null; then
  {
    printf $'## Local API: build → restart → wait (PM2)\n\n'
    printf $'Utilisation rapide :\n'
    printf $'```bash\n'
    printf $'# Build + PM2 restart + attente de /api/health\n'
    printf $'pnpm api:restart\n'
    printf $'# Variante silencieuse\n'
    printf $'pnpm api:restart:q\n'
    printf $'# Logs et santé\n'
    printf $'make api/logs\n'
    printf $'make api/health\n'
    printf $'```\n\n'
    printf $'PM2 démarre automatiquement au boot (systemd).\n'
    printf $'La variable parasite `NODE_OPTIONS=--enable-source-maps` est neutralisée (ecosystem + dump PM2).\n\n'
  } >> "$README"
  ok "README.md mis à jour."
fi

# ---------- 7) Scripts pnpm racine ----------
if [[ -f "$PKG" ]]; then
  if ! grep -q '"api:restart"' "$PKG"; then
    node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
p.scripts = Object.assign({}, p.scripts, {
  "api:restart": "services/api/scripts/restart_api.sh",
  "api:restart:q": "services/api/scripts/restart_api.sh --quiet",
  "api:restart:120": "TIMEOUT_SECS=120 services/api/scripts/restart_api.sh"
});
fs.writeFileSync(process.argv[1], JSON.stringify(p,null,2));
' "$PKG"
    ok "package.json → scripts api:* ajoutés."
  fi
else
  warn "package.json introuvable à la racine."
fi

# ---------- 8) Test E2E ----------
log "🏁 Test de bout-en-bout…"
TIMEOUT_SECS="$TIMEOUT_SECS" "$RESTART_SH" ${QUIET:+--quiet} --timeout "$TIMEOUT_SECS"

ok "Tout est en place ✅  (Makefile, PM2, startup, README, scripts)."
