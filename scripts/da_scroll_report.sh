#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")

if [[ ! -d "$ROOT" ]]; then
  echo "❌ Repo introuvable: $ROOT"
  exit 1
fi

OUT="/tmp/da_scroll_report_$(date +%Y%m%d_%H%M%S).txt"
touch "$OUT"

echo "DelishAfrica — Scroll Report" | tee -a "$OUT"
echo "Root: $ROOT" | tee -a "$OUT"
echo "Date: $(date)" | tee -a "$OUT"
echo "==================================================" | tee -a "$OUT"

PATTERNS=(
  'pointerEvents'
  'position:\s*["'\'']absolute["'\'']|absoluteFill|absoluteFillObject|StyleSheet\.absoluteFillObject'
  '\bzIndex\b|\belevation\b'
  'Pressable|Touchable|TouchableOpacity|TouchableWithoutFeedback'
  'on(Start|Move)ShouldSetResponder|PanResponder|onTouch(Start|Move)|onResponder'
  'Modal|Portal|Overlay'
  'ScrollView|FlatList|SectionList'
  'scrollEnabled\s*=\s*{false}'
  'GestureHandlerRootView|react-native-gesture-handler'
  'BlurView|LinearGradient|Animated\.View'
)

for app in "${APPS[@]}"; do
  DIR="$ROOT/apps/$app"
  echo "" | tee -a "$OUT"
  echo "==================== APP: $app ====================" | tee -a "$OUT"

  if [[ ! -d "$DIR" ]]; then
    echo "⚠️ Dossier manquant: $DIR" | tee -a "$OUT"
    continue
  fi

  echo "📌 Layout candidates:" | tee -a "$OUT"
  for f in "$DIR/app/_layout.tsx" "$DIR/app/index.tsx" "$DIR/ui/ui.tsx"; do
    [[ -f "$f" ]] && echo "  - $f" | tee -a "$OUT"
  done

  echo "" | tee -a "$OUT"
  echo "🔎 Suspects (top hits):" | tee -a "$OUT"

  for p in "${PATTERNS[@]}"; do
    echo "" | tee -a "$OUT"
    echo "--- pattern: $p ---" | tee -a "$OUT"
    rg -n --hidden --glob '!.git/*' --glob '!**/node_modules/*' -S "$p" "$DIR" \
      | head -n 40 | tee -a "$OUT" || true
  done
done

echo "" | tee -a "$OUT"
echo "✅ Report saved to: $OUT" | tee -a "$OUT"
