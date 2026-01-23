#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "merchant" "courier")

die(){ echo "❌ $*" >&2; exit 1; }
ok(){ echo "✅ $*"; }
warn(){ echo "⚠️  $*"; }

command -v pnpm >/dev/null 2>&1 || die "pnpm manquant"
command -v node >/dev/null 2>&1 || die "node manquant"

PNPMV="$(pnpm -v | tr -d '\r')"
ok "pnpm=$PNPMV"

TS="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/easjson_pnpm_${TS}"
mkdir -p "$BKP"

backup(){
  local f="$1"
  local rel="${f#$ROOT/}"
  mkdir -p "$BKP/$(dirname "$rel")"
  cp -a "$f" "$BKP/$rel"
}

for app in "${APPS[@]}"; do
  EAS="$ROOT/apps/$app/eas.json"
  [[ -f "$EAS" ]] || { warn "skip (no eas.json): $EAS"; continue; }

  ok "Patch: $EAS"
  backup "$EAS"

  # unlock in case immutable
  chattr -i "$EAS" 2>/dev/null || true
  chmod u+rw "$EAS" 2>/dev/null || true

  TMP="$EAS.tmp.$$"
  PNPMV_ENV="$PNPMV" EAS_PATH="$EAS" TMP_PATH="$TMP" node - <<'NODE'
const fs = require('fs');

const easPath = process.env.EAS_PATH;
const tmpPath = process.env.TMP_PATH;
const pnpmv = process.env.PNPMV_ENV;

const json = JSON.parse(fs.readFileSync(easPath, 'utf8'));

if (!json.build || typeof json.build !== 'object') {
  throw new Error(`eas.json invalid: missing "build" in ${easPath}`);
}

for (const [name, profile] of Object.entries(json.build)) {
  if (!profile || typeof profile !== 'object') continue;
  profile.corepack = true;
  profile.pnpm = pnpmv;
}

fs.writeFileSync(tmpPath, JSON.stringify(json, null, 2) + "\n", 'utf8');
console.log("written tmp:", tmpPath);
NODE

  # atomic replace
  mv -f "$TMP" "$EAS"

  ok "Done: corepack:true + pnpm:${PNPMV} in $EAS"
done

ok "Backups: $BKP"

echo ""
echo "VERIFY:"
for app in "${APPS[@]}"; do
  EAS="$ROOT/apps/$app/eas.json"
  [[ -f "$EAS" ]] || continue
  echo "---- $app ----"
  grep -nE '"corepack"\s*:|"\bpnpm\b"\s*:' "$EAS" || true
done
