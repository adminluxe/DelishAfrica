#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/opt/delishafrica/monorepo}"
APPS="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/.tonton_backups/_reports/scroll_rngh_audit_${TS}.txt"
mkdir -p "$(dirname "$OUT")"

rg_cmd() {
  if command -v rg >/dev/null 2>&1; then
    rg --hidden --no-heading --line-number \
      --glob '!**/node_modules/**' \
      --glob '!**/.git/**' \
      --glob '!**/.expo/**' \
      --glob '!**/.expo-shared/**' \
      --glob '!**/.tonton_backups/**' \
      --glob '!**/.backups/**' \
      --glob '!**/.backup/**' "$@"
  else
    grep -RIn \
      --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.expo --exclude-dir=.expo-shared \
      --exclude-dir=.tonton_backups --exclude-dir=.backups --exclude-dir=.backup "$@"
  fi
}

{
  echo "[DA] ROOT: $ROOT"
  echo "[DA] OUT : $OUT"
  echo

  echo "============================================================"
  echo "[A] Imports ScrollView/FlatList/SectionList depuis react-native-gesture-handler"
  echo "============================================================"
  rg_cmd "from ['\"]react-native-gesture-handler['\"]" "$APPS" | rg_cmd "ScrollView|FlatList|SectionList" - || true
  echo

  echo "============================================================"
  echo "[B] Presence de GestureHandlerRootView (doit être au root)"
  echo "============================================================"
  rg_cmd "GestureHandlerRootView" "$APPS" || true
  echo

  echo "============================================================"
  echo "[C] Vérif entrée: import 'react-native-gesture-handler' (React Navigation recommande top-of-file)"
  echo "============================================================"
  rg_cmd "import ['\"]react-native-gesture-handler['\"]" "$APPS" || true
  echo

  echo "============================================================"
  echo "[D] _layout.tsx (Expo Router): manque un wrapper RNGH ?"
  echo "============================================================"
  find "$APPS" -type f -name "_layout.tsx" 2>/dev/null | while read -r f; do
    if rg_cmd "GestureHandlerRootView" "$f" >/dev/null 2>&1; then
      echo "[OK]   $f"
    else
      echo "[MISS] $f"
    fi
  done
  echo

  echo "============================================================"
  echo "[E] Rappel RN: ScrollView doit avoir hauteur bornée (flex:1 chain)"
  echo "============================================================"
  echo "=> Si ScrollView est dans une stack de Views sans flex:1, il peut sembler 'KO'."
  echo "   Voir docs RN: bounded height / flex chain."
} | tee "$OUT"
echo "[DA] Audit terminé: $OUT"
