#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/scroll_nuke_${TS}"
RP="$ROOT/.tonton_reports/scroll_nuke_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🧨 TONTON SCROLL NUKE MODE"
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
echo "A) HUNT — on liste les suspects (PanResponder / Gesture.Pan / handlers)"
echo "============================================================"
rg -n --hidden --no-ignore -S \
  "PanResponder\\.create|Gesture\\.Pan\\(|PanGestureHandler\\b|GestureDetector\\b|on(Start|Move)ShouldSet(Pan)?Responder|setJSResponder|blockNativeResponder|\\[TOUCH|TOUCHTRACE" \
  "$ROOT/apps" "$ROOT/packages" 2>/dev/null || true
echo

echo "============================================================"
echo "B) BACKUP — on sauvegarde les fichiers ciblés"
echo "============================================================"

mapfile -t TARGETS < <(
  rg -l --hidden --no-ignore -S --glob='**/*.{ts,tsx,js,jsx}' \
  "PanResponder\\.create|Gesture\\.Pan\\(|<PanGestureHandler\\b|on(Start|Move)ShouldSet(Pan)?Responder|\\[TOUCH|TOUCHTRACE" \
  "$ROOT/apps" "$ROOT/packages" 2>/dev/null || true
)

echo "Targets: ${#TARGETS[@]}"
printf '%s\n' "${TARGETS[@]}" || true
echo

for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || continue
  mkdir -p "$BK$(dirname "${f#$ROOT}")"
  cp -a "$f" "$BK${f#$ROOT}"
done

echo "============================================================"
echo "C) PATCH — Désactiver PAN gestures via EXPO_PUBLIC_SCROLL_NUKE=1"
echo "   - Gesture.Pan() -> Gesture.Pan().enabled(process.env...!==\"1\")"
echo "   - <PanGestureHandler ...> ajoute enabled={...} si absent"
echo "   - ShouldSetResponder/ShouldSetPanResponder true -> gate env"
echo "============================================================"

for f in "${TARGETS[@]}"; do
  [[ -f "$f" ]] || continue

  # 1) Gesture.Pan() gating (si pas déjà .enabled)
  perl -0777 -pi -e \
    's/Gesture\.Pan\(\)(?!\s*\.enabled\()/
      Gesture.Pan().enabled(process.env.EXPO_PUBLIC_SCROLL_NUKE !== "1")
    /gmsx' \
    "$f" || true

  # 2) PanGestureHandler gating (si pas déjà enabled= dans la balise)
  perl -0777 -pi -e \
    's/<PanGestureHandler(?![^>]*\benabled=)/
      <PanGestureHandler enabled={process.env.EXPO_PUBLIC_SCROLL_NUKE !== "1"}
    /gmsx' \
    "$f" || true

  # 3) Arrow handlers => true  -> gate env
  perl -0777 -pi -e \
    's/(on(?:Start|Move)ShouldSet(?:Pan)?Responder(?:Capture)?\s*(?::|=)\s*\([^)]*\)\s*=>)\s*true/\1 (process.env.EXPO_PUBLIC_SCROLL_NUKE !== "1")/gms' \
    "$f" || true

  # 4) Block handlers { return true; } -> gate env
  perl -0777 -pi -e \
    's/(on(?:Start|Move)ShouldSet(?:Pan)?Responder(?:Capture)?\s*(?::|=)\s*\([^)]*\)\s*=>\s*\{[^}]*?)return\s+true\s*;/\1return (process.env.EXPO_PUBLIC_SCROLL_NUKE !== "1");/gms' \
    "$f" || true
done

echo
echo "============================================================"
echo "D) HARD NUKE — désactiver les traceurs touch debug (NOOP) si trouvés"
echo "   (uniquement fichiers *Touch*Trace* / *touch*trace* / ui/_debug)"
echo "============================================================"

mapfile -t TRACE_FILES < <(
  find "$ROOT/apps" "$ROOT/packages" -type f -name "*.tsx" 2>/dev/null \
  | rg -n "TouchTrace|touchtrace|ui/_debug" -S -l || true
)

for f in "${TRACE_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  # on ne nuke que si le fichier contient des logs touch ou PanResponder/gesture
  if rg -n -S "\\[TOUCH|TOUCHTRACE|PanResponder\\.create|Gesture\\.Pan\\(" "$f" >/dev/null 2>&1; then
    echo "➡️ NOOP traceur: $f"
    mkdir -p "$BK$(dirname "${f#$ROOT}")"
    cp -a "$f" "$BK${f#$ROOT}" 2>/dev/null || true
    cat > "$f" <<'EOF'
import React from "react";
import { View } from "react-native";

/**
 * NOOP Touch tracer (NUKE MODE SAFE)
 * - laisse passer les touches (pointerEvents box-none)
 * - n'intercepte AUCUN pan/responder
 */
export default function TouchTrace({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }} pointerEvents="box-none">
      {children}
    </View>
  );
}
EOF
  fi
done

echo
echo "✅ NUKE MODE PATCH APPLIED"
echo "Backup: $BK"
echo "Report: $RP"
echo
echo "👉 Lancement TEST:"
echo "   EXPO_PUBLIC_SCROLL_NUKE=1 (désactive les gestures tueuses)"
echo
echo "Rollback (1-liner):"
echo "   rsync -a \"$BK/\" \"$ROOT/\""
