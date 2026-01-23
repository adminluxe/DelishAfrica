#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/pkgmgr_fix_$NOW"
REPORT="$ROOT/.tonton_reports/pkgmgr_fix_$NOW.log"

mkdir -p "$BACKUP" "$(dirname "$REPORT")"

log(){ echo -e "[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

log "ROOT=$ROOT"
cd "$ROOT"

# 1) Détecte et backup tous les lockfiles qui peuvent faire choisir yarn/npm par EAS
log "Scan lockfiles (yarn/npm) à neutraliser"
mapfile -t LOCKS < <(find "$ROOT" -maxdepth 4 -type f \( -name "yarn.lock" -o -name "package-lock.json" -o -name "npm-shrinkwrap.json" \) 2>/dev/null || true)

if [[ "${#LOCKS[@]}" -gt 0 ]]; then
  log "Trouvé: ${#LOCKS[@]} lockfile(s) yarn/npm"
  for f in "${LOCKS[@]}"; do
    rel="${f#$ROOT/}"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$f" "$BACKUP/$rel"
    rm -f "$f"
    log "→ moved out: $rel"
  done
else
  log "OK: aucun yarn.lock / package-lock.json détecté"
fi

# 2) S'assure qu'on a pnpm-lock.yaml à la racine
if [[ ! -f "$ROOT/pnpm-lock.yaml" ]]; then
  log "pnpm-lock.yaml manquant → génération via pnpm -w install"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm -w install | tee -a "$REPORT"
  else
    log "❌ pnpm introuvable sur la machine. Installe pnpm puis relance."
    exit 1
  fi
else
  log "OK: pnpm-lock.yaml présent"
fi

# 3) S'assure que packageManager=pnpm@<version> est bien défini dans package.json racine
PNPM_VER="$(pnpm -v 2>/dev/null || true)"
if [[ -z "$PNPM_VER" ]]; then PNPM_VER="9.15.4"; fi

log "Assure packageManager=pnpm@$PNPM_VER dans package.json (root)"
node - <<NODE
const fs=require('fs');
const p="${ROOT}/package.json";
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.packageManager = "pnpm@${PNPM_VER}";
fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
console.log("OK packageManager =", j.packageManager);
NODE

log "✅ Done."
log "Backups lockfiles déplacés -> $BACKUP"
log "Report -> $REPORT"
