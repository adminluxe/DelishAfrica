#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
SESSION="delishafrica"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/kill_scroll_$NOW"
mkdir -p "$BK"

log(){ echo -e "\n[$(date +%H:%M:%S')] $*"; }

# 1) patch ParallaxScrollView files (overwrite with safe implementation)
log "🔎 Searching ParallaxScrollView files..."
mapfile -t FILES < <(
  find "$ROOT/apps" -type f \( -iname 'parallax-scroll-view.tsx' -o -iname 'ParallaxScrollView.tsx' \) 2>/dev/null || true
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  log "⚠️ No ParallaxScrollView files found under apps/* (skip overwrite)"
else
  log "✅ Found ${#FILES[@]} file(s). Backing up + overwriting with SAFE ScrollView."
  for f in "${FILES[@]}"; do
    rel="${f#$ROOT/}"
    mkdir -p "$BK/$(dirname "$rel")"
    cp -a "$f" "$BK/$rel"

    cat > "$f" <<'TSX'
import React from "react";
import {
  ScrollView,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";

export type ParallaxScrollViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  headerImage?: React.ReactNode;
  headerBackgroundColor?: any;
};

export default function ParallaxScrollView(props: ParallaxScrollViewProps) {
  const { children, style, contentContainerStyle, headerImage, headerBackgroundColor } = props;

  // best-effort background color (if provided)
  const bg =
    typeof headerBackgroundColor === "string"
      ? headerBackgroundColor
      : undefined;

  return (
    <ScrollView
      style={[styles.container, style]}
      contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      scrollEventThrottle={16}
      onScrollBeginDrag={() => console.log("[SCROLLBEGIN] ParallaxScrollView ✅")}
      onTouchStart={() => console.log("[TOUCH] start ✅")}
    >
      {headerImage ? (
        <View pointerEvents="none" style={[styles.header, bg ? { backgroundColor: bg } : null]}>
          {headerImage}
        </View>
      ) : null}

      {/* IMPORTANT: no inner wrapper with flex:1 here -> keeps content height natural */}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingBottom: 24 },
  header: { width: "100%" },
});
TSX
    log "🩺 Patched: $rel"
  done
fi

# 2) Replace classic killer: contentContainerStyle={{ flex: 1 }} -> flexGrow: 1 (safe)
log "🧽 Replacing 'contentContainerStyle={{ flex: 1 }}' -> 'flexGrow: 1' (safe sweep)"
perl -pi -e 's/contentContainerStyle=\{\{\s*flex\s*:\s*1\s*\}\}/contentContainerStyle={{ flexGrow: 1 }}/g' \
  $(find "$ROOT/apps" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null) || true

log "✅ Backups stored in: $BK"

# 3) Restart metros in tmux (windows 5/6/7)
restart_metro(){
  local win="$1" dir="$2" port="$3"
  tmux send-keys -t "$SESSION:$win" C-c 2>/dev/null || true
  tmux send-keys -t "$SESSION:$win" "cd '$dir'; unset CI GITHUB_ACTIONS JENKINS_URL BUILD_NUMBER; export CI=false; export EXPO_NO_TELEMETRY=1; npx expo start --dev-client --tunnel --port $port --clear" C-m
}

if tmux has-session -t "$SESSION" 2>/dev/null; then
  log "🔁 Restarting metros (tmux session $SESSION)"
  restart_metro 5 "$ROOT/apps/client" 8081
  restart_metro 6 "$ROOT/apps/merchant" 8083
  restart_metro 7 "$ROOT/apps/courier" 8082
  log "✅ Metros restarted. Scan QR again, then test scroll."
else
  log "⚠️ tmux session '$SESSION' not found -> metros not restarted automatically."
fi

log "DONE ✅"
