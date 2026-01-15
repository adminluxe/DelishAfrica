#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_scroll_fix_bak_${STAMP}"
mkdir -p "$BAK"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need perl
need find

echo "== DelishAfrica · FIX SCROLL GLOBAL =="
echo "ROOT: $ROOT"
echo "BACKUP: $BAK"
echo

# 1) Cibles : uniquement ts/tsx dans apps (hors node_modules / backups)
mapfile -t FILES < <(
  find "$ROOT/apps" -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" \
    ! -name "*.bak*" ! -name "*.BAK*" ! -name "*.DISABLED*" \
    -print
)

echo "Fichiers scannés: ${#FILES[@]}"
echo

patched=0

backup_one() {
  local f="$1"
  mkdir -p "$BAK/$(dirname "${f#$ROOT/}")"
  cp -a "$f" "$BAK/${f#$ROOT/}"
}

patch_file_absoluteFill() {
  local f="$1"

  # Patch uniquement si le fichier contient "absoluteFill" (sinon on touche pas)
  if ! grep -q "absoluteFill" "$f" 2>/dev/null; then
    return 0
  fi

  backup_one "$f"

  # Ajoute pointerEvents="none" sur certains composants ABSOLUTE-FILL sans pointerEvents
  # On évite Pressable/Touchable* volontairement (eux peuvent être interactifs).
  perl -0777 -i -pe '
    s{
      <((?:Animated\.)?View|LinearGradient|BlurView|ImageBackground|LottieView|Image)
      (?![^>]*\spointerEvents=)
      ([^>]*\bstyle=\{[^}]*absoluteFill[^}]*\}[^>]*)
      >
    }{<$1 pointerEvents="none"$2>}gix;

    s{
      <((?:Animated\.)?View|LinearGradient|BlurView|ImageBackground|LottieView|Image)
      (?![^>]*\spointerEvents=)
      ([^>]*\bstyle=\{\[[^\]]*absoluteFill[^\]]*\][^}]*\}[^>]*)
      >
    }{<$1 pointerEvents="none"$2>}gix;

    # Self-closing variants
    s{
      <((?:Animated\.)?View|LinearGradient|BlurView|ImageBackground|LottieView|Image)
      (?![^>]*\spointerEvents=)
      ([^>]*\bstyle=\{[^}]*absoluteFill[^}]*\}[^>]*)\s*/>
    }{<$1 pointerEvents="none"$2 />}gix;

    s{
      <((?:Animated\.)?View|LinearGradient|BlurView|ImageBackground|LottieView|Image)
      (?![^>]*\spointerEvents=)
      ([^>]*\bstyle=\{\[[^\]]*absoluteFill[^\]]*\][^}]*(?:\}[^>]*)?)\s*/>
    }{<$1 pointerEvents="none"$2 />}gix;
  ' "$f"

  patched=$((patched+1))
}

# 2) Renfort ciblé pour les composants background/overlay connus :
# - si le fichier ne contient AUCUN pointerEvents, on force au moins le premier <View ...> en pointerEvents="none"
patch_file_background_minimum() {
  local f="$1"
  backup_one "$f"

  perl -0777 -i -pe '
    if ($_ !~ /pointerEvents\s*=/) {
      s/<View\b/<View pointerEvents="none"/;
    }
  ' "$f"
}

# Pass A: patch absoluteFill partout (safe)
for f in "${FILES[@]}"; do
  patch_file_absoluteFill "$f"
done

# Pass B: renfort sur fichiers background/overlay connus (multi-places dans repo)
mapfile -t BGFILES < <(
  find "$ROOT/apps" -type f \( -name "AppBackground.tsx" -o -name "BrandBackground.tsx" -o -name "SnowOverlay.tsx" \) \
    ! -path "*/node_modules/*" \
    ! -name "*.bak*" ! -name "*.BAK*" ! -name "*.DISABLED*" \
    -print
)

echo
echo "Fichiers background/overlay trouvés: ${#BGFILES[@]}"
for f in "${BGFILES[@]}"; do
  # si déjà pointerEvents quelque part, on ne force pas le "premier View" (on a déjà patch absoluteFill)
  if ! grep -q "pointerEvents" "$f" 2>/dev/null; then
    patch_file_background_minimum "$f"
  fi
done

echo
echo "✅ Patch terminé."
echo "➡️ Backup complet: $BAK"
echo
echo "NEXT (important) :"
echo "1) Stoppe les 3 Metro (client/merchant/courier) puis relance avec --clear."
echo "2) Sur iPhone: kill complet des 3 apps (swipe up) puis re-scan QR."
