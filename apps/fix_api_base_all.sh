#!/usr/bin/env bash
set -euo pipefail

BASE="/opt/delishafrica/compose/apps"
API_URL="https://api.delishafrica.me"

echo "→ Forçage de l'API dans app/index.tsx pour client / courier / merchant"
for APP in client courier merchant; do
  FILE="$BASE/$APP/app/index.tsx"
  if [ -f "$FILE" ]; then
    cp "$FILE" "$FILE.BAK_$(date +%Y%m%d-%H%M%S)"
    # remplace la ligne const API = ...
    perl -0pi -e "s#const API *=.*;#const API = \"$API_URL\";#g" "$FILE"
    echo "  ✓ $FILE mis à jour"
  else
    echo "  ⚠ $FILE introuvable, on laisse tel quel"
  fi
done

echo "✓ Terminé. Relance tmux + da_mux pour prendre en compte."
