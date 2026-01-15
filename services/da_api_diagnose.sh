#!/usr/bin/env bash

# Script de diagnostic NestJS pour DelishAfrica
# - affiche la structure de l'API monorepo
# - montre main.ts
# - localise tous les app.module.ts sous /opt/delishafrica

set -u

NEW_API_ROOT="/opt/delishafrica/monorepo/services/api"

echo ">>> 1) Vérification du répertoire API attendu"
if [ -d "$NEW_API_ROOT" ]; then
  cd "$NEW_API_ROOT"
  echo "Répertoire API : \$(pwd)"
else
  echo "✗ Le répertoire $NEW_API_ROOT n'existe pas"
  exit 1
fi

echo
echo ">>> 2) Contenu de src/ (niveau 1) :"
if [ -d "src" ]; then
  ls src
else
  echo "✗ Aucun dossier src/ dans \$(pwd)"
fi

echo
echo ">>> 3) Fichier src/main.ts (premières lignes) :"
if [ -f "src/main.ts" ]; then
  echo "--- src/main.ts (1-80) ---"
  sed -n '1,80p' src/main.ts
else
  echo "✗ src/main.ts introuvable"
fi

echo
echo ">>> 4) Fichier src/app.module.ts (statut + aperçu) :"
if [ -f "src/app.module.ts" ]; then
  echo "Taille & lignes :"
  wc -l src/app.module.ts
  echo
  echo "--- src/app.module.ts (1-80) ---"
  sed -n '1,80p' src/app.module.ts
else
  echo "Aucun src/app.module.ts dans \$(pwd)/src"
fi

echo
echo ">>> 5) Recherche de 'AppModule' dans src/ :"
if [ -d "src" ]; then
  if grep -R --line-number "AppModule" src > /tmp/da_grep_appmodule_\$\$.log 2>/dev/null; then
    cat /tmp/da_grep_appmodule_\$\$.log
  else
    echo "Aucune occurrence de 'AppModule' trouvée dans src/"
  fi
  rm -f /tmp/da_grep_appmodule_\$\$.log
else
  echo "Pas de src/ -> pas de recherche AppModule"
fi

echo
echo ">>> 6) Tous les fichiers *module.ts détectés dans src/ (profondeur 4) :"
if [ -d "src" ]; then
  find src -maxdepth 4 -type f -name "*module.ts" -print || echo "Aucun module.ts trouvé dans src/"
else
  echo "Pas de src/ -> pas de modules"
fi

echo
echo ">>> 7) Tous les app.module.ts sous /opt/delishafrica (maxdepth 8, avec aperçus courts) :"
ROOT="/opt/delishafrica"
if [ -d "$ROOT" ]; then
  find "$ROOT" -maxdepth 8 -type f -name "app.module.ts" -print0 2>/dev/null |
  while IFS= read -r -d '' f; do
    echo
    echo "=== \$f ==="
    wc -l "\$f" | awk '{print "  Lignes : " \$1}'
    echo "  Aperçu (1-40) :"
    sed -n '1,40p' "\$f"
  done
else
  echo "✗ Le répertoire $ROOT n'existe pas, impossible de scanner"
fi

echo
echo ">>> Diagnostic terminé."
