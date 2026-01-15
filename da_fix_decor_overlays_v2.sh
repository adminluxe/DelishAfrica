#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_decor_overlays_v2_bak_$STAMP"
mkdir -p "$BAK"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need rg
need perl

echo "== DA FIX DECOR OVERLAYS v2 =="
echo "BACKUP=$BAK"
echo

# 1) Candidats: fichiers qui semblent être des backgrounds/overlays + qui contiennent de l'absoluteFill / absolute.
mapfile -t CANDIDATES < <(
  rg -l -i "(BrandBackground|AppBackground|Background|Overlay|Glow|Snow|Confetti|Particles|Vignette)" "$ROOT/apps" \
  | rg "\.tsx$" \
  | while read -r f; do
      if rg -q "StyleSheet\.absoluteFill(Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(Object)?|position:\s*['\"]absolute['\"]|top:\s*0,\s*left:\s*0,\s*right:\s*0,\s*bottom:\s*0" "$f"; then
        echo "$f"
      fi
    done \
  | sort -u
)

# 2) On évite les fichiers avec UI interactive (sinon on casse des boutons)
FILES=()
for f in "${CANDIDATES[@]}"; do
  if rg -q "(onPress|Pressable|Touchable|Button|Link|router\.push|navigation\.)" "$f"; then
    continue
  fi
  FILES+=("$f")
done

echo "Fichiers patchés: ${#FILES[@]}"
[ "${#FILES[@]}" -gt 0 ] || { echo "⚠️ Aucun fichier décoratif trouvé à patcher."; exit 0; }

for f in "${FILES[@]}"; do
  cp -a "$f" "$BAK/$(echo "$f" | sed 's#/#__#g')" || true

  # Force pointerEvents="none" sur tout tag avec absolute/absoluteFill
  perl -0777 -i -pe '
    my $abs = qr/(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(?:Object)?|position:\s*['"'"'"]absolute['"'"'"]|top:\s*0,\s*left:\s*0,\s*right:\s*0,\s*bottom:\s*0)/;

    for my $tag (qw(View Animated\.View LinearGradient BlurView LottieView Image ImageBackground)) {
      # Ajoute si absent
      s/<$tag(?![^>]*\spointerEvents=)([^>]*?$abs[^>]*?)>/<${tag} pointerEvents="none"$1>/g;
      # Force si présent mais différent
      s/<$tag([^>]*?)\spointerEvents=(["'"'"'])(?!none)[^"'"'"']+\2([^>]*?$abs[^>]*?)>/<${tag}$1 pointerEvents="none"$3>/g;
    }
  ' "$f"
done

echo
echo "✅ Patch appliqué. Backup: $BAK"
echo
echo "== CHECK (sans lookahead) : lignes absoluteFill/absolute SANS pointerEvents =="
for f in "${FILES[@]}"; do
  echo "-- $f"
  rg -n "StyleSheet\.absoluteFill(Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(Object)?|position:\s*['\"]absolute['\"]|top:\s*0,\s*left:\s*0,\s*right:\s*0,\s*bottom:\s*0" "$f" \
    | rg -v "pointerEvents=" \
    | head -n 40 || true
  echo
done
