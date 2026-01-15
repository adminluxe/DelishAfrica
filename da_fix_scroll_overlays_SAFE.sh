#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_scroll_overlays_bak_${STAMP}"
mkdir -p "$BAK"
cd "$ROOT"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need perl
need find

mapfile -t TARGETS < <(
  find "$ROOT/apps" -type f \( -name "AppBackground.tsx" -o -name "BrandBackground.tsx" -o -name "SnowOverlay.tsx" \) \
    ! -path "*/node_modules/*" ! -name "*.bak*" ! -name "*.BAK*" ! -name "*.DISABLED*" \
    -print
)

echo "== DA Scroll Overlay SAFE =="
echo "Targets: ${#TARGETS[@]}"
echo "Backup:  $BAK"
echo

for f in "${TARGETS[@]}"; do
  mkdir -p "$BAK/$(dirname "${f#$ROOT/}")"
  cp -a "$f" "$BAK/${f#$ROOT/}"

  # 1) Ajoute pointerEvents="none" sur le ROOT element retourné
  perl -0777 -i -pe '
    s/(return\s*\(\s*<\s*(?:View|Animated\.View|LinearGradient|BlurView|ImageBackground|LottieView|Image)\b)(?![^>]*\spointerEvents=)/$1 pointerEvents="none"/s;

    # 2) Ajoute pointerEvents="none" sur les tags qui contiennent absoluteFill* dans leurs props
    s/(<\s*(?:View|Animated\.View|LinearGradient|BlurView|ImageBackground|LottieView|Image)\b)(?![^>]*\spointerEvents=)([^>]*absoluteFill[^>]*)(>)/$1 pointerEvents="none"$2$3/sg;
  ' "$f"

  echo "patched: $f"
done

echo
echo "✅ Done. Backup: $BAK"
echo "➡️ Relance Expo avec --clear + kill apps iPhone puis re-scan QR."
