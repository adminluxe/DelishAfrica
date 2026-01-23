#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APPS=("merchant" "courier")
CLIENT_PKG="$ROOT/apps/client/package.json"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*"; }
die(){ echo -e "\n❌ $*"; exit 1; }

# 0) Pré-check : IDs EAS alignés (on vient de le faire mais on verrouille)
if [[ -x "$ROOT/scripts/tonton_eas_audit_ids.sh" ]]; then
  log "Pré-check: audit EAS IDs"
  "$ROOT/scripts/tonton_eas_audit_ids.sh"
else
  log "⚠️ audit script introuvable: $ROOT/scripts/tonton_eas_audit_ids.sh (skip)"
fi

# 1) Déduire la version/range RNGH à utiliser (copie depuis Client si possible)
log "Détermination de la version/range de react-native-gesture-handler (source: client)"
RNGH_RANGE="$(node - <<'NODE'
const fs = require("fs");

function readJSON(p){ return JSON.parse(fs.readFileSync(p,"utf8")); }

const clientPkgPath = process.env.CLIENT_PKG;
let range = "";

try {
  const pkg = readJSON(clientPkgPath);
  range =
    (pkg.dependencies && pkg.dependencies["react-native-gesture-handler"]) ||
    (pkg.devDependencies && pkg.devDependencies["react-native-gesture-handler"]) ||
    "";
} catch {}

if (!range) {
  // fallback: version installée dans l'environnement
  try {
    const v = require("react-native-gesture-handler/package.json").version;
    range = "^" + v; // safe fallback
  } catch (e) {
    // dernier fallback
    range = "^2.0.0";
  }
}

process.stdout.write(range);
NODE
)"

log "RNGH range = $RNGH_RANGE"

# 2) Patch package.json de merchant/courier pour assurer RNGH en dependency directe
backup_pkg(){
  local pkg="$1"
  [[ -f "$pkg" ]] || die "package.json introuvable: $pkg"
  cp -a "$pkg" "$pkg.bak.$(date +%Y%m%d_%H%M%S)"
}

patch_pkg(){
  local app="$1"
  local pkg="$ROOT/apps/$app/package.json"
  backup_pkg "$pkg"

  log "Patch $app/package.json : ajoute/force react-native-gesture-handler=$RNGH_RANGE"
  node - <<'NODE'
const fs = require("fs");

const pkgPath = process.env.PKG_PATH;
const range = process.env.RNGH_RANGE;

const pkg = JSON.parse(fs.readFileSync(pkgPath,"utf8"));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies["react-native-gesture-handler"] = range;

// petite normalisation (optionnelle)
const orderKeys = (obj) => Object.fromEntries(Object.keys(obj).sort().map(k => [k, obj[k]]));
pkg.dependencies = orderKeys(pkg.dependencies);
if (pkg.devDependencies) pkg.devDependencies = orderKeys(pkg.devDependencies);

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
NODE
}

export CLIENT_PKG="$CLIENT_PKG"
for a in "${APPS[@]}"; do
  export PKG_PATH="$ROOT/apps/$a/package.json"
  export RNGH_RANGE="$RNGH_RANGE"
  patch_pkg "$a"
done

# 3) Install deps (pnpm si dispo, sinon npm)
log "Install dépendances (workspace)"
if command -v pnpm >/dev/null 2>&1; then
  (cd "$ROOT" && pnpm -w install)
else
  (cd "$ROOT" && npm install)
fi

# 4) Rebuild dev client iOS (merchant + courier)
log "Build dev client iOS (merchant + courier) avec cache clean (recommandé)"
for a in "${APPS[@]}"; do
  log "EAS BUILD: $a (development / ios)"
  (cd "$ROOT/apps/$a" && npx -y eas-cli@latest build -p ios --profile development --clear-cache --non-interactive)
done

log "✅ Terminé. Pour récupérer les liens d'installation:"
log "   (cd $ROOT/apps/merchant && npx -y eas-cli@latest build:list -p ios --limit 3)"
log "   (cd $ROOT/apps/courier  && npx -y eas-cli@latest build:list -p ios --limit 3)"
