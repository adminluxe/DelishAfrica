#!/usr/bin/env bash
#
# tonton_full_heal_and_align.sh
#
# Ce script est destiné à réconcilier les projectId, slugs et fichiers .eas
# pour les applications client, merchant et courier du monorepo DelishAfrica.
# Il supprime le lien .eas à la racine, remplace les anciens projectId par
# ceux attendus, génère un fichier .eas/project.json propre pour chaque
# application et ajoute des variables d'environnement EAS pour éviter les
# erreurs d'installation de dépendances.  Un rapport succinct de la
# configuration résolue est affiché pour chaque app.

set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/full_heal_$TS"
mkdir -p "$BACKUP"

# Définition des projectId attendus pour chaque app.  Modifiez ces
# variables si vos IDs changent dans le futur.
CLIENT_ID="394e7d6f-559b-4536-81a9-fbc0cdb0c68f"
MERCHANT_ID="292e5d9e-9dbe-4dfb-ba4f-ed80cf2e2bbc"
COURIER_ID="5d1b6b85-9e64-4cc2-9cbe-7d698feccc84"

# Liste d'anciens projectId à éliminer.  Ajoutez ici tout ID obsolète.
BAD_IDS=(
  "dae37d7c-369e-436c-a4d1-ba62bf8cbc6f"
)

# Fonction utilitaire pour sauvegarder un fichier ou répertoire existant
backup_path() {
  local path="$1"
  [ -e "$path" ] || return 0
  local rel="${path#$ROOT/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$path" "$BACKUP/$rel"
}

echo "==== Étape 1 : Suppression du .eas racine si présent ===="
if [ -d "$ROOT/.eas" ]; then
  backup_path "$ROOT/.eas"
  rm -rf "$ROOT/.eas"
  echo "Le dossier .eas à la racine a été déplacé dans le backup: $BACKUP"
else
  echo "Pas de dossier .eas à la racine, rien à faire."
fi

# Fonction pour traiter une application.
process_app() {
  local app="$1"
  local expected_id="$2"
  local appdir="$ROOT/apps/$app"
  echo "\n==== Traitement de l'application $app (projectId attendu: $expected_id) ===="

  if [ ! -d "$appdir" ]; then
    echo "Répertoire $appdir introuvable, skip."
    return 0
  fi

  # Sauvegarde des fichiers de config et .eas locaux
  for f in app.config.ts app.config.base.ts app.json eas.json; do
    if [ -e "$appdir/$f" ]; then
      backup_path "$appdir/$f"
    fi
  done
  if [ -d "$appdir/.eas" ]; then
    backup_path "$appdir/.eas"
    rm -rf "$appdir/.eas"
  fi

  # Remplacement des projectId obsolètes par l'ID attendu
  local all_ids=("$CLIENT_ID" "$MERCHANT_ID" "$COURIER_ID" "${BAD_IDS[@]}")
  for file in app.config.ts app.config.base.ts app.json; do
    local filepath="$appdir/$file"
    if [ -f "$filepath" ]; then
      for id in "${all_ids[@]}"; do
        # Ne remplace pas l'ID attendu par lui-même
        if [ "$id" != "$expected_id" ]; then
          sed -i "s/$id/$expected_id/g" "$filepath" || true
        fi
      done
    fi
  done

  # Génération d'un .eas/project.json propre
  mkdir -p "$appdir/.eas"
  cat > "$appdir/.eas/project.json" <<JSON
{
  "accountName": "delishafrica",
  "projectName": "$app",
  "projectId": "$expected_id"
}
JSON

  # Mise à jour du eas.json avec des variables d'environnement pour npm
  local easjson="$appdir/eas.json"
  if [ -f "$easjson" ]; then
    node -e "const fs=require('fs'); const file='$easjson'; const profile='development'; const j=JSON.parse(fs.readFileSync(file,'utf8')); j.build=j.build||{}; j.build[profile]=j.build[profile]||{}; j.build[profile].env = Object.assign({}, j.build[profile].env || {}, { NPM_CONFIG_LEGACY_PEER_DEPS:'true', NPM_CONFIG_FUND:'false', NPM_CONFIG_AUDIT:'false', EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK:'1' }); fs.writeFileSync(file, JSON.stringify(j,null,2));" || true
  fi

  # Affichage de la configuration résolue pour vérification
  echo "Configuration résolue pour $app :"
  (cd "$appdir" && npx expo config --type public --json 2>/dev/null | node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({ app:'$app', slug: j.slug, projectId: j.extra?.eas?.projectId }, null, 2));")
}

# Traitement des trois applications
process_app client   "$CLIENT_ID"
process_app merchant "$MERCHANT_ID"
process_app courier  "$COURIER_ID"

echo "\n==== Étape 2 : Recherche d'anciens projectId restants (facultatif) ===="
for bad in "${BAD_IDS[@]}"; do
  echo "Occurrences de l'ID obsolète $bad :"
  grep -R -n "$bad" "$ROOT" || echo "Aucune occurrence trouvée."
done

echo "\n==== Terminé ===="
echo "Les backups se trouvent dans : $BACKUP"
echo "Vous pouvez désormais lancer 'eas build -p ios --profile development --clear-cache' depuis chaque dossier apps/<app>."
