#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client merchant courier)

# ✅ Base API finale (recommandée vu tes routes Nest)
API_BASE="${API_BASE:-https://api.delishafrica.me/api/v1}"

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/_diag/${TS}/api_base_patch"
mkdir -p "$BACKUP_DIR"

echo "== Force API base for all apps =="
echo "API_BASE : $API_BASE"
echo "BACKUP   : $BACKUP_DIR"
echo

backup_file() {
  local f="$1"
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
}

patch_file() {
  local f="$1"
  local before after
  before="$(sha256sum "$f" | awk '{print $1}')"

  # Remplacements prudents : on remplace les bases les plus fréquentes
  # - ports connus
  # - localhost/127.0.0.1
  # - anciennes URLs api.delishafrica.me sans /api/v1
  perl -0777 -pe '
    my $base = $ENV{"API_BASE"};

    s#https?://api\.delishafrica\.me(/api/v1)?#${base}#g;

    s#https?://127\.0\.0\.1:3010(/api/v1)?#${base}#g;
    s#https?://localhost:3010(/api/v1)?#${base}#g;
    s#https?://0\.0\.0\.0:3010(/api/v1)?#${base}#g;

    s#https?://127\.0\.0\.1:4010(/api/v1)?#${base}#g;
    s#https?://localhost:4010(/api/v1)?#${base}#g;

    # cas "API_URL=" ou "BASE_URL=" etc avec espaces
    s#(API(_BASE)?_URL\s*=\s*)["'\'']?[^"'\''\r\n]+["'\'']?#$1${base}#g;
    s#(BASE_URL\s*=\s*)["'\'']?[^"'\''\r\n]+["'\'']?#$1${base}#g;
    s#(EXPO_PUBLIC_API(_BASE)?_URL\s*=\s*)["'\'']?[^"'\''\r\n]+["'\'']?#$1${base}#g;
  ' -i "$f"

  after="$(sha256sum "$f" | awk '{print $1}')"
  if [[ "$before" != "$after" ]]; then
    echo "patched: $f"
  fi
}

echo "== Scanning & patching =="
for a in "${APPS[@]}"; do
  APP_DIR="$ROOT/apps/$a"
  [[ -d "$APP_DIR" ]] || { echo "WARN: missing $APP_DIR"; continue; }

  # Cibles typiques
  mapfile -t files < <(
    find "$APP_DIR" -type f \( \
      -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \
      -o -name "*.json" -o -name "*.env" -o -name ".env" -o -name ".env.local" -o -name ".env.production" \
    \) 2>/dev/null
  )

  for f in "${files[@]}"; do
    # Patch uniquement si le fichier contient un indice API
    if grep -qE 'api\.delishafrica\.me|:3010|:4010|localhost|127\.0\.0\.1|EXPO_PUBLIC_API|API_URL|BASE_URL' "$f" 2>/dev/null; then
      backup_file "$f"
      patch_file "$f"
    fi
  done
done

echo
echo "== Quick grep after patch (top 80) =="
grep -R --line-number -E 'api\.delishafrica\.me|:3010|:4010|localhost|127\.0\.0\.1' \
  "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" 2>/dev/null | head -n 80 || true

echo
echo "DONE. Backups in: $BACKUP_DIR"
