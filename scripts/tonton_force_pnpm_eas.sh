#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "merchant" "courier")

die(){ echo "❌ $*" >&2; exit 1; }
ok(){ echo "✅ $*"; }
warn(){ echo "⚠️  $*"; }

cd "$ROOT" || die "Repo introuvable: $ROOT"

command -v node >/dev/null 2>&1 || die "node manquant"
command -v pnpm >/dev/null 2>&1 || die "pnpm manquant"
PNPMV="$(pnpm -v | tr -d '\r')"
ok "pnpm version détectée: $PNPMV"

TS="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/force_pnpm_eas_${TS}"
REPORT="$ROOT/.tonton_reports/force_pnpm_eas_${TS}"
mkdir -p "$BKP" "$REPORT"

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#$ROOT/}"
  mkdir -p "$BKP/$(dirname "$rel")"
  cp -a "$f" "$BKP/$rel"
}

remove_lockfiles(){
  local dir="$1"
  # on supprime seulement dans le dossier de l'app (ou root), pas dans les backups/reports
  find "$dir" -type f \( -name "yarn.lock" -o -name "package-lock.json" -o -name "npm-shrinkwrap.json" \) \
    ! -path "$ROOT/.tonton_backups/*" ! -path "$ROOT/.tonton_reports/*" \
    -print -delete 2>/dev/null || true
}

patch_package_json(){
  local pkg="$1"
  [[ -f "$pkg" ]] || die "package.json introuvable: $pkg"
  backup_file "$pkg"
  ROOT_ENV="$ROOT" PNPMV_ENV="$PNPMV" PKG_PATH="$pkg" node - <<'NODE'
const fs = require('fs');

const pkgPath = process.env.PKG_PATH;
const pnpmv = process.env.PNPMV_ENV;

const raw = fs.readFileSync(pkgPath, 'utf8');
const json = JSON.parse(raw);

// Force packageManager pour que EAS (avec corepack) active pnpm
json.packageManager = `pnpm@${pnpmv}`;

fs.writeFileSync(pkgPath, JSON.stringify(json, null, 2) + "\n");
console.log("patched:", pkgPath, "packageManager=", json.packageManager);
NODE
}

patch_eas_json(){
  local eas="$1"
  [[ -f "$eas" ]] || die "eas.json introuvable: $eas"
  backup_file "$eas"
  PNPMV_ENV="$PNPMV" EAS_PATH="$eas" node - <<'NODE'
const fs = require('fs');

const easPath = process.env.EAS_PATH;
const pnpmv = process.env.PNPMV_ENV;

const raw = fs.readFileSync(easPath, 'utf8');
const json = JSON.parse(raw);

if (!json.build || typeof json.build !== 'object') {
  throw new Error("eas.json: clé 'build' manquante ou invalide");
}

for (const [profileName, profile] of Object.entries(json.build)) {
  if (!profile || typeof profile !== 'object') continue;

  // Force corepack + pnpm version dans chaque profile
  profile.corepack = true;
  profile.pnpm = pnpmv;

  // Optionnel mais utile : fixe la version de node si déjà présente (sinon laisse EAS gérer)
  // (on ne force pas node ici pour éviter un changement non désiré)
}

fs.writeFileSync(easPath, JSON.stringify(json, null, 2) + "\n");
console.log("patched:", easPath, "=> corepack:true + pnpm:", pnpmv);
NODE
}

echo "== 1) Nettoyage lockfiles parasites (root + apps) ==" | tee "$REPORT/steps.txt"
remove_lockfiles "$ROOT"
for app in "${APPS[@]}"; do
  remove_lockfiles "$ROOT/apps/$app"
done
ok "Lockfiles yarn/npm supprimés (root + apps/*) (si présents)"

echo "" | tee -a "$REPORT/steps.txt"
echo "== 2) Patch packageManager dans apps/*/package.json ==" | tee -a "$REPORT/steps.txt"
for app in "${APPS[@]}"; do
  PKG="$ROOT/apps/$app/package.json"
  patch_package_json "$PKG" | tee -a "$REPORT/steps.txt"
done
ok "packageManager=pnpm@${PNPMV} appliqué dans client/merchant/courier"

echo "" | tee -a "$REPORT/steps.txt"
echo "== 3) Patch corepack+pnpm dans apps/*/eas.json ==" | tee -a "$REPORT/steps.txt"
for app in "${APPS[@]}"; do
  EAS="$ROOT/apps/$app/eas.json"
  if [[ -f "$EAS" ]]; then
    patch_eas_json "$EAS" | tee -a "$REPORT/steps.txt"
  else
    warn "Pas de eas.json dans apps/$app (skip). Si ton eas.json est ailleurs, dis-moi où."
  fi
done

echo "" | tee -a "$REPORT/steps.txt"
echo "== 4) Vérif rapide (il ne doit plus y avoir yarn.lock / package-lock.json) ==" | tee -a "$REPORT/steps.txt"
(find "$ROOT" -type f \( -name "yarn.lock" -o -name "package-lock.json" -o -name "npm-shrinkwrap.json" \) \
  ! -path "$ROOT/.tonton_backups/*" ! -path "$ROOT/.tonton_reports/*" \
  | sed "s|^$ROOT/||" | tee -a "$REPORT/steps.txt") || true

ok "Backup: $BKP"
ok "Rapport: $REPORT/steps.txt"

cat <<EOF

✅ NEXT (commande unique à lancer):
cd /opt/delishafrica/monorepo/apps/client
eas build -p ios --profile preview

🎯 Ce que tu dois voir dans les logs EAS après ça:
- "corepack enabled" (ou équivalent)
- et surtout "pnpm install" (PAS yarn)

Si ça relance encore yarn:
- on passera au Plan B (custom build workflow .eas/build/*.yml) pour imposer l'installCommand.
EOF
