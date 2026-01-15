#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/unblock_scroll_${TS}"
RP="$ROOT/.tonton_reports/unblock_scroll_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🧯 TONTON UNBLOCK SCROLL (keyboard wrappers + scrollEnabled)"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo

cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "⚠️ ripgrep (rg) manquant. Installation..."
  apt-get update -y
  apt-get install -y ripgrep
fi

echo "============================================================"
echo "0) PRECHECK — détecter des guillemets JSX cassés (\"<ScrollView ...>)"
echo "============================================================"
rg -n --hidden --no-ignore -S '"\s*<(ScrollView|FlatList|SectionList|Stack|Tabs|View)\b' "$ROOT/apps" || true
echo

echo "============================================================"
echo "1) TARGETS — fichiers susceptibles"
echo "============================================================"
mapfile -t FILES < <(
  rg -l --hidden --no-ignore --glob='**/*.{ts,tsx,js,jsx}' -S \
    "TouchableWithoutFeedback|<Pressable|<TouchableOpacity|Keyboard\.dismiss|scrollEnabled\s*=\s*\{\s*false\s*\}|from ['\"]react-native-gesture-handler['\"]" \
    "$ROOT/apps" "$ROOT/packages" 2>/dev/null | sort -u
)

echo "Targets: ${#FILES[@]}"
printf '%s\n' "${FILES[@]}" || true
echo

echo "============================================================"
echo "2) BACKUP"
echo "============================================================"
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  mkdir -p "$BK$(dirname "${f#$ROOT}")"
  cp -a "$f" "$BK${f#$ROOT}"
done
echo "Backup OK ✅"
echo

echo "============================================================"
echo "3) PATCH A — enlever wrappers plein écran qui dismiss le clavier"
echo "   (TouchableWithoutFeedback/Pressable/TouchableOpacity avec Keyboard.dismiss)"
echo "   -> remplacés par fragments <>...</>"
echo "============================================================"

patchedA=0

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue

  # On ne touche que si Keyboard.dismiss est présent dans le fichier
  if ! rg -n -S "Keyboard\.dismiss" "$f" >/dev/null 2>&1; then
    continue
  fi

  before="$(wc -c < "$f" || echo 0)"

  # TouchableWithoutFeedback -> fragment (ouvre/ferme)
  perl -0777 -pi -e '
    s/<TouchableWithoutFeedback\b[^>]*>/<>/gms;
    s/<\/TouchableWithoutFeedback>/<\/>/gms;
  ' "$f" || true

  # Pressable qui dismiss -> fragment (ouvre/ferme)
  perl -0777 -pi -e '
    s/<Pressable\b(?=[^>]*Keyboard\.dismiss)[^>]*>/<>/gms;
    s/<\/Pressable>/<\/>/gms;
  ' "$f" || true

  # TouchableOpacity qui dismiss -> fragment (ouvre/ferme)
  perl -0777 -pi -e '
    s/<TouchableOpacity\b(?=[^>]*Keyboard\.dismiss)[^>]*>/<>/gms;
    s/<\/TouchableOpacity>/<\/>/gms;
  ' "$f" || true

  after="$(wc -c < "$f" || echo 0)"
  if [[ "$after" != "$before" ]]; then
    patchedA=$((patchedA+1))
    echo "✅ Patched wrappers: $f"
  fi
done

echo "Patched wrappers files: $patchedA"
echo

echo "============================================================"
echo "4) PATCH B — scrollEnabled={false} -> true"
echo "============================================================"
patchedB=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  if rg -n -S "scrollEnabled\s*=\s*\{\s*false\s*\}" "$f" >/dev/null 2>&1; then
    perl -pi -e 's/scrollEnabled\s*=\s*\{\s*false\s*\}/scrollEnabled={true}/g' "$f"
    patchedB=$((patchedB+1))
    echo "✅ Patched scrollEnabled: $f"
  fi
done
echo "Patched scrollEnabled files: $patchedB"
echo

echo "============================================================"
echo "5) PATCH C (option utile) — ScrollView/FlatList import: RNGH -> react-native"
echo "============================================================"
patchedC=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue

  # Si import depuis react-native-gesture-handler inclut ScrollView/FlatList/SectionList
  if rg -n -S "from ['\"]react-native-gesture-handler['\"]" "$f" >/dev/null 2>&1; then
    if rg -n -S "\b(ScrollView|FlatList|SectionList)\b" "$f" >/dev/null 2>&1; then
      # Remplace seulement les imports nommés : { ScrollView, FlatList, ... } depuis RNGH
      perl -0777 -pi -e '
        s/import\s*\{\s*([^}]*\bScrollView\b[^}]*)\}\s*from\s*["'\'']react-native-gesture-handler["'\''];/import { $1 } from "react-native";/gms;
        s/import\s*\{\s*([^}]*\bFlatList\b[^}]*)\}\s*from\s*["'\'']react-native-gesture-handler["'\''];/import { $1 } from "react-native";/gms;
        s/import\s*\{\s*([^}]*\bSectionList\b[^}]*)\}\s*from\s*["'\'']react-native-gesture-handler["'\''];/import { $1 } from "react-native";/gms;
      ' "$f" || true

      patchedC=$((patchedC+1))
      echo "✅ Patched RNGH list imports: $f"
    fi
  fi
done

echo "Patched import files: $patchedC"
echo

echo "============================================================"
echo "6) POSTCHECK — guillemets JSX cassés (doit être vide)"
echo "============================================================"
rg -n --hidden --no-ignore -S '"\s*<(ScrollView|FlatList|SectionList|Stack|Tabs|View)\b' "$ROOT/apps" || true
echo

echo "✅ DONE"
echo "Backup: $BK"
echo "Report: $RP"
echo
echo "Rollback (1-liner):"
echo "  rsync -a \"$BK/\" \"$ROOT/\""
echo
echo "Next:"
echo "  - restart metros --clear"
echo "  - swipe-close iPhone + rescan QR"
