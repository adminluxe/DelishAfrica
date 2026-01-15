#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/fix_layout_quotes_${TS}"
RP="$ROOT/.tonton_reports/fix_layout_quotes_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🧯 FIX LAYOUT QUOTES"
echo "Backup: $BK"
echo "Report: $RP"
echo

cd "$ROOT"

# layouts uniquement (et on évite node_modules + backups)
mapfile -t LAYOUTS < <(
  find "$ROOT/apps" -type f \( -name "_layout.tsx" -o -name "_layout.ts" -o -name "+layout.tsx" -o -name "+layout.ts" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.tonton_backups/*" \
    -not -path "*/backup_*/*" \
    2>/dev/null | sort -u
)

echo "Layouts: ${#LAYOUTS[@]}"
echo

for f in "${LAYOUTS[@]}"; do
  [[ -f "$f" ]] || continue

  # on ne touche qu'aux fichiers contenant le pattern cassé
  if rg -n '"screenOptions=\{\{' "$f" >/dev/null 2>&1; then
    echo "➡️ Fix: $f"
    mkdir -p "$BK$(dirname "${f#$ROOT}")"
    cp -a "$f" "$BK${f#$ROOT}"

    # enlève les guillemets au début et fin de ligne autour de screenOptions
    perl -pi -e '
      if (/^\s*"\s*screenOptions=\{\{/) {
        s/^(\s*)"\s*/$1/;   # supprime le " au début
        s/"\s*$//;          # supprime le " en fin de ligne
      }
    ' "$f"
  fi
done

echo
echo "Scan restant (doit être vide) :"
rg -n '"screenOptions=\{\{' "$ROOT/apps" || true

echo
echo "✅ DONE"
echo "Rollback (1-liner): rsync -a \"$BK/\" \"$ROOT/\""
