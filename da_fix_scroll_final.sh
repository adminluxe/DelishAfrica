#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_scroll_final_bak_$STAMP"
mkdir -p "$BAK"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need rg
need perl

echo "== DA FIX SCROLL FINAL =="
echo "BACKUP=$BAK"
echo

# 1) fichiers "wrappers" critiques
mapfile -t WRAPS < <(
  find "$ROOT/apps" -type f \( -path "*/app/index.tsx" -o -path "*/app/(tabs)/*.tsx" \) 2>/dev/null | sort -u
)

echo "Wrappers ciblés: ${#WRAPS[@]}"
for f in "${WRAPS[@]}"; do
  cp -a "$f" "$BAK/$(echo "$f" | sed 's#/#__#g')"

  # A) Wrapper non self-closing: pointerEvents="none" => box-none (safe)
  perl -0777 -i -pe '
    s/<View([^>]*?)\spointerEvents=(["'"'"'])none\2([^>]*?)(?<!\/)>/<View$1 pointerEvents="box-none"$3>/g;
    s/<Animated\.View([^>]*?)\spointerEvents=(["'"'"'])none\2([^>]*?)(?<!\/)>/<Animated.View$1 pointerEvents="box-none"$3>/g;
    s/<Pressable([^>]*?)\spointerEvents=(["'"'"'])none\2([^>]*?)(?<!\/)>/<Pressable$1 pointerEvents="box-none"$3>/g;
  ' "$f"
done

# 2) Patch overlays absolute/absoluteFill dans le dossier app (pour ne pas casser components partagés)
mapfile -t APPFILES < <(
  rg -l "StyleSheet\.absoluteFill(Object)?|absoluteFillObject|position:\s*['\"]absolute['\"]|\.{3}StyleSheet\.absoluteFill" \
    "$ROOT/apps/client/app" "$ROOT/apps/merchant/app" "$ROOT/apps/courier/app" \
  | sort -u
)

echo "App files absolute ciblés: ${#APPFILES[@]}"
for f in "${APPFILES[@]}"; do
  cp -a "$f" "$BAK/$(echo "$f" | sed 's#/#__#g')" || true

  perl -0777 -i -pe '
    my $abs = qr/(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|position:\s*['"'"'"]absolute['"'"'"]|\.{3}StyleSheet\.absoluteFill(?:Object)?)/;

    for my $tag (qw(View Animated\.View LinearGradient BlurView LottieView Image ImageBackground)) {

      # self-closing absolute => pointerEvents none
      s/<$tag(?![^>]*\spointerEvents=)([^>]*?$abs[^>]*?)\s*\/>/<${tag} pointerEvents="none"$1 \/>/g;
      s/<$tag([^>]*?)\spointerEvents=(["'"'"'])(?!none)[^"'"'"']+\2([^>]*?$abs[^>]*?)\s*\/>/<${tag}$1 pointerEvents="none"$3 \/>/g;

      # non self-closing absolute => pointerEvents box-none
      s/<$tag(?![^>]*\spointerEvents=)([^>]*?$abs[^>]*?)(?<!\/)>/<${tag} pointerEvents="box-none"$1>/g;
      s/<$tag([^>]*?)\spointerEvents=(["'"'"'])(?!box-none)[^"'"'"']+\2([^>]*?$abs[^>]*?)(?<!\/)>/<${tag}$1 pointerEvents="box-none"$3>/g;
    }

    # Pressable absolute => box-none
    s/<Pressable(?![^>]*\spointerEvents=)([^>]*?$abs[^>]*?)(?<!\/)>/<Pressable pointerEvents="box-none"$1>/g;
    s/<Pressable([^>]*?)\spointerEvents=(["'"'"'])(?!box-none)[^"'"'"']+\2([^>]*?$abs[^>]*?)(?<!\/)>/<Pressable$1 pointerEvents="box-none"$3>/g;
  ' "$f"
done

echo
echo "✅ Patch terminé. Backup: $BAK"
echo "== CHECK rapide (pointerEvents=\"none\" dans /app ) =="
rg -n "pointerEvents=\"none\"" "$ROOT/apps" | rg "/app/" | head -n 120 || true
