#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_decor_overlays_bak_$STAMP"
mkdir -p "$BAK"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need rg
need perl

echo "== DA FIX DECOR OVERLAYS =="
echo "BACKUP=$BAK"
echo

# 1) candidats: fichiers décoratifs (background/overlay/glow/snow/confetti) qui utilisent absolute fill
mapfile -t CANDIDATES < <(
  rg -l -i "(background|overlay|glow|snow|confetti|lottie)" "$ROOT/apps" \
  | rg "\.tsx$" \
  | while read -r f; do
      if rg -q "StyleSheet\.absoluteFill(Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(Object)?|position:\s*['\"]absolute['\"]|top:\s*0,\s*left:\s*0,\s*right:\s*0,\s*bottom:\s*0" "$f"; then
        echo "$f"
      fi
    done \
  | sort -u
)

# 2) filtre: on évite les fichiers qui contiennent du vrai UI interactif
FILES=()
for f in "${CANDIDATES[@]}"; do
  if rg -q "(onPress|Pressable|Touchable|Button|Link|router\.push|navigation\.)" "$f"; then
    continue
  fi
  FILES+=("$f")
done

echo "Fichiers décoratifs patchés: ${#FILES[@]}"
[ "${#FILES[@]}" -gt 0 ] || { echo "⚠️ Aucun fichier décoratif matché (bizarre)."; exit 0; }

for f in "${FILES[@]}"; do
  cp -a "$f" "$BAK/$(echo "$f" | sed 's#/#__#g')" || true

  # Règle: tout ce qui est overlay absolute/absoluteFill dans ces fichiers doit être pointerEvents="none"
  perl -0777 -i -pe '
    my $abs = qr/(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(?:Object)?|position:\s*['"'"'"]absolute['"'"'"]|top:\s*0,\s*left:\s*0,\s*right:\s*0,\s*bottom:\s*0)/;

    for my $tag (qw(View Animated\.View LinearGradient BlurView LottieView Image ImageBackground)) {
      # add
      s/<$tag(?![^>]*\spointerEvents=)([^>]*?$abs[^>]*?)>/<${tag} pointerEvents="none"$1>/g;
      # force
      s/<$tag([^>]*?)\spointerEvents=(["'"'"'])(?!none)[^"'"'"']+\2([^>]*?$abs[^>]*?)>/<${tag}$1 pointerEvents="none"$3>/g;
    }
  ' "$f"
done

echo
echo "✅ Patch décoratif OK. Backup: $BAK"
echo "== CHECK: absoluteFill sans pointerEvents dans fichiers décoratifs (devrait être vide) =="
for f in "${FILES[@]}"; do
  rg -n "<(View|Animated\.View|LinearGradient|BlurView|LottieView|Image|ImageBackground)\b(?![^>]*pointerEvents=)[^>]*(absoluteFillObject|StyleSheet\.absoluteFill|\.{3}StyleSheet\.absoluteFill|position:\s*['\"]absolute['\"])" "$f" && echo "⚠️ $f" || true
done
