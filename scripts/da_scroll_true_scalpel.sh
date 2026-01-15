#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/true_scalpel_$TS"
APPS=(client courier merchant)

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }

mkdir -p "$BK"

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

set_env_flags() {
  local app="$1"
  local envfile="$ROOT/apps/$app/.env.local"
  mkdir -p "$(dirname "$envfile")"
  touch "$envfile"
  backup_file "$envfile"

  # BG OFF + DIAG ON (force overflow)
  grep -q '^EXPO_PUBLIC_BG_OFF=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_BG_OFF=.*/EXPO_PUBLIC_BG_OFF=1/' "$envfile" \
    || echo "EXPO_PUBLIC_BG_OFF=1" >> "$envfile"

  grep -q '^EXPO_PUBLIC_SCROLL_DIAG=' "$envfile" \
    && sed -i 's/^EXPO_PUBLIC_SCROLL_DIAG=.*/EXPO_PUBLIC_SCROLL_DIAG=1/' "$envfile" \
    || echo "EXPO_PUBLIC_SCROLL_DIAG=1" >> "$envfile"

  log "$app: .env.local => BG_OFF=1 + SCROLL_DIAG=1"
}

write_parallax_gold() {
  local app="$1"
  local f="$ROOT/apps/$app/components/parallax-scroll-view.tsx"
  [[ -d "$(dirname "$f")" ]] || { warn "$app: components/ absent"; return 0; }

  backup_file "$f"
  log "$app: overwrite ParallaxScrollView GOLD -> $f"

  cat > "$f" <<'TSX'
import React, { PropsWithChildren, ReactElement, useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from "react-native-reanimated";

type HeaderBg = { light: string; dark: string };

export type ParallaxScrollViewProps = PropsWithChildren<{
  headerImage?: ReactElement;
  headerBackgroundColor?: HeaderBg;
  headerHeight?: number;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
}> &
  Omit<React.ComponentProps<typeof Animated.ScrollView>, "contentContainerStyle">;

const DEFAULT_HEADER_HEIGHT = 240;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  contentContainerStyle,
  style,
  ...scrollProps
}: ParallaxScrollViewProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const y = scrollOffset.value;
    return {
      transform: [
        {
          translateY: interpolate(
            y,
            [-headerHeight, 0, headerHeight],
            [-headerHeight / 2, 0, headerHeight * 0.75],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(y, [-headerHeight, 0], [1.35, 1], Extrapolation.CLAMP),
        },
      ],
    };
  }, [headerHeight]);

  const bg = useMemo(() => {
    if (!headerBackgroundColor) return "transparent";
    return headerBackgroundColor.dark ?? headerBackgroundColor.light ?? "transparent";
  }, [headerBackgroundColor]);

  const DIAG = process.env.EXPO_PUBLIC_SCROLL_DIAG === "1";

  return (
    <View style={[styles.container, style]}>
      <Animated.ScrollView
        ref={scrollRef}
        scrollEnabled={true}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {!!headerImage && (
          <Animated.View
            pointerEvents="none"
            style={[styles.header, { height: headerHeight, backgroundColor: bg }, headerAnimatedStyle]}
          >
            {headerImage}
          </Animated.View>
        )}

        <View style={[styles.content, contentContainerStyle]}>
          {children}

          {DIAG && <View style={styles.diagSpacer} />}
          {DIAG &&
            Array.from({ length: 40 }).map((_, i) => (
              <View key={`diag-${i}`} style={styles.diagRow} />
            ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { width: "100%", overflow: "hidden" },
  content: { flexGrow: 1, padding: 16, gap: 12 },
  diagSpacer: { height: 24 },
  diagRow: { height: 28, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" },
});
TSX
}

patch_absolute_fullscreen_pointerevents() {
  local app="$1"
  local base="$ROOT/apps/$app"
  [[ -d "$base" ]] || return 0

  log "$app: patch pointerEvents on absolute fullscreen overlays (View/Animated.View/Pressable/Touchables)"

  # cible répertoires où sont les UI
  local dirs=("$base/app" "$base/components" "$base/ui" "$base/src")
  local files=()
  for d in "${dirs[@]}"; do
    [[ -d "$d" ]] || continue
    while IFS= read -r f; do files+=("$f"); done < <(find "$d" -type f -name "*.tsx" 2>/dev/null)
  done

  for f in "${files[@]}"; do
    backup_file "$f"

    # 1) StyleSheet.absoluteFill* => pointerEvents none si absent
    perl -0777 -i -pe '
      s/<(View|Animated\.View|Pressable|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight)
        (?![^>]*\bpointerEvents=)
        ([^>]*\bStyleSheet\.(?:absoluteFill|absoluteFillObject)\b[^>]*?)
      >/<$1 pointerEvents="none"$2>/gxms;

      # 2) inline absolute fullscreen (order-agnostic via lookaheads)
      s/<(View|Animated\.View|Pressable|TouchableOpacity|TouchableWithoutFeedback|TouchableHighlight)
        (?![^>]*\bpointerEvents=)
        (?=[^>]*position:\s*["'\'']absolute["'\''])
        (?=[^>]*\btop:\s*0)
        (?=[^>]*\bleft:\s*0)
        (?=[^>]*\bright:\s*0)
        (?=[^>]*\bbottom:\s*0)
      /<$1 pointerEvents="none"/gxms;
    ' "$f"
  done
}

kill_ports() {
  # Ports expo/metro/tunnel
  local ports=(8081 8082 8083 19000 19001 19002 19006 19007 4040 4049)
  for p in "${ports[@]}"; do
    if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      log "Kill port $p"
      lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
    fi
  done
  pkill -f "expo start" || true
  pkill -f "metro" || true
  pkill -f "ngrok" || true
  pkill -f "@expo/ngrok" || true
}

log "ROOT: $ROOT"
log "BACKUP: $BK"

kill_ports

for app in "${APPS[@]}"; do
  [[ -d "$ROOT/apps/$app" ]] || { warn "App absente: $app"; continue; }
  set_env_flags "$app"
  write_parallax_gold "$app"
  patch_absolute_fullscreen_pointerevents "$app"
done

log "✅ True scalpel applied."
log "👉 Maintenant relance Expo avec --clear (important, env + cache):"

cat <<EOF

# CLIENT
cd $ROOT/apps/client  && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

Backups: $BK
EOF
