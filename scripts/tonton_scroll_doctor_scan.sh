#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$ROOT/.tonton_reports"
OUT="$OUT_DIR/scroll_doctor_$TS.log"
mkdir -p "$OUT_DIR"

need(){ command -v "$1" >/dev/null 2>&1; }

echo "=== DelishAfrica Scroll Doctor Scan ===" | tee "$OUT"
echo "ROOT=$ROOT" | tee -a "$OUT"
echo "DATE=$(date)" | tee -a "$OUT"
echo | tee -a "$OUT"

if ! need rg; then
  echo "❌ ripgrep (rg) introuvable. Installe-le (apt-get install -y ripgrep) puis relance." | tee -a "$OUT"
  exit 1
fi

scan(){
  local title="$1" pattern="$2"
  echo "----- $title -----" | tee -a "$OUT"
  rg -n --hidden --no-ignore-vcs "$pattern" "$ROOT/apps" \
    | sed 's#^#/opt/delishafrica/monorepo/apps/#' \
    | tee -a "$OUT" || true
  echo | tee -a "$OUT"
}

# 1) suspects les + fréquents
scan "Touch/Overlay suspects (pointerEvents / absolute overlays)" "pointerEvents|position:\\s*['\\\"]absolute['\\\"]|zIndex|elevation"
scan "ScrollView suspects (contentContainerStyle flex:1)" "contentContainerStyle\\s*=\\s*\\{\\{[^\\}]*flex\\s*:\\s*1"
scan "ScrollView suspects (flex:1 sur contentContainerStyle)" "contentContainerStyle\\s*=\\s*\\{\\{[^\\}]*flex\\s*:\\s*1"
scan "Scroll wrappers suspects (TouchableWithoutFeedback / Pressable wrappers)" "TouchableWithoutFeedback|Pressable\\s*\\(|onStartShouldSetResponder|onMoveShouldSetResponder|PanResponder"
scan "Gesture handler usage" "react-native-gesture-handler|GestureHandlerRootView|gestureHandlerRootHOC"
scan "TouchTrace / Debug overlays" "touchtrace|TouchTrace|Touch.*Trace"

# 2) composants partagés “Screen/Layout/Background”
scan "Shared layout/background components" "AppBackground|BrandBackground|Snow|Background|Screen\\b|Layout\\b|SafeAreaView"

echo "✅ Rapport généré: $OUT" | tee -a "$OUT"
echo "Tip: ouvre-le avec: sed -n '1,200p' $OUT" | tee -a "$OUT"
