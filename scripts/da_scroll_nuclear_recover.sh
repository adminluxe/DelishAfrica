#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/opt/delishafrica/monorepo}"
APPS="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/scroll_nuclear_${TS}"
REPORT="$BACKUP/report.txt"
LOG="$BACKUP/patch.log"
PERL_PATCH="$BACKUP/patch_scroll.pl"

mkdir -p "$BACKUP"

echo "[DA] ROOT   : $ROOT" | tee -a "$LOG"
echo "[DA] APPS   : $APPS" | tee -a "$LOG"
echo "[DA] BACKUP : $BACKUP" | tee -a "$LOG"
echo "[DA] REPORT : $REPORT" | tee -a "$LOG"
echo "" | tee -a "$LOG"

if [[ ! -d "$APPS" ]]; then
  echo "[DA] ERROR: apps dir not found: $APPS" | tee -a "$LOG"
  exit 1
fi

backup_file() {
  local f="$1"
  local rel="${f#/}"          # remove leading /
  local dst="$BACKUP/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

# ✅ Robust: literal string search only (no regex / no quotes pitfalls)
should_touch() {
  local f="$1"
  grep -Fq \
    -e "GestureDetector" \
    -e "PanGestureHandler" \
    -e "TapGestureHandler" \
    -e "LongPressGestureHandler" \
    -e "FlingGestureHandler" \
    -e "NativeViewGestureHandler" \
    -e "PanResponder.create" \
    -e ".panHandlers" \
    -e "onStartShouldSetResponder" \
    -e "onMoveShouldSetResponder" \
    -e "onStartShouldSetResponderCapture" \
    -e "onMoveShouldSetResponderCapture" \
    -e "onResponderGrant" \
    -e "onResponderMove" \
    -e "onTouchStart" \
    -e "onTouchMove" \
    -e "scrollEnabled={false}" \
    -e "StyleSheet.absoluteFill" \
    -e "absoluteFill" \
    -e "position: 'absolute'" \
    -e 'position: "absolute"' \
    -e "zIndex" \
    "$f" 2>/dev/null
}

# Perl patch stored as a file to avoid shell quoting issues
cat > "$PERL_PATCH" <<'PERL'
use strict;
use warnings;

# Entire-file editing: expected to be used with -0777
my $s = $_;

# 1) Force scrollEnabled={false} => true
$s =~ s/scrollEnabled\s*=\s*\{\s*false\s*\}/scrollEnabled={true}/g;

# 2) Neutralize responder capture (major scroll killer)
# Conservative patterns: replace simple {...} blocks
$s =~ s/onStartShouldSetResponderCapture\s*=\s*\{[^}]*\}/onStartShouldSetResponderCapture={() => false}/g;
$s =~ s/onMoveShouldSetResponderCapture\s*=\s*\{[^}]*\}/onMoveShouldSetResponderCapture={() => false}/g;
$s =~ s/onStartShouldSetResponder\s*=\s*\{[^}]*\}/onStartShouldSetResponder={() => false}/g;
$s =~ s/onMoveShouldSetResponder\s*=\s*\{[^}]*\}/onMoveShouldSetResponder={() => false}/g;

# 3) Neutralize RNGH wrapper tags => Fragment
$s =~ s/<(GestureDetector|PanGestureHandler|TapGestureHandler|LongPressGestureHandler|FlingGestureHandler|NativeViewGestureHandler)\b[^>]*>/<>/sg;
$s =~ s#</(GestureDetector|PanGestureHandler|TapGestureHandler|LongPressGestureHandler|FlingGestureHandler|NativeViewGestureHandler)>#</>#sg;

# 4) Remove PanResponder spread handlers: {...X.panHandlers}
$s =~ s/\{\s*\.{3}\s*[\w.]+\s*\.panHandlers\s*\}//sg;

# 5) TouchSafe for known overlay components (if missing pointerEvents)
# For backgrounds/overlays: "none" is safest (doesn't capture)
$s =~ s/<(BlurView|LinearGradient|ImageBackground|Svg|SvgXml|LottieView|Canvas|SkiaView)\b(?![^>]*\bpointerEvents\s*=)([^>]*)>/<${1} pointerEvents="none"${2}>/sg;

# 6) TouchSafe for generic absolute overlays (View/Animated.View/Pressable/Touchables)
# Add pointerEvents="box-none" when style hints absolute overlay and pointerEvents absent.
$s =~ s{
  <(View|Animated\.View|Pressable|SafeAreaView|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight)
  \b
  (?![^>]*\bpointerEvents\s*=)
  ([^>]*\bstyle\s*=\s*\{[^>]*?(?:StyleSheet\.absoluteFill|absoluteFillObject|absoluteFill|position\s*:\s*['"]absolute['"]|zIndex\s*:)[^>]*?\}[^>]*)
  >
}{
  "<$1 pointerEvents=\"box-none\"$2>"
}xsg;

$_ = $s;
PERL

patched=0
scanned=0

# Enumerate files
while IFS= read -r f; do
  scanned=$((scanned+1))

  if ! should_touch "$f"; then
    continue
  fi

  orig_sha="$(sha1sum "$f" | awk '{print $1}')"

  # Apply patch in memory then overwrite only if changed
  tmp="$(mktemp)"
  perl -0777 -pe 'do shift' "$PERL_PATCH" "$f" > "$tmp" || { rm -f "$tmp"; exit 1; }

  new_sha="$(sha1sum "$tmp" | awk '{print $1}')"

  if [[ "$orig_sha" != "$new_sha" ]]; then
    backup_file "$f"
    cat "$tmp" > "$f"
    patched=$((patched+1))
    echo "[PATCHED] $f" | tee -a "$LOG"
  fi

  rm -f "$tmp"
done < <(
  find "$APPS" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/.expo/*" \
    ! -path "*/.expo-shared/*" \
    ! -path "*/.tonton_backups/*" \
    ! -path "*/.backups/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/.backup/*" \
    2>/dev/null
)

{
  echo "============================================================"
  echo "[SUMMARY] Nuclear scroll recover"
  echo "Scanned files : $scanned"
  echo "Patched files : $patched"
  echo "Backup dir    : $BACKUP"
  echo "Patch log     : $LOG"
  echo "============================================================"
} | tee -a "$REPORT" | tee -a "$LOG"

echo ""
echo "[DA] NEXT STEPS (IMPORTANT):" | tee -a "$LOG"
echo "  1) Ctrl+C dans les 3 metros" | tee -a "$LOG"
echo "  2) relance Expo avec --clear (3 apps)" | tee -a "$LOG"
echo "  3) iPhone: swipe-close complet + re-scan QR" | tee -a "$LOG"
echo "  4) reteste scroll Merchant -> Poste cuisine" | tee -a "$LOG"
echo ""
echo "[DA] ROLLBACK (si besoin) :" | tee -a "$LOG"
echo "  rsync -a \"$BACKUP/opt/delishafrica/monorepo/\" \"/opt/delishafrica/monorepo/\"" | tee -a "$LOG"
