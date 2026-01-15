#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/opt/delishafrica/monorepo}"
REPORT="${2:-}"

REPORT_DIR="$ROOT/.tonton_backups/_reports"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/gesture_off_${TS}"
PATCH_LOG="$BACKUP_DIR/patch_log.txt"

mkdir -p "$BACKUP_DIR"

pick_latest_report() {
  ls -1t "$REPORT_DIR"/scroll_detector_*.txt 2>/dev/null | head -n 1 || true
}

if [[ -z "${REPORT}" ]]; then
  REPORT="$(pick_latest_report)"
fi

if [[ -z "${REPORT}" || ! -f "${REPORT}" ]]; then
  echo "[DA] ERROR: report not found. Provide it explicitly:"
  echo "      $0 /opt/delishafrica/monorepo /opt/delishafrica/monorepo/.tonton_backups/_reports/scroll_detector_xxx.txt"
  exit 1
fi

echo "[DA] ROOT   : $ROOT" | tee -a "$PATCH_LOG"
echo "[DA] REPORT : $REPORT" | tee -a "$PATCH_LOG"
echo "[DA] BACKUP : $BACKUP_DIR" | tee -a "$PATCH_LOG"
echo "" | tee -a "$PATCH_LOG"

# Extract targets:
# - [WRAPPER_CANDIDATE] /path
# - SUMMARY lines: " 4 /path"
targets="$(
  awk '
    /^\[WRAPPER_CANDIDATE\]/ {print $2}
    /^[[:space:]]*[0-9]+[[:space:]]+\/opt\/delishafrica\/monorepo\// {print $2}
  ' "$REPORT" \
  | grep -vE '/\.backup/|/node_modules/|/dist/|/build/|/\.tonton_backups/' \
  | sort -u
)"

if [[ -z "$targets" ]]; then
  echo "[DA] No targets extracted from report (unexpected)." | tee -a "$PATCH_LOG"
  exit 0
fi

echo "[DA] Targets to patch:" | tee -a "$PATCH_LOG"
echo "$targets" | sed 's/^/  - /' | tee -a "$PATCH_LOG"
echo "" | tee -a "$PATCH_LOG"

backup_file() {
  local f="$1"
  local rel="${f#/}"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

patch_file() {
  local f="$1"

  # Skip if missing
  [[ -f "$f" ]] || return 0

  # Make backup
  backup_file "$f"

  # --- PATCH 1: Neutralize GestureDetector + old handlers by replacing them with Fragment
  # (No React import needed with <> </> fragments)
  perl -0777 -pi -e '
    s/<(GestureDetector|PanGestureHandler|TapGestureHandler|LongPressGestureHandler|FlingGestureHandler|NativeViewGestureHandler)\b[^>]*>/<>/sg;
    s#</(GestureDetector|PanGestureHandler|TapGestureHandler|LongPressGestureHandler|FlingGestureHandler|NativeViewGestureHandler)>#</>#sg;
  ' "$f"

  # --- PATCH 2: Remove spread panHandlers on Views (common PanResponder pattern)
  perl -0777 -pi -e '
    s/\{\s*\.{3}\s*[A-Za-z0-9_]+\s*\.panHandlers\s*\}//sg;
  ' "$f"

  # --- PATCH 3 (safe, line-based): force responder capture to false when inline
  perl -pi -e '
    s/onStartShouldSetResponderCapture\s*=\s*\{[^}]*\}/onStartShouldSetResponderCapture={() => false}/g;
    s/onMoveShouldSetResponderCapture\s*=\s*\{[^}]*\}/onMoveShouldSetResponderCapture={() => false}/g;
    s/onStartShouldSetResponder\s*=\s*\{[^}]*\}/onStartShouldSetResponder={() => false}/g;
    s/onMoveShouldSetResponder\s*=\s*\{[^}]*\}/onMoveShouldSetResponder={() => false}/g;
  ' "$f"

  echo "[PATCHED] $f" | tee -a "$PATCH_LOG"
}

count=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ -f "$f" ]]; then
    patch_file "$f"
    count=$((count+1))
  fi
done <<< "$targets"

echo "" | tee -a "$PATCH_LOG"
echo "[DA] Done. Patched files: $count" | tee -a "$PATCH_LOG"
echo "[DA] Patch log: $PATCH_LOG" | tee -a "$PATCH_LOG"
echo "[DA] Backup dir: $BACKUP_DIR" | tee -a "$PATCH_LOG"
echo "" | tee -a "$PATCH_LOG"
echo "[DA] NEXT:" | tee -a "$PATCH_LOG"
echo "  1) Ctrl+C metros" | tee -a "$PATCH_LOG"
echo "  2) restart expo with --clear" | tee -a "$PATCH_LOG"
echo "  3) swipe-close apps + rescan QR" | tee -a "$PATCH_LOG"
