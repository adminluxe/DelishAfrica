#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"

echo "== SCAN scroll killers =="
echo

echo "-- Responder / Gesture handlers (captures) --"
rg -n "onStartShouldSetResponder|onMoveShouldSetResponder|ResponderCapture|PanResponder|GestureDetector|Gesture\.Pan|simultaneousHandlers|waitFor" "$ROOT/apps" | head -n 120 || true
echo

echo "-- Scroll désactivé explicitement --"
rg -n "scrollEnabled=\{false\}|disableScrollViewPanResponder|scrollEnabled:\s*false" "$ROOT/apps" | head -n 120 || true
echo

echo "-- Vérif rapide: est-ce qu'on a bien des ScrollView dans les Home ? --"
for app in client merchant courier; do
  echo "## $app"
  rg -n "export default function|function .*Home|<ScrollView|<FlatList" "$ROOT/apps/$app" | head -n 80 || true
  echo
done
