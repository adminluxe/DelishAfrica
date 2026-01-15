#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_fix_scroll_bg_v3_bak_$STAMP"
mkdir -p "$BAK"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need rg
need perl
need find

echo "== DA FIX SCROLL BG v3 =="
echo "BACKUP=$BAK"
echo

# On cible les fichiers les plus suspects (d'après ton output)
mapfile -t FILES < <(
  find "$ROOT/apps" -type f \( \
    -name "AppBackground.tsx" -o \
    -name "BrandBackground.tsx" -o \
    -name "SnowOverlay.tsx" \
  \) | sort -u
)

echo "Fichiers ciblés: ${#FILES[@]}"
[ "${#FILES[@]}" -gt 0 ] || { echo "⚠️ Aucun fichier trouvé."; exit 0; }
echo

for f in "${FILES[@]}"; do
  cp -a "$f" "$BAK/$(echo "$f" | sed 's#/#__#g')" || true

  # 1) Si une View contient {children} / props.children => wrapper doit être box-none
  perl -0777 -i -pe '
    s/<View(?![^>]*\spointerEvents=)([^>]*)>(\s*\{(?:props\.)?children\})/<View pointerEvents="box-none"$1>$2/g;
  ' "$f"

  # 2) Tous les layers décoratifs basés sur styles.(bg|overlay|layer|glow|snow|vignette|backdrop|shade)
  perl -0777 -i -pe '
    my $k = qr/(bg|overlay|layer|glow|snow|vignette|backdrop|shade)/;

    # <View style={styles.bg} .../>  ou <View style={[styles.bg, ...]} .../>
    s/<View(?![^>]*\spointerEvents=)([^>]*\bstyle=\{[^\}]*styles\.$k[^\}]*\}[^>]*)>/<View pointerEvents="none"$1>/g;
    s/<View(?![^>]*\spointerEvents=)([^>]*\bstyle=\{\[[^\]]*styles\.$k[^\]]*\]\}[^>]*)>/<View pointerEvents="none"$1>/g;

    # Animated.View / LinearGradient (au cas où)
    s/<Animated\.View(?![^>]*\spointerEvents=)([^>]*\bstyle=\{[^\}]*styles\.$k[^\}]*\}[^>]*)>/<Animated.View pointerEvents="none"$1>/g;
    s/<Animated\.View(?![^>]*\spointerEvents=)([^>]*\bstyle=\{\[[^\]]*styles\.$k[^\]]*\]\}[^>]*)>/<Animated.View pointerEvents="none"$1>/g;

    s/<LinearGradient(?![^>]*\spointerEvents=)([^>]*\bstyle=\{[^\}]*styles\.$k[^\}]*\}[^>]*)>/<LinearGradient pointerEvents="none"$1>/g;
    s/<LinearGradient(?![^>]*\spointerEvents=)([^>]*\bstyle=\{\[[^\]]*styles\.$k[^\]]*\]\}[^>]*)>/<LinearGradient pointerEvents="none"$1>/g;
  ' "$f"
done

echo "✅ Patch appliqué. Backup: $BAK"
echo
echo "== CHECK : occurrences styles.(bg/overlay/layer/...) sans pointerEvents dans le tag =="
for f in "${FILES[@]}"; do
  echo "-- $f"
  rg -n "<(View|Animated\\.View|LinearGradient)[^>]*style=\\{[^}]*styles\\.(bg|overlay|layer|glow|snow|vignette|backdrop|shade)[^}]*\\}[^>]*>" "$f" \
    | rg -v "pointerEvents=" \
    | head -n 50 || true
  rg -n "<(View|Animated\\.View|LinearGradient)[^>]*style=\\{\\[[^\\]]*styles\\.(bg|overlay|layer|glow|snow|vignette|backdrop|shade)[^\\]]*\\]\\}[^>]*>" "$f" \
    | rg -v "pointerEvents=" \
    | head -n 50 || true
  echo
done

echo "== DONE =="
