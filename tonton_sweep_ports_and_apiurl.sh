#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
COMPOSE="/opt/delishafrica/compose"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/opt/delishafrica/_backup_sweep_${STAMP}"
REPORT="/opt/delishafrica/_sweep_report_${STAMP}.txt"

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
ok(){  echo -e "\033[1;32m✔\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }

need rg
need sed
need awk
need mkdir
need cp

[ -d "$ROOT" ] || { echo "❌ ROOT introuvable: $ROOT"; exit 1; }

say "0) Backup folder: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
: > "$REPORT"

scan() {
  local base="$1"
  [ -d "$base" ] || return 0
  rg -n --hidden --no-ignore-vcs \
    -S '4001|4010|http://127\.0\.0\.1:(4001|4010)|http://localhost:(4001|4010)|API_BASE_URL|EXPO_PUBLIC_API_BASE_URL' \
    "$base" \
    -g '!**/node_modules/**' -g '!**/.git/**' -g '!**/dist/**' -g '!**/.expo/**' -g '!**/.next/**' -g '!**/build/**' \
    || true
}

backup_files_from_matches() {
  # lit des lignes "file:line:..."
  # sauvegarde chaque fichier une seule fois
  awk -F: '{print $1}' | sort -u | while read -r f; do
    [ -f "$f" ] || continue
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -a "$f" "$BACKUP_DIR/$f"
  done
}

apply_replacements() {
  local f="$1"
  # 1) Ports locaux scripts (healthchecks etc.) -> 3010
  sed -i \
    -e 's#http://127\.0\.0\.1:4001#http://127.0.0.1:3010#g' \
    -e 's#http://127.0.0.1:3010#http://127.0.0.1:3010#g' \
    -e 's#http://127\.0\.0\.1:4010#http://127.0.0.1:3010#g' \
    -e 's#http://127.0.0.1:3010#http://127.0.0.1:3010#g' \
    "$f" 2>/dev/null || true

  # 2) Env des apps: forcer le HTTPS public
  # (on ne remplace PAS les urls locales dans scripts server health si elles ne sont pas des env)
  sed -i \
    -E 's#^(EXPO_PUBLIC_API_BASE_URL=).*#\1https://api.delishafrica.me#g' \
    "$f" 2>/dev/null || true

  sed -i \
    -E 's#^(API_BASE_URL=).*#\1https://api.delishafrica.me#g' \
    "$f" 2>/dev/null || true

  sed -i \
    -E 's#^(EXPO_PUBLIC_API_URL=).*#\1https://api.delishafrica.me#g' \
    "$f" 2>/dev/null || true
}

touch_env_if_missing() {
  # Ajoute EXPO_PUBLIC_API_BASE_URL si absent dans .env* des apps
  local envfile="$1"
  [ -f "$envfile" ] || return 0
  if ! grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$envfile"; then
    echo "EXPO_PUBLIC_API_BASE_URL=https://api.delishafrica.me" >> "$envfile"
  fi
}

say "1) Scan BEFORE (monorepo + compose)"
{
  echo "===== BEFORE: monorepo ====="
  scan "$ROOT"
  echo
  echo "===== BEFORE: compose ====="
  scan "$COMPOSE"
} | tee -a "$REPORT" >/dev/null

say "2) Backup des fichiers touchés (avant modifications)"
(
  scan "$ROOT"
  scan "$COMPOSE"
) | backup_files_from_matches

ok "Backup complet: $BACKUP_DIR"

say "3) Application des remplacements (monorepo + compose)"
# Liste ciblée: .sh, .env*, .ts, .tsx, .js, .json, .yml, .yaml
targets=()
while IFS= read -r f; do targets+=("$f"); done < <(
  find "$ROOT" "$COMPOSE" -type f \( \
    -name "*.sh" -o -name "*.env" -o -name ".env.*" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" \
  \) 2>/dev/null \
  | grep -vE '/node_modules/|/\.git/|/dist/|/\.expo/|/build/|/\.next/'
)

for f in "${targets[@]}"; do
  apply_replacements "$f"
done

# Forcer env files des 3 apps
for app in courier client merchant; do
  for envf in \
    "$ROOT/apps/$app/.env" \
    "$ROOT/apps/$app/.env.local" \
    "$ROOT/apps/$app/.env.development" \
    "$ROOT/apps/$app/.env.production" \
    ; do
    touch_env_if_missing "$envf"
  done
done

say "4) Scan AFTER (monorepo + compose)"
{
  echo "===== AFTER: monorepo ====="
  scan "$ROOT"
  echo
  echo "===== AFTER: compose ====="
  scan "$COMPOSE"
} | tee -a "$REPORT" >/dev/null

ok "Rapport: $REPORT"
ok "FIN ✅"
echo
echo "➡️ Si besoin de rollback:"
echo "   rsync -a '$BACKUP_DIR/' /"
