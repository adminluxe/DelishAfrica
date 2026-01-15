#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/overlay_passthrough_${TS}"
RP="$ROOT/.tonton_reports/overlay_passthrough_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🫥 TONTON OVERLAY PASS-THROUGH (pointerEvents gate)"
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

# Dossiers existants uniquement
DIRS=()
[[ -d "$ROOT/apps" ]] && DIRS+=("$ROOT/apps")
[[ -d "$ROOT/packages" ]] && DIRS+=("$ROOT/packages")

echo "============================================================"
echo "A) FIND suspects (Background/Overlay/Snow/Parallax + absolute)"
echo "============================================================"

mapfile -t FILES < <(
  find "${DIRS[@]}" -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.tonton_backups/*" \
    -not -path "*/.tonton_reports/*" \
    2>/dev/null \
  | rg -i "(background|overlay|snow|parallax)" \
  | while read -r f; do
      if rg -n -S "absoluteFillObject|StyleSheet\.absoluteFill|position\s*:\s*['\"]absolute['\"]|absoluteFill" "$f" >/dev/null 2>&1; then
        echo "$f"
      fi
    done
)

echo "Candidates: ${#FILES[@]}"
printf '%s\n' "${FILES[@]}" || true
echo

echo "============================================================"
echo "B) BACKUP + PATCH pointerEvents gate"
echo "   pointerEvents={EXPO_PUBLIC_TOUCH_PASSTHROUGH==='1' ? 'none' : 'auto'}"
echo "============================================================"

patched=0

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue

  # skip si déjà pointerEvents
  if rg -n "\bpointerEvents=" "$f" >/dev/null 2>&1; then
    echo "⏭️ Skip (already pointerEvents): $f"
    continue
  fi

  echo "➡️ Patch: $f"
  mkdir -p "$BK$(dirname "${f#$ROOT}")"
  cp -a "$f" "$BK${f#$ROOT}"

  # Ajoute pointerEvents sur le 1er container fréquent (View / Animated.View)
  perl -0777 -pi -e '
    my $gate = qq(pointerEvents={process.env.EXPO_PUBLIC_TOUCH_PASSTHROUGH === "1" ? "none" : "auto"});
    s/<Animated\.View(?![^>]*\bpointerEvents=)/<Animated.View $gate/;
    s/<View(?![^>]*\bpointerEvents=)/<View $gate/;
  ' "$f"

  patched=$((patched+1))
done

echo
echo "✅ DONE (patched: $patched)"
echo "Backup: $BK"
echo "Report: $RP"
echo
echo "Rollback (1-liner):"
echo "  rsync -a \"$BK/\" \"$ROOT/\""
echo
echo "TEST:"
echo "  EXPO_PUBLIC_TOUCH_PASSTHROUGH=1 pnpm dev -- --tunnel --clear --port XXXX"
