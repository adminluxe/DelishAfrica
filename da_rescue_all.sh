#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SESSION="DA_REL"
STAMP="$(date +%Y%m%d_%H%M%S)"
RESCUE_BAK="/tmp/da_rescue_bak_$STAMP"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need rg
need perl
need docker
need tmux

echo "== DA RESCUE ALL =="
echo "ROOT=$ROOT"
echo "SESSION=$SESSION"
echo "RESCUE_BAK=$RESCUE_BAK"
mkdir -p "$RESCUE_BAK"

# -----------------------------
# 1) ROLLBACK des patches trop larges (si backups existent)
# -----------------------------
echo
echo "== 1) Rollback (si backups de patch existent) =="

LATEST_BAK=""
for d in /tmp/da_scroll_global_bak_* /tmp/da_scroll_fix_bak_* /tmp/da_scroll_fix_bak_* /tmp/da_scroll_fix_bak_*; do
  if [ -d "$d" ]; then
    # prend le plus récent
    if [ -z "$LATEST_BAK" ]; then
      LATEST_BAK="$d"
    else
      # compare mtime
      if [ "$d" -nt "$LATEST_BAK" ]; then LATEST_BAK="$d"; fi
    fi
  fi
done

if [ -n "${LATEST_BAK:-}" ] && [ -d "$LATEST_BAK" ]; then
  echo "🧯 Backup détecté: $LATEST_BAK"
  echo "↩️  Restauration des fichiers patchés…"
  shopt -s nullglob
  for b in "$LATEST_BAK"/*; do
    orig="$(echo "$b" | sed "s#^$LATEST_BAK/##" | sed 's#__#/#g')"
    # sécurité
    if [ -f "$orig" ]; then
      cp -a "$orig" "$RESCUE_BAK/$(echo "$orig" | sed 's#/#__#g')" || true
      cp -a "$b" "$orig"
    fi
  done
  echo "✅ Rollback terminé (avant rescue backup: $RESCUE_BAK)"
else
  echo "ℹ️ Aucun backup précédent trouvé, on continue."
fi

# -----------------------------
# 2) Fix scroll MAIS ciblé (on ne touche PAS aux wrappers app/(tabs) )
#    On patch UNIQUEMENT les composants d’overlay (Background/Overlay/Glow/Snow/Confetti)
#    et UNIQUEMENT les tags *self-closing* absoluteFill => pointerEvents="none"
# -----------------------------
echo
echo "== 2) Fix scroll ciblé (safe) =="

mapfile -t OVERLAY_FILES < <(
  rg -l "StyleSheet\.absoluteFill(Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(Object)?" \
    "$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier" \
  | rg -n "/components/|/src/ui/" \
  | rg -i "(background|overlay|glow|snow|confetti)" \
  | sort -u \
  | sed -E 's/^[0-9]+://'
)

echo "Overlay files ciblés: ${#OVERLAY_FILES[@]}"
if [ "${#OVERLAY_FILES[@]}" -eq 0 ]; then
  echo "⚠️ Aucun fichier overlay matché. On fera un scan plus large ensuite si besoin."
fi

for f in "${OVERLAY_FILES[@]}"; do
  [ -f "$f" ] || continue
  cp -a "$f" "$RESCUE_BAK/$(echo "$f" | sed 's#/#__#g')" || true

  # Patch SAFE: UNIQUEMENT self-closing overlays absoluteFill => pointerEvents="none"
  # (évite de casser un wrapper contenant le ScrollView)
  perl -0777 -i -pe '
    for my $tag (qw(View Animated\.View LinearGradient BlurView LottieView Image ImageBackground)) {
      s/<$tag(?![^>]*\spointerEvents=)([^>]*?(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(?:Object)?)[^>]*?)\s*\/>/<${tag} pointerEvents="none"$1 \/>/g;
      s/<$tag([^>]*?)\spointerEvents=(["'"'"'])(?!none)[^"'"'"']+\2([^>]*?(StyleSheet\.absoluteFill(?:Object)?|absoluteFillObject|\.{3}StyleSheet\.absoluteFill(?:Object)?)[^>]*?)\s*\/>/<${tag}$1 pointerEvents="none"$3 \/>/g;
    }
  ' "$f"
done

echo "✅ Patch scroll ciblé appliqué (backup: $RESCUE_BAK)"

# -----------------------------
# 3) API 3010: forcer compose + restart delish-api si health KO
# -----------------------------
echo
echo "== 3) Fix API 3010 =="

cd "$ROOT"
docker compose up -d || true

# s'assurer que delish-api existe
if docker ps --format '{{.Names}}' | rg -q '^delish-api$'; then
  echo "🐳 delish-api présent"
else
  echo "⚠️ delish-api non trouvé dans docker ps. Compose services:"
  docker compose ps || true
fi

# test health (3 tentatives)
ok=0
for i in 1 2 3; do
  if curl -fsS "http://127.0.0.1:3010/api/v1/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done

if [ "$ok" -ne 1 ]; then
  echo "🧨 Health KO -> restart delish-api"
  docker restart delish-api || true
  sleep 2
fi

# re-test
if curl -fsS "http://127.0.0.1:3010/api/v1/health" >/dev/null 2>&1; then
  echo "✅ API 3010 OK"
else
  echo "❌ API 3010 toujours KO -> infos debug:"
  docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' | rg 'delish-api|NAME' || true
  docker logs --tail=120 delish-api || true
fi

# -----------------------------
# 4) Expo/Metro: éviter read EIO => EXPO_NO_INTERACTIVE=1 + CI=1
#    Redémarre les 3 dev servers dans tmux (windows 5/6/7)
# -----------------------------
echo
echo "== 4) Relance Metro (anti-EIO) =="

restart_in_tmux() {
  local target="$1"
  local cmd="$2"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux send-keys -t "$SESSION:$target" C-c 2>/dev/null || true
    tmux send-keys -t "$SESSION:$target" "cd '$ROOT' && clear" C-m
    tmux send-keys -t "$SESSION:$target" "$cmd" C-m
  else
    echo "⚠️ Session tmux $SESSION introuvable. Lance manuellement:"
    echo "$cmd"
  fi
}

ENVV="export EXPO_NO_INTERACTIVE=1 CI=1 NODE_OPTIONS=--max_old_space_size=4096;"

restart_in_tmux "5" "cd '$ROOT/apps/client'   && $ENVV pnpm dev -- --tunnel --clear --port 8081"
restart_in_tmux "6" "cd '$ROOT/apps/merchant' && $ENVV pnpm dev -- --tunnel --clear --port 8083"
restart_in_tmux "7" "cd '$ROOT/apps/courier'  && $ENVV pnpm dev -- --tunnel --clear --port 8082"

echo
echo "✅ RESCUE terminé."
echo "➡️ Backups avant modifications: $RESCUE_BAK"
echo "📱 Sur iPhone: kill complet des 3 apps (swipe up) + re-scan QR."
