#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
APPS="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/fix_rngh_root_${TS}"
LOG="$BACKUP/patch.log"
mkdir -p "$BACKUP"

backup_file() {
  local f="$1"
  local rel="${f#/}"
  local dst="$BACKUP/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

patch_layout() {
  local f="$1"

  # Skip if already wrapped
  if grep -q "GestureHandlerRootView" "$f"; then
    echo "[SKIP] already has GestureHandlerRootView: $f" | tee -a "$LOG"
    return 0
  fi

  # Must contain Stack or Tabs to patch (Expo Router common)
  if ! grep -Eq "<(Stack|Tabs)\b" "$f"; then
    echo "[SKIP] no <Stack/> or <Tabs/> found: $f" | tee -a "$LOG"
    return 0
  fi

  backup_file "$f"

  # Add import if missing
  if ! grep -q "from 'react-native-gesture-handler'" "$f"; then
    # insert after first import line (common safe position)
    perl -pi -e 'if($.==1){$first=1} if($first && /^import /){print "import { GestureHandlerRootView } from '\''react-native-gesture-handler'\'';\n"; $first=0}' "$f"
    # if file had no imports, prepend
    if ! grep -q "GestureHandlerRootView" "$f"; then
      sed -i "1i import { GestureHandlerRootView } from 'react-native-gesture-handler';" "$f"
    fi
  fi

  # Wrap return for common simple cases:
  # Case 1: return <Stack ... />;
  perl -0777 -pi -e '
    s/return\s*<Stack\b([^;]*?)\/>;\s*/return (<GestureHandlerRootView style={{ flex: 1 }}><Stack$1\/><\/GestureHandlerRootView>);\n/s;
    s/return\s*<Tabs\b([^;]*?)\/>;\s*/return (<GestureHandlerRootView style={{ flex: 1 }}><Tabs$1\/><\/GestureHandlerRootView>);\n/s;
  ' "$f"

  # Case 2: return ( ... <Stack/> ... );
  if ! grep -q "GestureHandlerRootView style" "$f"; then
    perl -0777 -pi -e '
      if ($s = $_) {
        $s =~ s/return\s*\(\s*/return (\n    <GestureHandlerRootView style={{ flex: 1 }}>\n/s;
        $s =~ s/\n\);\s*$/\n    <\/GestureHandlerRootView>\n);\n/s;
        $_ = $s;
      }
    ' "$f"
  fi

  echo "[PATCHED] $f" | tee -a "$LOG"
}

echo "[DA] BACKUP: $BACKUP" | tee -a "$LOG"

while IFS= read -r f; do
  patch_layout "$f"
done < <(
  find "$APPS" -type f -name "_layout.tsx" \
    ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.expo/*" \
    ! -path "*/.tonton_backups/*" ! -path "*/.backups/*" ! -path "*/.backup/*" \
    2>/dev/null
)

echo ""
echo "[DA] Done. Backup: $BACKUP" | tee -a "$LOG"
echo "[DA] Rollback:" | tee -a "$LOG"
echo "  rsync -a \"$BACKUP/opt/delishafrica/monorepo/\" \"/opt/delishafrica/monorepo/\"" | tee -a "$LOG"
