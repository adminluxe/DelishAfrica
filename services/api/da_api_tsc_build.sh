#!/usr/bin/env bash
set -euo pipefail

echo ">>> [API-TSC] Build TypeScript API (sans Turbo)"

# Choix du bon tsconfig
CONFIG="tsconfig.build.json"
if [ ! -f "$CONFIG" ]; then
  if [ -f "tsconfig.json" ]; then
    CONFIG="tsconfig.json"
  else
    echo "❌ Aucun tsconfig.build.json ni tsconfig.json trouvé dans $(pwd)"
    exit 1
  fi
fi

echo "Utilisation de la config TypeScript : $CONFIG"

# Installation des deps locales (si pas déjà fait récemment)
pnpm install --silent || true

# Build TypeScript -> dist/
npx tsc -p "$CONFIG"

echo ">>> [API-TSC] Build terminé. Contenu de dist/ :"
ls -R dist || echo "⚠️ Aucun dossier dist/ trouvé"
