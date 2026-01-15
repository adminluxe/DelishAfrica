#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/bypass_parallax_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/bypass_parallax_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

log "🏁 FINISHER: Bypass ParallaxScrollView -> ScrollView vanilla"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

TARGETS=(
  "$ROOT/apps/client"
  "$ROOT/apps/merchant"
  "$ROOT/apps/courier"
)

FILES=()
for A in "${TARGETS[@]}"; do
  [[ -d "$A" ]] || continue
  while IFS= read -r f; do FILES+=("$f"); done < <(
    find "$A" -type f \( \
      -iname "*parallax*scroll*.tsx" -o -iname "*parallax*scroll*.ts" -o \
      -iname "*ParallaxScrollView*.tsx" -o -iname "*ParallaxScrollView*.ts" \
    \) 2>/dev/null || true
  )
done

# Deduplicate
mapfile -t FILES < <(printf "%s\n" "${FILES[@]}" | awk 'NF && !seen[$0]++')

log "📄 Parallax candidates: ${#FILES[@]}"
printf "%s\n" "${FILES[@]}" | tee -a "$REPORT" || true

if [[ "${#FILES[@]}" -eq 0 ]]; then
  log "⚠️ Aucun fichier parallax trouvé. On stop ici."
  exit 0
fi

# Content that will replace each parallax component file (safe, supports default + named export)
read -r -d '' NEW_CONTENT <<'TSX'
/**
 * TONTON FINISHER — BYPASS PARALLAX
 * Objectif: confirmer que le scroll KO vient de ParallaxScrollView / wrappers (pointerEvents, overlays, responders).
 * Ce composant ignore les props "parallax" et rend un ScrollView vanilla.
 */

import React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type ParallaxScrollViewProps = Omit<ScrollViewProps, "contentContainerStyle"> & {
  headerImage?: React.ReactNode;
  headerBackgroundColor?: { dark: string; light: string } | string;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function ParallaxScrollView(props: ParallaxScrollViewProps) {
  const {
    children,
    style,
    contentContainerStyle,
    // props parallax ignorées volontairement (debug)
    headerImage,
    headerBackgroundColor,
    ...rest
  } = props;

  return (
    <ScrollView
      {...rest}
      style={[styles.container, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      {/* box-none pour ne jamais bloquer les gestes des enfants */}
      <View pointerEvents="box-none">{children}</View>
    </ScrollView>
  );
}

export default ParallaxScrollView;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
});
TSX

CHANGED=0
for f in "${FILES[@]}"; do
  backup_file "$f"
  printf "%s\n" "$NEW_CONTENT" > "$f"
  CHANGED=$((CHANGED+1))
done

log "✅ Replaced parallax files: $CHANGED"
log "🧯 Rollback (1-liner): rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""
