#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")
API_URL="https://api.delishafrica.me"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$ROOT/.backups/DA_FINALIZE_NOW_$TS"
mkdir -p "$BACKUP_ROOT"

echo "=============================================="
echo "🚀 DA_FINALIZE_NOW — FINAL PATCH (3 APPS) "
echo "Repo : $ROOT"
echo "Backup: $BACKUP_ROOT"
echo "API   : $API_URL"
echo "=============================================="
echo

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local rel="${f#$ROOT/}"
  local dest="$BACKUP_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  cp -a "$f" "$dest"
}

patch_env_api() {
  local app="$1"
  local appdir="$ROOT/apps/$app"
  echo "==> [$app] Set EXPO_PUBLIC_API_* to production"
  for envf in "$appdir/.env" "$appdir/.env.local" "$appdir/.env.development" "$appdir/.env.production"; do
    [ -f "$envf" ] || continue
    backup_file "$envf"
    # ensure keys exist (append if missing)
    grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$envf" || echo "EXPO_PUBLIC_API_BASE_URL=$API_URL" >> "$envf"
    grep -q '^EXPO_PUBLIC_API_URL=' "$envf" || echo "EXPO_PUBLIC_API_URL=$API_URL" >> "$envf"
    # update values
    perl -pi -e "s@^EXPO_PUBLIC_API_BASE_URL=.*@EXPO_PUBLIC_API_BASE_URL=$API_URL@g" "$envf"
    perl -pi -e "s@^EXPO_PUBLIC_API_URL=.*@EXPO_PUBLIC_API_URL=$API_URL@g" "$envf"
  done
}

# Fix JSX broken injections like: style={{ ... } pointerEvents="none"
# -> style={{ ... }} pointerEvents="none"
fix_broken_pointerevents() {
  local app="$1"
  local appdir="$ROOT/apps/$app"
  echo "==> [$app] Fix broken pointerEvents JSX injections (syntax rescue)"

  # find files containing pointerEvents and "style={{" to patch
  mapfile -t files < <(grep -RIl --exclude-dir node_modules --exclude-dir .expo --exclude-dir dist --exclude-dir .git \
    'pointerEvents=' "$appdir/app" "$appdir/ui" 2>/dev/null || true)

  for f in "${files[@]:-}"; do
    backup_file "$f"

    # 1) ensure style block closes before pointerEvents
    perl -0777 -i -pe 's/style=\{\{([\s\S]*?)\}\s*pointerEvents=/style={{$1}} pointerEvents=/g' "$f" || true

    # 2) common broken sequence: "} pointerEvents="none"" -> "}} pointerEvents="none""
    perl -pi -e 's/\}\s*pointerEvents="none"/}} pointerEvents="none"/g' "$f" || true
    perl -pi -e "s/\}\s*pointerEvents='none'/}} pointerEvents='none'/g" "$f" || true

    # 3) normalize triple braces that can appear after multiple passes
    perl -pi -e 's/\}\}\}\s*pointerEvents/}} pointerEvents/g' "$f" || true
  done
}

