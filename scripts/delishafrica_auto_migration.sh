#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# DelishAfrica Auto Migration Script
#
# Objectif :
#  - Réconcilier l'ancien projet "compose" avec le monorepo Expo.
#  - Copier les apps (client / courier / merchant) manquantes.
#  - Supprimer les anciennes configs Metro conflictuelles.
#  - Nettoyer les caches / node_modules.
#  - Réinstaller les dépendances.
#  - S'assurer qu'expo-router a un _layout.tsx global + une entrée index.tsx.
# -----------------------------------------------------------------------------
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/delishafrica/monorepo}"
MONOREPO_DIR="${MONOREPO_DIR:-/opt/delishafrica/monorepo}"

echo "[DA][auto] 📂 COMPOSE_DIR  = $COMPOSE_DIR"
echo "[DA][auto] 📂 MONOREPO_DIR = $MONOREPO_DIR"
echo

# --- Vérifs des répertoires ---------------------------------------------------
if [ ! -d "$COMPOSE_DIR" ]; then
  echo "[DA][auto] ERREUR : dossier compose introuvable : $COMPOSE_DIR" >&2
  exit 1
fi
if [ ! -d "$MONOREPO_DIR" ]; then
  echo "[DA][auto] ERREUR : dossier monorepo introuvable : $MONOREPO_DIR" >&2
  exit 1
fi

APPS_SRC="$COMPOSE_DIR/apps"
APPS_DST="$MONOREPO_DIR/apps"

# --- Étape 1 : synchroniser les apps -----------------------------------------
if [ -d "$APPS_SRC" ]; then
  echo "[DA][auto] 🔄 Synchronisation des apps depuis $APPS_SRC vers $APPS_DST"
  mkdir -p "$APPS_DST"
  # On n'écrase pas les fichiers existants dans le monorepo
  rsync -a --ignore-existing "$APPS_SRC/" "$APPS_DST/"
  echo "[DA][auto] ✅ Apps synchronisées."
else
  echo "[DA][auto] ⚠️  Aucun dossier apps trouvé dans $APPS_SRC (compose)."
fi
echo

# --- Étape 2 : nettoyer Metro config -----------------------------------------
echo "[DA][auto] 🧹 Nettoyage des anciennes configs Metro..."
find "$MONOREPO_DIR" -maxdepth 1 -type f \
  \( -name "metro.config.js" -o -name "metro.config.cjs" -o -name "metro.config.mjs" \) \
  -print -exec rm -f {} \; || true
echo "[DA][auto] ✅ Metro config nettoyée (s'il y en avait)."
echo

# --- Étape 3 : nettoyage des caches / node_modules ---------------------------
echo "[DA][auto] 🧽 Suppression des caches et node_modules principaux..."
rm -rf \
  "$MONOREPO_DIR/node_modules" \
  "$MONOREPO_DIR/.expo" \
  "$MONOREPO_DIR/.turbo" \
  "$MONOREPO_DIR/.pnpm-store" || true

# on nettoie aussi .expo dans les sous-apps si présents
if [ -d "$APPS_DST" ]; then
  find "$APPS_DST" -maxdepth 3 -type d -name ".expo" -print -exec rm -rf {} \; || true
fi

echo "[DA][auto] ✅ Caches principaux supprimés."
echo

# --- Étape 4 : réinstallation des dépendances --------------------------------
echo "[DA][auto] 📦 Réinstallation des dépendances dans le monorepo..."
cd "$MONOREPO_DIR"

if command -v pnpm >/dev/null 2>&1; then
  echo "[DA][auto] → pnpm install"
  pnpm install
elif command -v npm >/dev/null 2>&1; then
  echo "[DA][auto] → npm install"
  npm install
else
  echo "[DA][auto] ERREUR : ni pnpm ni npm n'est disponible dans le PATH." >&2
  exit 1
fi

echo "[DA][auto] ✅ Dépendances réinstallées."
echo

# --- Étape 5 : s'assurer de la présence du layout global + entrée expo-router
GLOBAL_LAYOUT="$MONOREPO_DIR/app/_layout.tsx"
CUSTOM_ENTRY="$MONOREPO_DIR/index.tsx"

echo "[DA][auto] Vérification / création du layout global Expo Router..."
mkdir -p "$(dirname "$GLOBAL_LAYOUT")"

if [ ! -f "$GLOBAL_LAYOUT" ]; then
  cat > "$GLOBAL_LAYOUT" <<'LAYOUT_EOF'
import React from "react";
import { Slot } from "expo-router";

export default function RootLayout() {
  return <Slot />;
}
LAYOUT_EOF
  echo "[DA][auto] ✅ _layout.tsx global créé : app/_layout.tsx"
else
  echo "[DA][auto] ℹ️  _layout.tsx existe déjà, laissé tel quel."
fi
echo

echo "[DA][auto] Vérification / création de l'entrée index.tsx (expo-router/entry)..."
if [ ! -f "$CUSTOM_ENTRY" ]; then
  cat > "$CUSTOM_ENTRY" <<'ENTRY_EOF'
import "expo-router/entry";
ENTRY_EOF
  echo "[DA][auto] ✅ index.tsx créé à la racine du monorepo."
else
  echo "[DA][auto] ℹ️  index.tsx existe déjà, laissé tel quel."
fi
echo

# --- Étape 6 : redémarrage des bundlers (optionnel via tmux) -----------------
if command -v tmux >/dev/null 2>&1 && [ -x "$MONOREPO_DIR/scripts/da_mux" ]; then
  echo "[DA][auto] 🔁 Redémarrage des bundlers via tmux (da_mux)..."
  "$MONOREPO_DIR/scripts/da_mux"
  echo "[DA][auto] ✅ tmux / da_mux relancé."
else
  echo "[DA][auto] ℹ️  Aucun da_mux détecté."
  echo "[DA][auto]    Tu pourras lancer manuellement par exemple :"
  echo "      cd $MONOREPO_DIR"
  echo "      npx expo start --dev-client --tunnel --clear"
fi

echo
echo "[DA][auto] ✅ Migration & nettoyage terminés."
echo "[DA][auto] Tu peux maintenant lancer et tester les apps (Client / Courier / Merchant) depuis le monorepo."
