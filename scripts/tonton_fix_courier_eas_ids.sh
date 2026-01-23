#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APP="courier"
APP_DIR="$ROOT/apps/$APP"

OWNER_EXPECT="delishafrica"

MERCHANT_SLUG="delishafrica-merchant"
MERCHANT_PID="ac87e7fa-1e43-4baa-813e-6174797314a1"

COURIER_SLUG="delishafrica-courier"
COURIER_PID="b6ed6df5-cd75-48ff-99f9-fc5adcaec479"

NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/fix_courier_eas_ids_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/fix_courier_eas_ids_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log(){ echo -e "[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

die(){ log "❌ $*"; exit 1; }

backup(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
  log "🧷 backup: $rel -> $BACKUP_DIR/$rel"
}

patch_in_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0

  # Patch only if merchant markers exist
  if ! rg -q "$MERCHANT_SLUG|$MERCHANT_PID" "$f" 2>/dev/null; then
    return 0
  fi

  backup "$f"
  log "✍️  patch: ${f#$ROOT/}"

  # Replace slug + projectId wherever they appear
  perl -pi -e "s/\Q$MERCHANT_SLUG\E/$COURIER_SLUG/g; s/\Q$MERCHANT_PID\E/$COURIER_PID/g" "$f"
}

show_expo_config(){
  ( cd "$APP_DIR"
    log "🔎 eas whoami (info):"
    npx -y eas-cli@latest whoami --non-interactive 2>/dev/null | tee -a "$REPORT" || true

    log "🔎 expo config (owner/slug/projectId):"
    npx expo config --json \
      | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log({owner:c.owner, slug:c.slug, projectId:c.extra?.eas?.projectId});' \
      | tee -a "$REPORT"
  )
}

log "=== FIX COURIER EAS IDS ==="
log "ROOT=$ROOT"
log "APP_DIR=$APP_DIR"
[[ -d "$APP_DIR" ]] || die "Dossier introuvable: $APP_DIR"

log "1) Scan occurrences merchant dans courier/"
rg -n "$MERCHANT_SLUG|$MERCHANT_PID|extra\\.eas\\.projectId|projectId|slug|EAS_PROJECT_ID" "$APP_DIR" \
  | tee -a "$REPORT" || true

log "2) Patch fichiers de config possibles (courier)"
# candidats classiques
CANDIDATES=(
  "$APP_DIR/app.config.ts"
  "$APP_DIR/app.config.js"
  "$APP_DIR/app.config.mjs"
  "$APP_DIR/app.json"
  "$APP_DIR/eas.json"
  "$APP_DIR/package.json"
  "$APP_DIR/.env"
  "$APP_DIR/.env.local"
)

for f in "${CANDIDATES[@]}"; do
  patch_in_file "$f"
done

# patch aussi tout fichier de config dans courier qui contient merchant slug/id (safe)
log "2b) Patch étendu (uniquement fichiers contenant les marqueurs merchant)"
while IFS= read -r f; do
  patch_in_file "$f"
done < <(rg -l "$MERCHANT_SLUG|$MERCHANT_PID" "$APP_DIR" 2>/dev/null || true)

log "3) Re-scan post-patch (doit être VIDE pour merchant slug/id)"
rg -n "$MERCHANT_SLUG|$MERCHANT_PID" "$APP_DIR" | tee -a "$REPORT" || true

log "4) Vérif expo config (doit afficher courier)"
show_expo_config

log "5) Check attendu"
CFG="$(cd "$APP_DIR" && npx expo config --json | node -e 'const c=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write([c.owner||"", c.slug||"", c.extra?.eas?.projectId||""].join("|"));')"
OWNER="${CFG%%|*}"
REST="${CFG#*|}"; SLUG="${REST%%|*}"; PID="${REST##*|}"

if [[ "$OWNER" != "$OWNER_EXPECT" ]]; then
  die "owner=$OWNER (attendu: $OWNER_EXPECT)"
fi
if [[ "$SLUG" != "$COURIER_SLUG" ]]; then
  die "slug=$SLUG (attendu: $COURIER_SLUG)"
fi
if [[ "$PID" != "$COURIER_PID" ]]; then
  die "projectId=$PID (attendu: $COURIER_PID)"
fi

log "✅ OK: Courier est maintenant aligné (owner/slug/projectId)."
log "📄 Report: $REPORT"
log "🧷 Backups: $BACKUP_DIR"
