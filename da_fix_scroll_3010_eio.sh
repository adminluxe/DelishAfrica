#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_fix_scroll_bak_$STAMP"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need rg
need perl
need docker

echo "== DA FIX (scroll + 3010 + expo EIO) =="
echo "ROOT=$ROOT"
echo "BACKUP=$BAK"
mkdir -p "$BAK"

# -------------------------
# 1) BACKUP fichiers sensibles (tabs + index + DemoFab)
# -------------------------
targets=()
for app in client merchant courier; do
  for f in \
    "$ROOT/apps/$app/app/index.tsx" \
    "$ROOT/apps/$app/app/(tabs)/index.tsx" \
    "$ROOT/apps/$app/app/(tabs)/explore.tsx" \
    "$ROOT/apps/$app/app/_components/DemoFab.tsx"
  do
    [ -f "$f" ] && targets+=("$f")
  done
done

echo "Fichiers ciblés (backup): ${#targets[@]}"
for f in "${targets[@]}"; do
  cp -a "$f" "$BAK/$(echo "$f" | sed 's#/#__#g')"
done

# -------------------------
# 2) FIX #1 : wrapper View/Animated.View pointerEvents="none" => box-none (SAFE)
#    (NE TOUCHE PAS aux self-closing <View ... /> décoratifs)
# -------------------------
for f in "${targets[@]}"; do
  perl -0777 -i -pe '
    # <View ... pointerEvents="none" ...>  (pas self-closing) => box-none
    s/<View([^>]*?)\spointerEvents=(["'"'"'])none\2([^>]*?)(?<!\/)>/<View$1 pointerEvents="box-none"$3>/g;
    s/<Animated\.View([^>]*?)\spointerEvents=(["'"'"'])none\2([^>]*?)(?<!\/)>/<Animated.View$1 pointerEvents="box-none"$3>/g;
  ' "$f"
done

# -------------------------
# 3) FIX #2 : overlays FULLSCREEN self-closing en absoluteFill/absolute => pointerEvents="none" (SAFE)
#    (uniquement sur tags qui finissent par "/>")
# -------------------------
for f in "${targets[@]}"; do
  perl -0777 -i -pe '
    for my $tag (qw(View Animated\.View LinearGradient BlurView LottieView Image ImageBackground)) {
      # ajoute pointerEvents="none" si absent ET tag self-closing + style absolute
      s/<$tag(?![^>]*\spointerEvents=)([^>]*?(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|position:\s*['"'"'"]absolute['"'"'"]|\.{3}StyleSheet\.absoluteFill(?:Object)?)[^>]*?)\s*\/>/<${tag} pointerEvents="none"$1 \/>/g;

      # force pointerEvents="none" si présent mais différent ET tag self-closing + style absolute
      s/<$tag([^>]*?)\spointerEvents=(["'"'"'])(?!none)[^"'"'"']+\2([^>]*?(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|position:\s*['"'"'"]absolute['"'"'"]|\.{3}StyleSheet\.absoluteFill(?:Object)?)[^>]*?)\s*\/>/<${tag}$1 pointerEvents="none"$3 \/>/g;
    }

    # Pressable fullscreen => box-none (même logique: self-closing rare mais safe si / >)
    s/<Pressable(?![^>]*\spointerEvents=)([^>]*?(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|position:\s*['"'"'"]absolute['"'"'"]|\.{3}StyleSheet\.absoluteFill(?:Object)?)[^>]*?)\s*\/>/<Pressable pointerEvents="box-none"$1 \/>/g;
    s/<Pressable([^>]*?)\spointerEvents=(["'"'"'])(?!box-none)[^"'"'"']+\2([^>]*?(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|position:\s*['"'"'"]absolute['"'"'"]|\.{3}StyleSheet\.absoluteFill(?:Object)?)[^>]*?)\s*\/>/<Pressable$1 pointerEvents="box-none"$3 \/>/g;
  ' "$f"
done

echo "✅ Patch scroll appliqué. Backup: $BAK"

# -------------------------
# 4) FIX API 3010 : compose up + restart si health KO
# -------------------------
cd "$ROOT"
docker compose up -d || true

ok=0
for i in 1 2 3; do
  if curl -fsS "http://127.0.0.1:3010/api/v1/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done

if [ "$ok" -ne 1 ]; then
  echo "🧨 API health KO -> docker restart delish-api"
  docker restart delish-api || true
  sleep 2
fi

if curl -fsS "http://127.0.0.1:3010/api/v1/health" >/dev/null 2>&1; then
  echo "✅ API 3010 OK"
else
  echo "❌ API 3010 toujours KO (debug logs):"
  docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' | rg 'delish-api|NAME' || true
  docker logs --tail=120 delish-api || true
fi

# -------------------------
# 5) Affiche les points restants "dangereux" (pour contrôle)
# -------------------------
echo
echo "== CHECK: wrappers pointerEvents none restants dans apps/*/app =="
rg -n "pointerEvents=\"none\"" "$ROOT/apps" | rg "/app/" | head -n 120 || true

echo
echo "✅ Terminé."
echo "➡️ Relance Metro avec EXPO_NO_INTERACTIVE=1 (voir commandes juste après)."
