#!/usr/bin/env bash
set -euo pipefail

APPS=(client courier merchant)

echo "== Fix Expo Router: make UI folder private (_ui) =="

for a in "${APPS[@]}"; do
  ROOT="apps/$a/app"
  echo ""
  echo "== [$a] =="
  [ -d "$ROOT" ] || { echo "Missing: $ROOT"; continue; }

  # 1) Normalize folder name -> _ui
  if [ -d "$ROOT/ui" ]; then
    echo "Renaming: $ROOT/ui -> $ROOT/_ui"
    mv "$ROOT/ui" "$ROOT/_ui"
  fi
  if [ -d "$ROOT/+ui" ]; then
    echo "Renaming: $ROOT/+ui -> $ROOT/_ui"
    rm -rf "$ROOT/_ui" 2>/dev/null || true
    mv "$ROOT/+ui" "$ROOT/_ui"
  fi

  # 2) Patch imports that referenced ./ui or ../ui
  # (we keep it conservative: only relative imports)
  FILES=$(grep -RIl --exclude-dir=node_modules --exclude-dir=.git -E "(['\"])\\./ui/|(['\"])\\../ui/" "apps/$a" || true)
  if [ -n "${FILES:-}" ]; then
    echo "$FILES" | xargs -r perl -pi -e "s@(['\"])\\./ui/@\$1./_ui/@g; s@(['\"])\\../ui/@\$1../_ui/@g"
    echo "Patched relative imports to _ui."
  else
    echo "No relative imports to patch."
  fi

  # 3) Sanity check: ensure no app/ui remains
  echo "Folders (ui/_ui/+ui):"
  find "$ROOT" -maxdepth 2 -type d \( -name "ui" -o -name "_ui" -o -name "+ui" \) -print || true
done

echo ""
echo "OK. Next: restart Expo with --clear in each app window."
