#!/usr/bin/env bash
set -euo pipefail

BASE="/opt/delishafrica/monorepo"
APPS=(client courier merchant)

echo "== [DA] Fix App entry (expo-router) =="

for app in "${APPS[@]}"; do
  APP_DIR="$BASE/apps/$app"
  echo
  echo "--> Traitement de l'app: $app ($APP_DIR)"

  if [ ! -d "$APP_DIR" ]; then
    echo "   [!] Dossier introuvable, on saute."
    continue
  fi

  # Backup d'anciens App.* si jamais ils existent
  for f in "$APP_DIR"/App.{tsx,ts,jsx,js}; do
    if [ -f "$f" ]; then
      backup="$f.bak_$(date +%Y%m%d%H%M%S)"
      mv "$f" "$backup"
      echo "   Backup de $(basename "$f") -> $(basename "$backup")"
    fi
  done

  cat > "$APP_DIR/App.tsx" << 'APPFILE'
import React from "react";
import { ExpoRoot } from "expo-router";

export default function App() {
  // Charge automatiquement toutes les routes déclarées dans le dossier "app"
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}
APPFILE

  echo "   ✅ App.tsx créé pour $app."
done

echo
echo "✅ Tous les App.tsx sont en place. Tu peux relancer les bundlers Expo."