# Neutralize overlays: force pointerEvents="none" on likely decorative absolute/fullscreen Views
neutralize_overlays_safe() {
  local app="$1"
  local appdir="$ROOT/apps/$app"
  echo "==> [$app] Neutralize overlays (safe, no regex injection inside style)"

  # We DO NOT auto-inject pointerEvents into random <View ... style={{...}}> anymore.
  # Instead: target ONLY components with obvious overlay patterns (absolute + big dimensions) and
  # only if the file already has pointerEvents somewhere OR contains known decorative keywords.

  local patterns=("Snow" "Particles" "Aurora" "Glow" "Bubbles" "Background" "Decor" "Confetti")
  local candidates=()

  for p in "${patterns[@]}"; do
    while IFS= read -r f; do candidates+=("$f"); done < <(
      grep -RIl --exclude-dir node_modules --exclude-dir .expo --exclude-dir dist --exclude-dir .git \
      "$p" "$appdir" 2>/dev/null || true
    )
  done

  # unique
  candidates=($(printf "%s\n" "${candidates[@]:-}" | awk '!seen[$0]++' | head -n 25))

  for f in "${candidates[@]:-}"; do
    [ -f "$f" ] || continue
    backup_file "$f"

    # Add pointerEvents="none" ONLY to Views that already have absolute positioning in style object
    # and do not already have pointerEvents=
    # We rewrite: <View ... style={{ ... position: "absolute" ... }} ...>
    # into:      <View ... pointerEvents="none" style={{ ... position: "absolute" ... }} ...>
    perl -0777 -i -pe '
      s/<View(\b(?![^>]*pointerEvents=)[^>]*?)\sstyle=\{\{([^}]*position:\s*[\"\x27]absolute[\"\x27][^}]*)\}\}/<View$1 pointerEvents="none" style={{$3}}/g;
    ' "$f" || true
  done
}

# Remove visible "demo" text in UI (safe replacements)
purge_demo_text() {
  local app="$1"
  local appdir="$ROOT/apps/$app"
  echo "==> [$app] Purge visible 'demo' labels/text"

  # Only touch app routes + ui; avoid node_modules
  mapfile -t files < <(grep -RIl --exclude-dir node_modules --exclude-dir .expo --exclude-dir dist --exclude-dir .git \
    -E '\(démo\)|demo|Démo|DEMO' "$appdir/app" "$appdir/ui" 2>/dev/null || true)

  for f in "${files[@]:-}"; do
    backup_file "$f"
    perl -pi -e 's/\(démo\)//g; s/\(demo\)//ig; s/\bdémo\b//ig; s/\bdemo\b//ig;' "$f" || true
    # cosmetic double spaces
    perl -pi -e 's/  +/ /g' "$f" || true
  done
}

clean_caches() {
  local app="$1"
  local appdir="$ROOT/apps/$app"
  echo "==> [$app] Clean caches (.expo/.turbo/node_modules/.cache)"
  rm -rf "$appdir/.expo" "$appdir/.turbo" "$appdir/node_modules/.cache" 2>/dev/null || true
}

echo "✅ Step 0: Sanity paths"
for a in "${APPS[@]}"; do
  [ -d "$ROOT/apps/$a" ] || { echo "❌ Missing: $ROOT/apps/$a"; exit 1; }
done

echo
echo "✅ Step 1: Patch env API URL for all apps"
for a in "${APPS[@]}"; do patch_env_api "$a"; done

echo
echo "✅ Step 2: Rescue JSX pointerEvents syntax (all apps)"
for a in "${APPS[@]}"; do fix_broken_pointerevents "$a"; done

echo
echo "✅ Step 3: Neutralize overlays safely (all apps)"
for a in "${APPS[@]}"; do neutralize_overlays_safe "$a"; done

echo
echo "✅ Step 4: Purge 'demo' visible text (all apps)"
for a in "${APPS[@]}"; do purge_demo_text "$a"; done

echo
echo "✅ Step 5: Global Metro caches cleanup"
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true

echo
echo "✅ Step 6: App caches cleanup"
for a in "${APPS[@]}"; do clean_caches "$a"; done

echo
echo "=============================================="
echo "✅ DONE. Backups saved in:"
echo "   $BACKUP_ROOT"
echo
echo "NOW restart Metro (tmux windows):"
echo "  CLIENT : cd $ROOT/apps/client  && pnpm dev -- --tunnel --port 8081 --clear"
echo "  COURIER: cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear"
echo "  MERCH  : cd $ROOT/apps/merchant&& pnpm dev -- --tunnel --port 8083 --clear"
echo
echo "iPhone: force-close apps -> re-scan QR (pas juste Reload JS)."
echo "=============================================="
