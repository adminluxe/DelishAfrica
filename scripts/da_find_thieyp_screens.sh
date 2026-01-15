#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")

# mots-clés basés sur tes screens iPhone
KEYWORDS=(
  "Thieyp"
  "Créer une commande"
  "Créer une commande Thieyp"
  "suivi auto"
  "Suivi auto"
  "Rafraîchir"
  "Reset"
  "Missions READY"
  "Mission demo_"
  "File de production"
  "Commande demo_"
  "Marquer PRÊT"
  "Marquer LIVRÉE"
  "DELIVERED"
  "READY"
  "PENDING"
  "orderId"
  "status:"
  "api.delishafrica.me"
)

HAS_RG=0
command -v rg >/dev/null 2>&1 && HAS_RG=1

echo "=== DelishAfrica · Finder Thieyp Screens ==="
echo "ROOT: $ROOT"
echo

for app in "${APPS[@]}"; do
  BASE="$ROOT/apps/$app"

  echo "============================================================"
  echo "APP: $app"
  echo "BASE: $BASE"
  if [[ ! -d "$BASE" ]]; then
    echo "!! dossier introuvable"
    echo
    continue
  fi

  # détecte dossier(s) expo-router "app"
  echo
  echo "[1] Dossiers de routes probables:"
  ROUTE_DIRS=$(find "$BASE" -maxdepth 5 -type d -name "app" 2>/dev/null || true)
  if [[ -z "${ROUTE_DIRS// }" ]]; then
    echo "  (aucun dossier 'app' trouvé, je liste les candidats 'src/app' etc.)"
    find "$BASE" -maxdepth 6 -type d \( -path "*/src/app" -o -path "*/app" \) 2>/dev/null || true
  else
    echo "$ROUTE_DIRS" | sed 's/^/  - /'
  fi

  # fichiers routes les plus courants
  echo
  echo "[2] Fichiers routes 'index/_layout' (candidats Home + structure):"
  if [[ -n "${ROUTE_DIRS// }" ]]; then
    while IFS= read -r d; do
      find "$d" -maxdepth 4 -type f \
        \( -name "index.tsx" -o -name "index.jsx" -o -name "_layout.tsx" -o -name "_layout.jsx" \) \
        2>/dev/null | sed 's/^/  - /'
    done <<< "$ROUTE_DIRS"
  fi

  # recherche textuelle
  echo
  echo "[3] Hits par mots-clés (c'est là que tu récupères les fichiers exacts):"
  if [[ $HAS_RG -eq 1 ]]; then
    for kw in "${KEYWORDS[@]}"; do
      echo
      echo "---- kw: $kw"
      rg -n --hidden --no-ignore-vcs --glob '!*node_modules/*' --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.jsx' \
        "$kw" "$BASE" || true
    done
  else
    for kw in "${KEYWORDS[@]}"; do
      echo
      echo "---- kw: $kw"
      grep -RIn --exclude-dir node_modules --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
        "$kw" "$BASE" || true
    done
  fi

  # check SafeAreaProvider (utile pour ton fix "bloc du haut")
  echo
  echo "[4] Check SafeAreaProvider (root layout):"
  if [[ $HAS_RG -eq 1 ]]; then
    rg -n "SafeAreaProvider" "$BASE" --hidden --no-ignore-vcs --glob '!*node_modules/*' || true
  else
    grep -RIn --exclude-dir node_modules "SafeAreaProvider" "$BASE" || true
  fi

  echo
done

echo "============================================================"
echo "FIN. Copie/colle ici la section APP: client/courier/merchant si tu veux que je te renvoie les FICHIERS COMPLETS patchés."
