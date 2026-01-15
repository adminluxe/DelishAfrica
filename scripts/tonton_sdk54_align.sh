#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/sdk54_align_${TS}"
RP="$ROOT/.tonton_reports/sdk54_align_${TS}.log"

APPS=("client" "courier" "merchant")

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🧩 TONTON SDK54 ALIGN (expo install exact + splash fix + rngh + maps)"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo "Apps:   ${APPS[*]}"
echo

cd "$ROOT"

# backup package manifests
cp -a "$ROOT/package.json" "$BK/" 2>/dev/null || true
cp -a "$ROOT/pnpm-lock.yaml" "$BK/" 2>/dev/null || true
cp -a "$ROOT/eas.json" "$BK/" 2>/dev/null || true

for a in "${APPS[@]}"; do
  [[ -f "$ROOT/apps/$a/package.json" ]] && { mkdir -p "$BK/apps/$a"; cp -a "$ROOT/apps/$a/package.json" "$BK/apps/$a/"; }
  [[ -f "$ROOT/apps/$a/app.json" ]] && { mkdir -p "$BK/apps/$a"; cp -a "$ROOT/apps/$a/app.json" "$BK/apps/$a/"; }
  for f in "$ROOT/apps/$a/app.config."*; do
    [[ -f "$f" ]] && { mkdir -p "$BK/apps/$a"; cp -a "$f" "$BK/apps/$a/"; }
  done
done

# ensure tools
command -v pnpm >/dev/null 2>&1 || npm i -g pnpm
command -v file >/dev/null 2>&1 || (apt-get update -y && apt-get install -y file)

echo "============================================================"
echo "1) Nettoyage deps dangereuses signalées par expo-doctor"
echo "   - expo-modules-core (ne doit pas être installé directement)"
echo "   - @types/react-native (inutile, inclus via react-native)"
echo "============================================================"

node <<'NODE'
const fs = require("fs");
const path = require("path");

const root = "/opt/delishafrica/monorepo";
const apps = ["client","courier","merchant"];

function patchPkg(pkgPath){
  if (!fs.existsSync(pkgPath)) return;
  const j = JSON.parse(fs.readFileSync(pkgPath,"utf8"));
  const removeKeys = ["expo-modules-core","@types/react-native"];
  for (const section of ["dependencies","devDependencies"]) {
    if (!j[section]) continue;
    for (const k of removeKeys) {
      if (j[section][k]) delete j[section][k];
    }
  }
  fs.writeFileSync(pkgPath, JSON.stringify(j,null,2) + "\n");
  console.log("patched", pkgPath);
}

patchPkg(path.join(root,"package.json"));
for (const a of apps) patchPkg(path.join(root,"apps",a,"package.json"));
NODE

echo
echo "============================================================"
echo "2) Réinstall propre"
echo "============================================================"
pnpm install

echo
echo "============================================================"
echo "3) Expo SDK54 align (versions attendues par expo-doctor)"
echo "   + react-native-gesture-handler (peer manquante)"
echo "   + react-native-maps (attendu 1.20.1)"
echo "============================================================"

# packages list selon ce que ton expo-doctor affiche
PKGS=(
  "expo@~54.0.31"
  "expo-asset@~12.0.12"
  "expo-constants@~18.0.13"
  "expo-dev-client@~6.0.20"
  "expo-font@~14.0.9"
  "expo-haptics@~15.0.8"
  "expo-image@~3.0.11"
  "expo-linking@~8.0.11"
  "expo-location@~19.0.8"
  "expo-modules-core@~3.0.29"
  "expo-router@~6.0.21"
  "expo-secure-store@~15.0.8"
  "expo-splash-screen@~0.31.13"
  "expo-status-bar@~3.0.9"
  "expo-symbols@~1.0.8"
  "expo-system-ui@~6.0.9"
  "expo-web-browser@~15.0.10"
  "react-native-maps@1.20.1"
  "react-native-gesture-handler"
  "react-native-reanimated"
  "react-native-screens"
  "react-native-safe-area-context"
)

for a in "${APPS[@]}"; do
  echo "---- expo install ($a) ----"
  cd "$ROOT/apps/$a"
  npx expo install "${PKGS[@]}"
done

echo
echo "============================================================"
echo "4) Fix splash mismatch (splash.png mais contenu JPG)"
echo "   -> si assets/splash.png est jpeg: rename en splash.jpg + update config strings"
echo "============================================================"

fix_splash () {
  local appdir="$1"
  local png="$appdir/assets/splash.png"
  [[ -f "$png" ]] || return 0
  local mt
  mt="$(file -b --mime-type "$png" || true)"
  if [[ "$mt" == "image/jpeg" ]]; then
    echo "⚠️ $png est JPEG -> rename splash.jpg + patch configs"
    mv -f "$png" "$appdir/assets/splash.jpg"

    # patch app.json
    if [[ -f "$appdir/app.json" ]]; then
      perl -pi -e 's#\./assets/splash\.png#./assets/splash.jpg#g' "$appdir/app.json"
    fi
    # patch app.config.* (js/ts)
    for f in "$appdir"/app.config.*; do
      [[ -f "$f" ]] || continue
      perl -pi -e 's#\./assets/splash\.png#./assets/splash.jpg#g' "$f"
    done
  fi
}

cd "$ROOT"
for a in "${APPS[@]}"; do
  fix_splash "$ROOT/apps/$a"
done

echo
echo "============================================================"
echo "5) Re-install final + doctor rapide"
echo "============================================================"
cd "$ROOT"
pnpm install

for a in "${APPS[@]}"; do
  echo "---- expo-doctor (post) $a ----"
  cd "$ROOT/apps/$a"
  npx expo-doctor || true
done

echo
echo "✅ DONE"
echo "Backup: $BK"
echo "Report: $RP"
echo
echo "Rollback (1-liner):"
echo "  rsync -a \"$BK/\" \"$ROOT/\""
