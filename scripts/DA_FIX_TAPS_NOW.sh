#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.backups/DA_FIX_TAPS_NOW_$TS"
mkdir -p "$BACKUP"

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local rel="${f#$ROOT/}"
  local dest="$BACKUP/$rel"
  mkdir -p "$(dirname "$dest")"
  cp -a "$f" "$dest"
}

echo "=============================================="
echo "🔥 DA_FIX_TAPS_NOW (3 apps) @ $TS"
echo "Backup: $BACKUP"
echo "=============================================="

# 1) Fix typo: "Thieyp ." -> "Thieyp."
echo
echo "✅ (1) Fix typo 'Thieyp .' -> 'Thieyp.' (client/merchant/courier)"
for app in client merchant courier; do
  while IFS= read -r f; do
    backup_file "$f"
    perl -0777 -i -pe 's/Thieyp\s+\./Thieyp./g' "$f"
  done < <(grep -RIl --exclude-dir node_modules --exclude-dir .expo --exclude-dir .turbo --exclude-dir .git \
      --include '*.ts' --include '*.tsx' "Thieyp ." "$ROOT/apps/$app" || true)
done

# 2) Fix taps: any absolute overlay View must not capture touches
# We patch only in app screens (expo-router) to stay safe.
echo
echo "✅ (2) Anti-overlay taps: add pointerEvents=\"none\" to absolute Views/Animated.Views in screens"
patch_file_abs() {
  local f="$1"
  backup_file "$f"

  # <View style={{ position: "absolute"...  => add pointerEvents="none" if missing
  perl -0777 -i -pe '
    s/<View(?![^>]*\bpointerEvents=)([^>]*?)\sstyle=\{\{\s*position:\s*"(absolute|relative)"(.*?)\}\}\s*>/<View pointerEvents="none"$1 style={{ position: "$2"$3 }}> /gms
  ' "$f" || true

  # <Animated.View style={{ position: "absolute"... => add pointerEvents="none" if missing
  perl -0777 -i -pe '
    s/<Animated\.View(?![^>]*\bpointerEvents=)([^>]*?)\sstyle=\{\{\s*position:\s*"(absolute|relative)"(.*?)\}\}\s*>/<Animated.View pointerEvents="none"$1 style={{ position: "$2"$3 }}> /gms
  ' "$f" || true
}

# We only patch likely-touch-breaking screens to minimize risk.
for app in client merchant courier; do
  echo "   -> scanning $app screens..."
  while IFS= read -r f; do
    patch_file_abs "$f"
  done < <(
    find "$ROOT/apps/$app/app" -maxdepth 3 -type f \( -name 'index.tsx' -o -name '*thieyp*.tsx' -o -name '*orders*.tsx' -o -name '*mission*.tsx' \) 2>/dev/null \
    | while read -r f; do
        # only patch files that actually contain absolute positioning and no pointerEvents already
        if grep -q 'position:\s*"\(absolute\|relative\)"' "$f"; then
          echo "$f"
        fi
      done
  )
done

# 3) Clean caches (client + courier + merchant)
echo
echo "✅ (3) Clear caches"
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
for app in client courier merchant; do
  rm -rf "$ROOT/apps/$app/.expo" "$ROOT/apps/$app/.turbo" "$ROOT/apps/$app/node_modules/.cache" 2>/dev/null || true
done

echo
echo "✅ DONE. Backups: $BACKUP"
echo
echo "Now restart metros (in tmux panes):"
echo "  CLIENT  : cd $ROOT/apps/client  && pnpm dev -- --tunnel --port 8081 --clear"
echo "  COURIER : cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear"
echo "  MERCHANT: cd $ROOT/apps/merchant&& pnpm dev -- --tunnel --port 8083 --clear"
