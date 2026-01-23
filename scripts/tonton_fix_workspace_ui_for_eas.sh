#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/fix_workspace_ui_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/fix_workspace_ui_$NOW.log"

mkdir -p "$BACKUP" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }
die(){ log "❌ $*"; exit 1; }

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$f" "$BACKUP/$rel"
}

ensure_assets_lottie(){
  log "1) Ensure assets/lottie exists (fix metadata scandir warning)"
  mkdir -p "$ROOT/assets/lottie"
  [[ -f "$ROOT/assets/lottie/.keep" ]] || echo "keep" > "$ROOT/assets/lottie/.keep"
}

find_ui_pkg_dir(){
  log "2) Locate workspace package name=@delishafrica/ui"
  # Search for package.json where name === "@delishafrica/ui"
  node - <<'NODE' 2>/dev/null | tee -a "$REPORT"
const fs = require('fs');
const path = require('path');

const root = process.env.ROOT || "/opt/delishafrica/monorepo";
const targets = ['packages', 'libs', 'ui', 'shared', 'modules'];
let found = [];

function walk(dir){
  if(!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, {withFileTypes:true});
  for(const e of entries){
    if(e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
    const p = path.join(dir, e.name);
    if(e.isDirectory()) walk(p);
    else if(e.isFile() && e.name === 'package.json'){
      try{
        const j = JSON.parse(fs.readFileSync(p,'utf8'));
        if(j.name === '@delishafrica/ui'){
          found.push(path.dirname(p));
        }
      }catch(_){}
    }
  }
}

for(const t of targets){
  walk(path.join(root, t));
}
walk(path.join(root, 'packages'));
walk(path.join(root, 'libs'));

if(found.length){
  console.log(found[0]);
}else{
  console.log('');
}
NODE
}

ensure_pnpm_workspace_includes(){
  local ui_dir="$1"
  [[ -n "$ui_dir" ]] || die "Package @delishafrica/ui introuvable dans le repo (local). Vérifie qu'il existe bien (packages/ui ?) et qu'il est présent sur le disque."
  local rel="${ui_dir#$ROOT/}"
  log "3) Ensure pnpm-workspace.yaml includes: $rel"

  local f="$ROOT/pnpm-workspace.yaml"
  if [[ ! -f "$f" ]]; then
    log "pnpm-workspace.yaml manquant -> création"
    cat > "$f" <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
  - "libs/*"
YAML
  else
    backup_file "$f"
  fi

  # If packages: key missing, add minimal structure
  if ! grep -qE '^\s*packages\s*:' "$f"; then
    backup_file "$f"
    cat > "$f" <<'YAML'
packages:
  - "apps/*"
  - "packages/*"
  - "libs/*"
YAML
  fi

  # Ensure explicit inclusion line exists
  if ! grep -qF "\"$rel\"" "$f" && ! grep -qF "'$rel'" "$f" && ! grep -qE "^\s*-\s*${rel//\//\\/}\s*$" "$f"; then
    log "Ajout explicite: - \"$rel\""
    echo "  - \"$rel\"" >> "$f"
  else
    log "OK: $rel déjà couvert ✅"
  fi
}

patch_easignore(){
  log "4) Patch root .easignore to include workspace + assets"
  local f="$ROOT/.easignore"
  if [[ ! -f "$f" ]]; then
    log "Aucun .easignore détecté -> création (safe)"
    cat > "$f" <<'EOF'
# DelishAfrica - EAS ignore (tonton)
# Important: keep monorepo workspace packages included
node_modules
**/node_modules
.expo
**/.expo
dist
build
coverage
EOF
  else
    backup_file "$f"
  fi

  # Ensure inclusion rules (gitignore-style negations)
  for line in \
    "!pnpm-workspace.yaml" \
    "!pnpm-lock.yaml" \
    "!package.json" \
    "!apps/**" \
    "!packages/**" \
    "!libs/**" \
    "!assets/**"
  do
    grep -qxF "$line" "$f" 2>/dev/null || echo "$line" >> "$f"
  done
}

show_workspace_packages(){
  log "5) Local sanity: does pnpm see @delishafrica/ui in workspace?"
  (cd "$ROOT" && pnpm -w list --depth -1 | tee -a "$REPORT") || true
}

main(){
  [[ -d "$ROOT" ]] || die "ROOT introuvable: $ROOT"
  export ROOT
  ensure_assets_lottie

  local ui_dir
  ui_dir="$(find_ui_pkg_dir | tail -n 1 | tr -d '\r')"
  if [[ -z "$ui_dir" ]]; then
    die "Je ne trouve pas de package.json avec name=@delishafrica/ui. (Cherche dans packages/libs)."
  fi

  ensure_pnpm_workspace_includes "$ui_dir"
  patch_easignore
  show_workspace_packages

  log "✅ Done."
  log "Backups: $BACKUP"
  log "Report:  $REPORT"
  log ""
  log "NEXT:"
  log "cd $ROOT && pnpm -w install"
  log "Puis relance 1 build (merchant) :"
  log "cd $ROOT/apps/merchant && npx -y eas-cli@latest build -p ios --profile development --clear-cache"
}

main "$@"
