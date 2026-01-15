#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

# Patterns "interdits" (à enrichir au besoin)
PATTERNS=(
  '\{\$1\b'                                  # {$1 ...}
  'import\s*\{\s*\$1\s*,'                    # import { $1,
  '\$1,\s*Animated,\s*Easing'                # $1, Animated, Easing
  '\bDA_ANIM_V1\b.*\bDA_ANIM_V1\b'           # double injection (rare)
  'perl\s+-0777'                              # si tu veux interdire perl patches
)

echo "== DA Gate | Scan injections & placeholders =="
echo "Repo: $ROOT"

FOUND=0
TMP="/tmp/da_gate_scan_$$.txt"
: > "$TMP"

# scan rapide sur TS/TSX/JS/JSX/SH
for p in "${PATTERNS[@]}"; do
  if rg -n --hidden --no-ignore -S -g'*.{ts,tsx,js,jsx,sh}' "$p" . >> "$TMP"; then
    FOUND=1
    echo
    echo "!! MATCH pattern: $p"
    rg -n --hidden --no-ignore -S -g'*.{ts,tsx,js,jsx,sh}' "$p" . | head -n 80
  fi
done

# Auto-fix ULTRA ciblé (uniquement l'import react-native avec $1)
if [ "${1:-}" = "--fix" ]; then
  echo
  echo "== Auto-fix: replacing bad react-native import lines (very targeted) =="
  rg -n --hidden --no-ignore -S -g'*.tsx' "import\s*\{\s*\$1\s*,\s*Animated\s*,\s*Easing\s*\}\s*from\s*['\"]react-native['\"]\s*;" . \
    | cut -d: -f1 | sort -u \
    | while read -r f; do
        echo "FIX -> $f"
        # remplace la ligne exacte, sans toucher le reste
        perl -pi -e "s/^\\s*import\\s*\\{\\s*\\$1\\s*,\\s*Animated\\s*,\\s*Easing\\s*\\}\\s*from\\s*['\\\"]react-native['\\\"]\\s*;\\s*$/import { Animated, Easing } from 'react-native';/g" "$f"
      done
  echo "Auto-fix done."
fi

echo
if [ "$FOUND" -eq 1 ]; then
  echo "❌ GATE FAILED: suspicious patterns detected."
  echo "Tip: run: bash $ROOT/scripts/da_gate_scan_injections.sh --fix"
  exit 2
fi

echo "✅ GATE OK: no suspicious patterns found."
