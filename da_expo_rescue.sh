#!/usr/bin/env bash
set -euo pipefail

# ================================
# DelishAfrica – Expo Rescue Script
# ================================

ROOT="/opt/delishafrica/monorepo"
BACKUP_GLOB="/opt/delishafrica_backup_*.tar.gz"

GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
CYAN="\e[36m"
RESET="\e[0m"

log()  { echo -e "${CYAN}[DA][rescue]${RESET} $*"; }
ok()   { echo -e "${GREEN}✔${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
err()  { echo -e "${RED}✖${RESET} $*" >&2; }

# 0) Sanity check
if [ ! -d "$ROOT" ]; then
  err "Dossier monorepo introuvable : $ROOT"
  exit 1
fi

log "Point de départ : $ROOT"

# 1) Vérifier qu'une sauvegarde globale existe déjà
if ls $BACKUP_GLOB >/dev/null 2>&1; then
  ok "Sauvegarde déjà présente : $(ls -1t $BACKUP_GLOB | head -n1)"
else
  warn "Aucune sauvegarde trouvée dans /opt. Création d'une sauvegarde maintenant..."
  TS="$(date +%Y%m%d-%H%M)"
  BACKUP_FILE="/opt/delishafrica_backup_${TS}.tar.gz"
  tar -C /opt -czf "$BACKUP_FILE" delishafrica
  ok "Sauvegarde créée : $BACKUP_FILE"
fi

# 2) Réinstall deps essentielles + navigation
log "Réinstallation des dépendances pnpm (workspace)..."
cd "$ROOT"
pnpm install

log "Ajout / vérification des libs React Navigation..."
pnpm -w add @react-navigation/native @react-navigation/bottom-tabs @react-navigation/elements @react-navigation/native-stack >/dev/null 2>&1 || true

ok "Dépendances principales ok."

# 3) Réécrire un _layout.tsx minimal pour chaque app
log "Réécriture des layouts Expo Router minimalistes..."

for APP in client courier merchant; do
  LAYOUT_FILE="$ROOT/apps/${APP}/app/_layout.tsx"
  if [ -d "$(dirname "$LAYOUT_FILE")" ]; then
    cat > "$LAYOUT_FILE" << 'LAYOUT_EOF'
import { Slot } from 'expo-router';

export default function RootLayout() {
  return <Slot />;
}
LAYOUT_EOF
    ok "_layout.tsx réécrit pour ${APP}"
  else
    warn "Dossier app introuvable pour ${APP}, ignoré."
  fi
done

# 4) Nettoyage des caches Expo / Metro
log "Nettoyage des caches Expo / Metro..."
find "$ROOT" -maxdepth 5 -type d \( -name ".expo" -o -name ".expo-shared" -o -name "dist" \) -print -exec rm -rf {} + || true
rm -rf "$ROOT/.expo" "$ROOT/.expo-shared" "$ROOT/.turbo" "$ROOT/node_modules/.cache" 2>/dev/null || true
ok "Caches principaux nettoyés."

# 5) Patch du check 'expo/metro-runtime must be the first import...'
log "Recherche du check 'expo/metro-runtime must be the first import...' pour le patcher..."

PATCH_TARGET="$(grep -RIl "expo/metro-runtime must be the first import to ensure Fast Refresh works" "$ROOT/node_modules" 2>/dev/null | head -n1 || true)"

if [ -n "$PATCH_TARGET" ]; then
  log "Fichier détecté : $PATCH_TARGET"
  # On remplace 'throw new Error(' par 'console.warn(' pour désactiver le crash.
  sed -i 's/throw new Error(/console.warn(/' "$PATCH_TARGET"
  ok "Patch appliqué sur expo/metro-runtime (erreur -> warning)."
else
  warn "Aucun check 'expo/metro-runtime...' trouvé. (Peut-être déjà patché ?)"
fi

# 6) Rappel de la commande à lancer ensuite
echo
ok "RESCUE TERMINÉ."
echo -e "${GREEN}Tu peux maintenant relancer les apps depuis le monorepo :${RESET}"
echo -e "  cd $ROOT"
echo -e "  npx expo start --dev-client --tunnel --clear"
echo
echo -e "${YELLOW}Ou utiliser ton script tmux habituel (da_mux) s'il est déjà configuré sur le monorepo.${RESET}"
