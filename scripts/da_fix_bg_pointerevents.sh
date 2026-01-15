#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/bg_pointerevents_$TS"
APPS=(client courier merchant)

log() { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }

mkdir -p "$BK"

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

reenable_env() {
  local app="$1"
  local envfile="$ROOT/apps/$app/.env.local"
  [[ -f "$envfile" ]] || return 0
  backup_file "$envfile"
  sed -i '/^EXPO_PUBLIC_BG_OFF=/d' "$envfile" || true
  log "$app: backgrounds ré-activés (EXPO_PUBLIC_BG_OFF retiré)"
}

patch_pointerevents_abs() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  backup_file "$f"
  log "Hardening pointerEvents: $f"

  # Ajoute pointerEvents="none" sur View/Animated.View si absoluteFill* est dans le tag et pointerEvents absent
  perl -0777 -i -pe '
    s/<View(?![^>]*\bpointerEvents=)([^>]*StyleSheet\.(?:absoluteFill|absoluteFillObject)[^>]*?)>/<View pointerEvents="none"$1>/g;
    s/<Animated\.View(?![^>]*\bpointerEvents=)([^>]*StyleSheet\.(?:absoluteFill|absoluteFillObject)[^>]*?)>/<Animated.View pointerEvents="none"$1>/g;

    # cas array: style={[StyleSheet.absoluteFillObject, ...]}
    s/<View(?![^>]*\bpointerEvents=)([^>]*style=\{\[\s*StyleSheet\.(?:absoluteFill|absoluteFillObject)[^>]*?)>/<View pointerEvents="none"$1>/g;
    s/<Animated\.View(?![^>]*\bpointerEvents=)([^>]*style=\{\[\s*StyleSheet\.(?:absoluteFill|absoluteFillObject)[^>]*?)>/<Animated.View pointerEvents="none"$1>/g;
  ' "$f"
}

log "BACKUP: $BK"

for app in "${APPS[@]}"; do
  reenable_env "$app"
  while IFS= read -r f; do
    patch_pointerevents_abs "$f"
  done < <(find "$ROOT/apps/$app" -type f \( \
      -name "AppBackground.tsx" -o \
      -name "BrandBackground.tsx" -o \
      -name "SnowOverlay.tsx" \
    \) 2>/dev/null)
done

log "✅ OK. Backups: $BK"
log "👉 Restart Expo avec --clear (important)"
cat <<EOF

cd $ROOT/apps/client  && pnpm exec expo start --dev-client --tunnel --clear --port 8081
cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

EOF
