#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/parallax_findpatch_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/parallax_findpatch_$NOW.log"

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

log "🔎 Find Parallax usage + patch all possible implementations"
log "Root=$ROOT"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

# 1) log imports/usage
if command -v rg >/dev/null 2>&1; then
  rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' \
    "ParallaxScrollView|parallax-scroll-view|parallaxScrollView" \
    "$ROOT/apps" | tee -a "$REPORT" || true
else
  grep -RIn --exclude-dir node_modules --exclude-dir .git \
    "ParallaxScrollView\|parallax-scroll-view\|parallaxScrollView" \
    "$ROOT/apps" | tee -a "$REPORT" || true
fi

# 2) patch any file that looks like it exports ParallaxScrollView
#    (name contains parallax OR file contains "ParallaxScrollView")
mapfile -t CANDIDATES < <(
  find "$ROOT/apps" -type f \( -name "*parallax*.ts" -o -name "*parallax*.tsx" \) 2>/dev/null
  if command -v rg >/dev/null 2>&1; then
    rg -l --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' "ParallaxScrollView" "$ROOT/apps" 2>/dev/null || true
  else
    grep -RIl --exclude-dir node_modules --exclude-dir .git "ParallaxScrollView" "$ROOT/apps" 2>/dev/null || true
  fi
)

# unique
CANDIDATES=($(printf "%s\n" "${CANDIDATES[@]}" | awk '!seen[$0]++'))

if [[ "${#CANDIDATES[@]}" -eq 0 ]]; then
  log "⚠️ Aucun candidat parallax trouvé. (Alors ce n'est pas ça.)"
  exit 0
fi

log "🧩 Candidats patchés (${#CANDIDATES[@]}):"
printf "  - %s\n" "${CANDIDATES[@]}" | tee -a "$REPORT"

for f in "${CANDIDATES[@]}"; do
  # patch only if file contains ParallaxScrollView OR name parallax
  backup_file "$f"

  cat >"$f" <<'TS'
import React, { useEffect } from "react";
import { ScrollView, View, StyleSheet, StyleProp, ViewStyle } from "react-native";

/**
 * PARALLAX DEBUG OVERRIDE (safe):
 * - remplace toute implémentation parallax/gesture par un ScrollView simple
 * - log au mount + log au scroll begin drag
 */
export type ParallaxScrollViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  headerImage?: React.ReactNode;
  headerBackgroundColor?: any;
};

export default function ParallaxScrollView(props: ParallaxScrollViewProps) {
  const { children, style, contentContainerStyle, headerImage } = props;

  useEffect(() => {
    console.log("[PARALLAX OVERRIDE] mounted ✅");
  }, []);

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScrollBeginDrag={() => console.log("[SCROLLBEGIN] ParallaxScrollView ✅")}
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

done

log "✅ Patch parallax override appliqué."
log "📄 Report: $REPORT"
log "🧯 Rollback: restore from $BACKUP_DIR (or git checkout -- .)"
