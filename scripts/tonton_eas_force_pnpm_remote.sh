#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/eas_force_pnpm_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/eas_force_pnpm_$NOW.log"

mkdir -p "$BACKUP" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

need_root(){
  [[ -d "$ROOT" ]] || { echo "ROOT introuvable: $ROOT"; exit 1; }
}

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$f" "$BACKUP/$rel"
}

move_to_backup(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  mv "$f" "$BACKUP/$rel"
}

patch_easignore(){
  local f="$ROOT/.easignore"
  if [[ ! -f "$f" ]]; then
    log "Aucun .easignore détecté (OK). On n'en crée pas."
    return 0
  fi

  log "Patch .easignore pour forcer l'inclusion des fichiers pnpm"
  backup_file "$f"

  # Désactive des patterns qui excluraient pnpm*
  perl -0777 -pe 's/^(?!\!)(\s*pnpm-(lock\.yaml|workspace\.yaml|workspaces\.yaml)\s*)$/# [tonton] disabled: $1/mg' -i "$f" || true

  # Ajoute des négations (gitignore-style) si absentes
  for line in \
    "!pnpm-lock.yaml" \
    "!pnpm-workspace.yaml" \
    "!pnpm-workspaces.yaml" \
    "!.npmrc" \
    "!package.json" \
    "!pnpmfile.cjs"
  do
    grep -qxF "$line" "$f" 2>/dev/null || echo "$line" >> "$f"
  done
}

ensure_pnpm_workspace(){
  local f="$ROOT/pnpm-workspace.yaml"
  if [[ -f "$f" ]]; then
    log "pnpm-workspace.yaml déjà présent ✅"
    return 0
  fi

  log "pnpm-workspace.yaml manquant -> création minimaliste ✅"
  cat > "$f" <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
  - "libs/*"
YAML
}

remove_other_lockfiles(){
  log "Recherche & déplacement des lockfiles non-pnpm (yarn/npm) vers backup"
  while IFS= read -r f; do
    log "MOVE -> $f"
    move_to_backup "$f"
  done < <(
    find "$ROOT" \
      -type d \( -name node_modules -o -name .git -o -name .expo -o -name .turbo -o -name dist -o -name build \) -prune -o \
      -type f \( -name "yarn.lock" -o -name "package-lock.json" -o -name "npm-shrinkwrap.json" \) -print
  )
}

show_package_manager(){
  log "Lecture du packageManager root (package.json)"
  if [[ -f "$ROOT/package.json" ]]; then
    node - <<'NODE' 2>/dev/null | tee -a "$REPORT" || true
const fs=require('fs');
const p='package.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
console.log({ name:j.name, packageManager:j.packageManager, workspaces:j.workspaces ? true : false });
NODE
  else
    log "⚠️ package.json root introuvable ?!"
  fi
}

check_pnpm_files(){
  log "Vérifs pnpm-lock.yaml + pnpm-workspace.yaml"
  [[ -f "$ROOT/pnpm-workspace.yaml" ]] && log "OK: pnpm-workspace.yaml ✅" || log "KO: pnpm-workspace.yaml ❌"
  [[ -f "$ROOT/pnpm-lock.yaml" ]] && log "OK: pnpm-lock.yaml ✅" || log "⚠️ pnpm-lock.yaml manquant (EAS peut partir en vrille). Génère-le via: pnpm -w install"
}

final_instructions(){
  cat <<TXT | tee -a "$REPORT"

================= NEXT STEPS (à exécuter) =================

1) Re-génère/valide lockfile pnpm (root) :
   cd $ROOT
   pnpm -w install

2) Relance UN SEUL build test (merchant par ex) et vérifie dans les logs EAS :
   - On doit voir "pnpm install" (et PAS "yarn install")

   cd $ROOT/apps/merchant
   npx -y eas-cli@latest build -p ios --profile development --clear-cache

Si ça affiche encore yarn, alors on checkera la détection monorepo (workspaces) et la présence effective des fichiers dans l’archive EAS.

Backup: $BACKUP
Report: $REPORT
TXT
}

main(){
  need_root
  log "=== TONTON: Force pnpm pour EAS remote ==="
  patch_easignore
  ensure_pnpm_workspace
  remove_other_lockfiles
  show_package_manager
  check_pnpm_files
  final_instructions
  log "✅ Patch terminé."
}

main "$@"
