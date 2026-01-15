#!/usr/bin/env bash
#
# DelishAfrica Scroll Diagnostic (Gesture/Overlay/Responder scalpel)
# --------------------------------------------------------------
# READ-ONLY audit script to detect common causes of "scroll KO" in RN/Expo:
#   - Overlays that capture touches (absoluteFill / zIndex / modal-like views)
#   - pointerEvents misconfigurations
#   - GestureDetector / PanResponder / RNGH handlers wrapping screens
#   - Responder capture callbacks (onStartShouldSetResponderCapture, etc.)
#   - Scroll disabled (scrollEnabled={false})
#
# It generates a report under:
#   <root>/.tonton_backups/_reports/scroll_detector_<timestamp>.txt
#
# Usage:
#   ./da_scroll_gesture_detector.sh [ROOT_DIR]
# Examples:
#   /opt/delishafrica/monorepo/da_scroll_gesture_detector.sh /opt/delishafrica/monorepo
#   cd /opt/delishafrica/monorepo && ./da_scroll_gesture_detector.sh
#
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
APPS_DIR="$ROOT_DIR/apps"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
REPORT_DIR="$ROOT_DIR/.tonton_backups/_reports"
mkdir -p "$REPORT_DIR"
REPORT_FILE="$REPORT_DIR/scroll_detector_${TIMESTAMP}.txt"

# temp file to compute "top suspect files"
HITS_TMP="$(mktemp)"
trap 'rm -f "$HITS_TMP"' EXIT

log() {
  echo "$*" | tee -a "$REPORT_FILE"
}

hit() {
  # record file path as 1 hit
  printf "%s\n" "$1" >> "$HITS_TMP"
}

require_dir() {
  if [[ ! -d "$1" ]]; then
    echo "[DA] ERROR: directory not found: $1" >&2
    echo "[DA] Are you running from the monorepo root? Expected: $APPS_DIR" >&2
    exit 1
  fi
}

# Prefer ripgrep if available (faster + better output)
HAS_RG=0
if command -v rg >/dev/null 2>&1; then
  HAS_RG=1
fi

rg_search() {
  local pattern="$1"; shift
  local root="$1"; shift
  if [[ $HAS_RG -eq 1 ]]; then
    # --no-heading ensures file:line:match format
    rg --no-heading --line-number --hidden \
      --glob '!**/node_modules/**' \
      --glob '!**/.git/**' \
      --glob '!**/.expo/**' \
      --glob '!**/.expo-shared/**' \
      --glob '!**/.tonton_backups/**' \
      --glob '!**/.backups/**' \
      --glob '!**/dist/**' \
      --glob '!**/build/**' \
      -g'*.js' -g'*.jsx' -g'*.ts' -g'*.tsx' \
      -e "$pattern" "$root" 2>/dev/null || true
  else
    # grep fallback
    grep -RIn \
      --exclude-dir=node_modules \
      --exclude-dir=.git \
      --exclude-dir=.expo \
      --exclude-dir=.expo-shared \
      --exclude-dir=.tonton_backups \
      --exclude-dir=.backups \
      --exclude-dir=dist \
      --exclude-dir=build \
      --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' \
      -E "$pattern" "$root" 2>/dev/null || true
  fi
}

# Extract a small snippet around a line number to detect multi-line props
snippet_around() {
  local file="$1"; local line="$2"; local span="${3:-6}"
  if [[ -z "$line" ]]; then
    return 0
  fi
  local start=$(( line ))
  local end=$(( line + span ))
  sed -n "${start},${end}p" "$file" 2>/dev/null || true
}

header() {
  log ""
  log "============================================================"
  log "$1"
  log "============================================================"
}

log "[DA] DelishAfrica Scroll Diagnostic"
log "[DA] Root directory: $ROOT_DIR"
log "[DA] Apps directory: $APPS_DIR"
log "[DA] Report: $REPORT_FILE"
log "[DA] Engine: $([[ $HAS_RG -eq 1 ]] && echo rg || echo grep)"
log ""

require_dir "$APPS_DIR"

# 1) Overlay components likely to sit above scrollables
scan_overlays_missing_pointerevents() {
  header "[1] OVERLAYS: components that often block touches if absolute / no pointerEvents"
  log "[DA] Looking for: BlurView / LinearGradient / ImageBackground / Svg / Skia / Lottie / Canvas…"

  local overlay_regex="<(BlurView|LinearGradient|ImageBackground|Svg|SvgXml|LottieView|Canvas|Skia|SkiaView)\\b"
  while IFS=: read -r file line match; do
    [[ -z "$file" ]] && continue

    # Check around the tag line for pointerEvents prop
    local snip
    snip="$(snippet_around "$file" "$line" 10)"

    # ✅ FIX: escape the double-quote inside the charclass ['\"]
    if ! printf "%s\n" "$snip" | grep -qE "pointerEvents\s*=\s*['\"]"; then
      log "[OVERLAY:no-pointerEvents] $file:$line -> $match"
      hit "$file"
    fi
  done < <(rg_search "$overlay_regex" "$APPS_DIR")
}

# 2) pointerEvents values that are suspicious
scan_pointerevents_values() {
  header "[2] POINTER EVENTS: suspicious values"
  log "[DA] Looking for pointerEvents values that can block scroll (auto / box-only / unspecified on overlays)."

  while IFS=: read -r file line match; do
    [[ -z "$file" ]] && continue

    local value
    value="$(printf "%s" "$match" | sed -nE "s/.*pointerEvents\s*=\s*['\"]([^'\"]+)['\"].*/\1/p")"

    # "none" and "box-none" are usually safe for overlays.
    # "auto" (default) or "box-only" can intercept.
    if [[ -n "$value" && "$value" != "none" && "$value" != "box-none" ]]; then
      log "[POINTER_EVENTS:$value] $file:$line -> $match"
      hit "$file"
    fi
  done < <(rg_search "pointerEvents\\s*=\\s*['\"][^'\"]+['\"]" "$APPS_DIR")
}

