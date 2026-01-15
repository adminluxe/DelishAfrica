#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/ios_hard_reset_${TS}"
RP="$ROOT/.tonton_reports/ios_hard_reset_${TS}.log"

APPS=("client" "courier" "merchant")
PROFILE="${PROFILE:-development}"     # eas profile
PLATFORM="${PLATFORM:-ios}"           # ios

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🍏 TONTON iOS HARD RESET + DEV CLIENT REBUILD"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo "Apps:   ${APPS[*]}"
echo "EAS:    profile=$PROFILE platform=$PLATFORM"
echo

if [[ ! -d "$ROOT/apps" ]]; then
  echo "❌ Repo introuvable: $ROOT (attendu: $ROOT/apps/*)"
  exit 1
fi

cd "$ROOT"

echo "============================================================"
echo "0) Snapshot sécurité"
echo "============================================================"
# On garde une trace des diffs + fichiers de conf principaux
git rev-parse --is-inside-work-tree >/dev/null 2>&1 && {
  git status --porcelain=v1 || true
  git diff > "$BK/git.diff" || true
  git diff --staged > "$BK/git.staged.diff" || true
} || true

for f in package.json pnpm-lock.yaml yarn.lock package-lock.json eas.json app.json app.config.*; do
  [[ -f "$ROOT/$f" ]] && cp -a "$ROOT/$f" "$BK/" || true
done

for a in "${APPS[@]}"; do
  for f in "$ROOT/apps/$a/package.json" "$ROOT/apps/$a/app.json" "$ROOT/apps/$a/app.config."* "$ROOT/apps/$a/eas.json"; do
    [[ -f "$f" ]] || continue
    mkdir -p "$BK/apps/$a"
    cp -a "$f" "$BK/apps/$a/"
  done
done

echo "✅ Snapshot OK -> $BK"
echo

echo "============================================================"
echo "1) Nettoyage caches (metro/expo/tmp/node_modules)"
echo "============================================================"

# stop watchers si présents (soft)
command -v watchman >/dev/null 2>&1 && watchman watch-del-all || true

# caches tmp metro/haste
rm -rf /tmp/metro-* /tmp/haste-map-* /tmp/react-* 2>/dev/null || true

# caches expo
rm -rf "$ROOT/.expo" "$ROOT/.expo-shared" 2>/dev/null || true

# monorepo caches
rm -rf "$ROOT/node_modules" "$ROOT/.turbo" "$ROOT/.cache" 2>/dev/null || true

# app caches
for a in "${APPS[@]}"; do
  rm -rf "$ROOT/apps/$a/node_modules" "$ROOT/apps/$a/.expo" "$ROOT/apps/$a/.cache" 2>/dev/null || true
done

echo "✅ Caches nettoyés"
echo

echo "============================================================"
echo "2) Réinstall dependencies (pnpm)"
echo "============================================================"
if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "⚠️ pnpm manquant. Installation..."
  npm i -g pnpm
fi

pnpm -v
pnpm install

echo "✅ Install OK"
echo

echo "============================================================"
echo "3) Expo doctor (détecte mismatch natifs)"
echo "============================================================"
for a in "${APPS[@]}"; do
  if [[ -d "$ROOT/apps/$a" ]]; then
    echo "---- expo-doctor: $a ----"
    ( cd "$ROOT/apps/$a" && npx expo-doctor || true )
  fi
done
echo

echo "============================================================"
echo "4) EAS CLI + builds iOS (cloud) --clear-cache"
echo "============================================================"

if ! command -v eas >/dev/null 2>&1; then
  echo "⚠️ eas-cli manquant. Installation..."
  npm i -g eas-cli
fi

eas --version

echo
echo "⚠️ IMPORTANT:"
echo "- Tu vas peut-être devoir te login (eas login) si pas déjà fait."
echo "- Les builds iOS sont CLOUD (normal sur serveur Linux)."
echo

for a in "${APPS[@]}"; do
  echo "---- EAS BUILD: $a ----"
  cd "$ROOT/apps/$a"

  # Vérif présence config expo
  if [[ ! -f "app.json" && ! -f "app.config.js" && ! -f "app.config.ts" ]]; then
    echo "⏭️ Skip $a: pas de app.json/app.config.*"
    continue
  fi

  # Déclenche build dev iOS avec clear cache
  eas build --platform "$PLATFORM" --profile "$PROFILE" --clear-cache
  echo
done

echo "============================================================"
echo "5) Après build: récupérer les liens d'installation"
echo "============================================================"
echo "Pour chaque app, exécute :"
for a in "${APPS[@]}"; do
  echo "  cd $ROOT/apps/$a && eas build:list --platform $PLATFORM --limit 1"
done
echo
echo "✅ DONE"
echo "Backup: $BK"
echo "Report: $RP"
