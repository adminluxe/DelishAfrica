#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/parallax_fix_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/parallax_fix_$NOW.log"

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

log "🔪 Parallax killer fix"
log "Root=$ROOT"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

FOUND=0
while IFS= read -r f; do
  FOUND=1
  log "→ patch: $f"
  backup_file "$f"

  cat >"$f" <<'TS'
import React from "react";
import { ScrollView, View, StyleSheet, StyleProp, ViewStyle } from "react-native";

/**
 * SAFE VERSION (debug):
 * - Neutralise tout comportement parallax/gesture.
 * - Objectif: restaurer le scroll à 100%.
 * - Une fois OK, on pourra réintroduire le parallax proprement.
 */
export type ParallaxScrollViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  headerImage?: React.ReactNode;
  headerBackgroundColor?: { light: string; dark: string } | string;
};

export default function ParallaxScrollView({
  children,
  style,
  contentContainerStyle,
  headerImage,
}: ParallaxScrollViewProps) {
  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScrollBeginDrag={() => console.log("[SCROLLBEGIN] ParallaxScrollView")}
    >
      {headerImage ? (
        <View pointerEvents="none" style={styles.header}>
          {headerImage}
        </View>
      ) : null}

      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flexGrow: 1 },
  header: { width: "100%" },
  content: { flex: 1 },
});
TS

done < <(find "$ROOT/apps" -type f -name "parallax-scroll-view.tsx" 2>/dev/null || true)

if [[ "$FOUND" == "0" ]]; then
  log "⚠️ Aucun fichier parallax-scroll-view.tsx trouvé."
  log "Fais un grep: rg -n \"ParallaxScrollView|parallax-scroll-view\" $ROOT/apps"
else
  log "✅ Done."
fi

log "📄 Report: $REPORT"
log "🧯 Rollback: restore from $BACKUP_DIR (or git checkout -- .)"