# 3) Gesture handlers / responders
scan_gesture_handlers() {
  header "[3] GESTURE HANDLERS: GestureDetector / PanResponder / RNGH"
  log "[DA] Looking for gesture wrappers that can capture vertical scroll gestures."

  local gesture_regex="PanResponder\\.create|<GestureDetector\\b|\\bGestureDetector\\b|useAnimatedGestureHandler|TapGestureHandler|PanGestureHandler|LongPressGestureHandler|FlingGestureHandler|GestureHandlerRootView"

  while IFS=: read -r file line match; do
    [[ -z "$file" ]] && continue
    log "[GESTURE] $file:$line -> $match"
    hit "$file"
  done < <(rg_search "$gesture_regex" "$APPS_DIR")
}

# 4) Responder capture (often the *killer* for scroll)
scan_responder_capture() {
  header "[4] RESPONDER CAPTURE: on*ShouldSetResponder(Capture)"
  log "[DA] These can *steal* touches from ScrollView/FlatList if they return true."

  local resp_regex="on(Start|Move)ShouldSetResponder(Capture)?\\s*=|onResponder(Grant|Move|Start|Release|Terminate)\\s*=|onTouchStart\\s*=|onTouchMove\\s*="

  while IFS=: read -r file line match; do
    [[ -z "$file" ]] && continue
    log "[RESPONDER] $file:$line -> $match"
    hit "$file"
  done < <(rg_search "$resp_regex" "$APPS_DIR")
}

# 5) Scroll disabled explicitly
scan_scroll_disabled() {
  header "[5] SCROLL DISABLED: scrollEnabled={false}"
  log "[DA] Looking for ScrollView/FlatList/SectionList with scrollEnabled={false}."

  local disabled_regex="scrollEnabled\\s*=\\s*\{\\s*false\\s*\}"

  while IFS=: read -r file line match; do
    [[ -z "$file" ]] && continue
    log "[SCROLL_DISABLED] $file:$line -> $match"
    hit "$file"
  done < <(rg_search "$disabled_regex" "$APPS_DIR")
}

# 6) Fullscreen pressables / touchables (absolute overlays)
scan_fullscreen_touchables() {
  header "[6] FULLSCREEN TOUCHABLES: Pressable/Touchable with absoluteFill / position:absolute"
  log "[DA] Looking for Pressable/Touchable wrappers likely to cover the screen."

  local touchable_regex="<(Pressable|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight)\\b"
  local style_clue_regex="absoluteFill(Object)?|StyleSheet\\.absoluteFill|position\\s*:\\s*['\"]absolute['\"]|zIndex\\s*:\\s*[0-9]+|top\\s*:\\s*0|bottom\\s*:\\s*0|left\\s*:\\s*0|right\\s*:\\s*0"

  while IFS=: read -r file line match; do
    [[ -z "$file" ]] && continue

    if rg_search "$touchable_regex" "$file" >/dev/null 2>&1; then
      if rg_search "$style_clue_regex" "$file" >/dev/null 2>&1; then
        log "[TOUCHABLE_OVERLAY] $file:$line -> $match"
        hit "$file"
      fi
    fi
  done < <(rg_search "$touchable_regex" "$APPS_DIR")
}

# 7) Candidate wrappers (Screen/Layout/Provider) that may wrap everything
scan_wrapper_candidates() {
  header "[7] WRAPPERS: Screen/Layout/Provider likely shared across many screens"
  log "[DA] Looking for wrappers containing GestureDetector/PanResponder/ResponderCapture or absolute overlays."

  local candidates
  candidates=$(find "$APPS_DIR" -type f \( -iname '*Screen*.ts*' -o -iname '*Layout*.ts*' -o -iname '*Provider*.ts*' \) \
    ! -path '*/node_modules/*' ! -path '*/.tonton_backups/*' ! -path '*/.backups/*' 2>/dev/null || true)

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    if rg_search "<GestureDetector\\b|PanResponder\\.create|on(Start|Move)ShouldSetResponder(Capture)?|pointerEvents\\s*=|absoluteFill|StyleSheet\\.absoluteFill|position\\s*:\\s*['\"]absolute['\"]" "$file" >/dev/null 2>&1; then
      log "[WRAPPER_CANDIDATE] $file"
      rg_search "<GestureDetector\\b|PanResponder\\.create|on(Start|Move)ShouldSetResponder(Capture)?|pointerEvents\\s*=|absoluteFill|StyleSheet\\.absoluteFill|position\\s*:\\s*['\"]absolute['\"]" "$file" \
        | head -n 40 | sed 's/^/  /' | tee -a "$REPORT_FILE" >/dev/null
      log ""
      hit "$file"
    fi
  done <<< "$candidates"
}

# Run scans
scan_overlays_missing_pointerevents
scan_pointerevents_values
scan_gesture_handlers
scan_responder_capture
scan_scroll_disabled
scan_fullscreen_touchables
scan_wrapper_candidates

# Top suspects
header "[SUMMARY] TOP SUSPECT FILES (by number of hits)"
if [[ -s "$HITS_TMP" ]]; then
  sort "$HITS_TMP" | uniq -c | sort -nr | head -n 30 | tee -a "$REPORT_FILE"
else
  log "(no hits recorded)"
fi

log ""
log "[DA] Done. Review report: $REPORT_FILE"
log "[DA] Next: paste me the TOP 10 lines from the SUMMARY section + the first WRAPPER_CANDIDATE block."
