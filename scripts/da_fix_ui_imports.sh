#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)

echo "== Patch imports: ./ui/* et ../ui/* -> _ui =="
for a in "${APPS[@]}"; do
  base="$ROOT/apps/$a/app"
  echo "-- $a"

  # Patch toutes les refs ./ui/ -> ./_ui/ et ../../ui/ -> ../../_ui/
  rg -l --hidden --glob '!**/node_modules/**' '(?:\./|(?:\.\./)+)ui/' "$base" \
    | xargs -r perl -pi -e 's#\./ui/#./_ui/#g; s#((?:\.\./)+)ui/#$1_ui/#g'

  echo "Remaining refs (should be empty):"
  rg -n --hidden --glob '!**/node_modules/**' '(?:\./|(?:\.\./)+)ui/' "$base" || true
done

echo "OK. Maintenant redémarre Expo avec --clear dans chaque app."
