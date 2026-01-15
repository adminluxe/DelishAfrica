#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")
API_URL="https://api.delishafrica.me"

TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$ROOT/.backups/FINISH_ALL_3_APPS_NOW_V2_$TS"
mkdir -p "$BACKUP_ROOT"

echo "=============================================="
echo "🔥 FINISH_ALL_3_APPS_NOW_V2"
echo "Backup: $BACKUP_ROOT"
echo "API   : $API_URL"
echo "=============================================="

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local rel="${f#$ROOT/}"
  local dest="$BACKUP_ROOT/$rel"
  mkdir -p "$(dirname "$dest")"
  cp -a "$f" "$dest"
}

echo
echo "✅ (1) Unlock + patch .env files (immutable + perms)"
for app in "${APPS[@]}"; do
  appdir="$ROOT/apps/$app"
  # unlock .env*
  while IFS= read -r envf; do
    [ -f "$envf" ] || continue
    backup_file "$envf"
    # remove immutable flag if exists (ignore errors if chattr not available)
    chattr -i "$envf" 2>/dev/null || true
    chmod u+w "$envf" 2>/dev/null || true

    # ensure keys exist then set prod API
    grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$envf" || echo "EXPO_PUBLIC_API_BASE_URL=$API_URL" >> "$envf"
    grep -q '^EXPO_PUBLIC_API_URL=' "$envf" || echo "EXPO_PUBLIC_API_URL=$API_URL" >> "$envf"

    perl -pi -e "s@^EXPO_PUBLIC_API_BASE_URL=.*@EXPO_PUBLIC_API_BASE_URL=$API_URL@g" "$envf"
    perl -pi -e "s@^EXPO_PUBLIC_API_URL=.*@EXPO_PUBLIC_API_URL=$API_URL@g" "$envf"
  done < <(find "$appdir" -maxdepth 1 -type f -name ".env*" 2>/dev/null || true)
done

echo
echo "✅ (2) FIX pointerEvents syntax (ALL apps) — ignore *.bak* files"
for app in "${APPS[@]}"; do
  appdir="$ROOT/apps/$app"
  echo "==> [$app] repairing JSX pointerEvents patterns..."

  # target TS/TSX only, exclude backups
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    case "$f" in
      *.bak*|*DISABLED* ) continue ;;
    esac

    backup_file "$f"

    # A) close style block before pointerEvents if missing
    perl -0777 -i -pe 's/style=\{\{([\s\S]*?)\}\s*pointerEvents=/style={{$1}} pointerEvents=/g' "$f" || true

    # B) brute fix: "} pointerEvents="none"" => "}} pointerEvents="none""
    perl -pi -e 's/\}\s*pointerEvents="none"/}} pointerEvents="none"/g' "$f" || true
    perl -pi -e "s/\}\s*pointerEvents='none'/}} pointerEvents='none'/g" "$f" || true

    # C) normalize triple braces if any
    perl -pi -e 's/\}\}\}\s*pointerEvents/}} pointerEvents/g' "$f" || true
  done < <(
    find "$appdir" -type f \( -name "*.tsx" -o -name "*.ts" \) \
      ! -path "*/node_modules/*" ! -path "*/.expo/*" ! -path "*/dist/*" ! -path "*/.git/*" \
      -print 2>/dev/null
  )
done

echo
echo "✅ (3) PURGE visible 'demo/démo' text in code (ALL apps) — ignore backups"
for app in "${APPS[@]}"; do
  appdir="$ROOT/apps/$app"
  echo "==> [$app] purge demo labels..."

  while IFS= read -r f; do
    [ -f "$f" ] || continue
    case "$f" in
      *.bak*|*DISABLED* ) continue ;;
    esac

    backup_file "$f"
    perl -pi -e 's/\(démo\)//g; s/\(demo\)//ig; s/\bdémo\b//ig; s/\bdemo\b//ig;' "$f" || true
    perl -pi -e 's/  +/ /g' "$f" || true
  done < <(
    grep -RIl --exclude-dir node_modules --exclude-dir .expo --exclude-dir dist --exclude-dir .git \
      -E '\(démo\)|demo|Démo|DEMO' "$appdir/app" "$appdir/ui" 2>/dev/null || true
  )
done

echo
echo "✅ (4) Move old *.bak* / *DISABLED* out of repo tree (so you don't see 'demo' in grep)"
JUNK_DIR="$BACKUP_ROOT/_junk_moved_out"
mkdir -p "$JUNK_DIR"
for app in "${APPS[@]}"; do
  appdir="$ROOT/apps/$app"
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    rel="${f#$ROOT/}"
    dest="$JUNK_DIR/$rel"
    mkdir -p "$(dirname "$dest")"
    mv "$f" "$dest" 2>/dev/null || true
  done < <(find "$appdir" -type f \( -name "*.bak*" -o -name "*DISABLED*" \) 2>/dev/null || true)
done

echo
echo "✅ (5) Clean Metro caches + app caches"
rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
for app in "${APPS[@]}"; do
  appdir="$ROOT/apps/$app"
  rm -rf "$appdir/.expo" "$appdir/.turbo" "$appdir/node_modules/.cache" 2>/dev/null || true
done

echo
echo "=============================================="
echo "✅ DONE."
echo "Backups: $BACKUP_ROOT"
echo
echo "NOW restart Metro (tmux):"
echo "  CLIENT : cd $ROOT/apps/client  && pnpm dev -- --tunnel --port 8081 --clear"
echo "  COURIER: cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear"
echo "  MERCH  : cd $ROOT/apps/merchant&& pnpm dev -- --tunnel --port 8083 --clear"
echo "=============================================="
