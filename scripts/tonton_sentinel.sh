#!/usr/bin/env bash
#
# tonton_sentinel.sh
#
# Ce script « sentinel » inspecte le monorepo DelishAfrica afin de détecter
# les causes courantes d'incohérence entre les slugs et les projectId
# (notamment la présence de répertoires en double, la duplication de
# projectId dans plusieurs applications, ou des valeurs inattendues dans
# les fichiers de configuration). Il corrige ces problèmes en
# sauvegardant et supprimant les répertoires en double, puis en
# réappliquant un mapping projectId/slug cohérent. Un résumé de la
# configuration résolue est affiché à la fin.

set -euo pipefail

# Racine du monorepo
ROOT="/opt/delishafrica/monorepo"
# Dossier de backup horodaté
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/sentinel_$TS"
mkdir -p "$BACKUP"

# Noms d'applications attendues (en minuscules)
APPS=(client merchant courier)

echo "==== Sentinel: détection des répertoires en double ===="

# Tables associatives pour stocker le répertoire canonique et les doublons
declare -A canonical_dir
declare -A duplicate_dirs

# Parcours des répertoires immédiatement sous apps/
while IFS= read -r -d '' d; do
  name="$(basename "$d")"
  lower="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')"
  for app in "${APPS[@]}"; do
    if [ "$lower" = "$app" ]; then
      if [ -z "${canonical_dir[$app]+x}" ]; then
        canonical_dir[$app]="$d"
      else
        duplicate_dirs[$app]="${duplicate_dirs[$app]} $d"
      fi
    fi
  done
done < <(find "$ROOT/apps" -mindepth 1 -maxdepth 1 -type d -print0)

# Déplacement des répertoires en double vers le backup
for app in "${APPS[@]}"; do
  if [ -n "${duplicate_dirs[$app]:-}" ]; then
    echo "App '$app': répertoires en double détectés:${duplicate_dirs[$app]}"
    for dup in ${duplicate_dirs[$app]}; do
      rel="${dup#$ROOT/}"
      mkdir -p "$BACKUP/$(dirname "$rel")"
      mv "$dup" "$BACKUP/$rel"
      echo "  - $dup déplacé vers $BACKUP/$rel"
    done
  fi
done

echo "==== Sentinel: analyse et correction des projectId et slugs ===="

# Fonction pour traiter et corriger une application
process_and_fix_app() {
  local app="$1"
  local dir="${canonical_dir[$app]:-}"
  if [ -z "$dir" ]; then
    echo "App '$app': répertoire canonique introuvable, skip."
    return
  fi
  echo ""
  echo "-- App '$app' dans '$dir' --"

  # Détermination du projectId attendu
  local expected_id=""
  if [ -f "$dir/.eas/project.json" ]; then
    expected_id=$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$dir/.eas/project.json','utf8')); console.log(j.projectId || '')")
  fi
  if [ -z "$expected_id" ]; then
    expected_id=$(cd "$dir" && npx expo config --type public --json 2>/dev/null | node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8')); console.log(j.extra?.eas?.projectId || '')")
  fi
  if [ -z "$expected_id" ]; then
    echo "  Aucun projectId trouvé pour $app, aucune correction possible."
    return
  fi
  echo "  projectId détecté: $expected_id"

  # Sauvegarde des fichiers de configuration
  for f in app.config.ts app.config.base.ts app.json eas.json; do
    if [ -f "$dir/$f" ]; then
      rel="${dir#$ROOT/}/$f"
      mkdir -p "$BACKUP/$(dirname "$rel")"
      cp -a "$dir/$f" "$BACKUP/$rel"
    fi
  done
  if [ -d "$dir/.eas" ]; then
    rel="${dir#$ROOT/}/.eas"
    mkdir -p "$BACKUP/$(dirname "$rel")"
    cp -a "$dir/.eas" "$BACKUP/$rel"
  fi

  # Collecte de tous les projectIds présents dans le monorepo
  ids=()
  while IFS= read -r -d '' file; do
    id=$(node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('$file','utf8')); console.log(j.projectId || '')")
    if [ -n "$id" ]; then ids+=("$id"); fi
  done < <(find "$ROOT/apps" -name project.json -print0)
  ids+=("$expected_id")

  # Remplacement des autres IDs par l'ID attendu dans les fichiers de config
  for file in app.config.ts app.config.base.ts app.json; do
    local p="$dir/$file"
    if [ -f "$p" ]; then
      for id in "${ids[@]}"; do
        if [ "$id" != "$expected_id" ] && [ -n "$id" ]; then
          sed -i "s/$id/$expected_id/g" "$p" || true
        fi
      done
    fi
  done

  # Écriture du .eas/project.json propre
  mkdir -p "$dir/.eas"
  cat > "$dir/.eas/project.json" <<EOF_JSON
{
  "accountName": "delishafrica",
  "projectName": "$app",
  "projectId": "$expected_id"
}
EOF_JSON

  # Mise à jour de eas.json pour gérer les peer deps
  local easjson="$dir/eas.json"
  if [ -f "$easjson" ]; then
    node -e "const fs = require('fs'); const file = '$easjson'; const profile='development'; const j = JSON.parse(fs.readFileSync(file,'utf8')); j.build=j.build||{}; j.build[profile]=j.build[profile]||{}; j.build[profile].env=Object.assign({},j.build[profile].env||{},{NPM_CONFIG_LEGACY_PEER_DEPS:'true',NPM_CONFIG_FUND:'false',NPM_CONFIG_AUDIT:'false',EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK:'1'}); fs.writeFileSync(file, JSON.stringify(j,null,2));" || true
  fi

  # Mise à jour éventuelle de .npmrc pour synchroniser EAS_PROJECT_ID
  local npmrc="$dir/.npmrc"
  if [ -f "$npmrc" ]; then
    # On sauvegarde le fichier avant modification s'il contient EAS_PROJECT_ID
    if grep -qE '^EAS_PROJECT_ID=' "$npmrc"; then
      rel_npm="${dir#$ROOT/}/.npmrc"
      mkdir -p "$BACKUP/$(dirname "$rel_npm")"
      cp -a "$npmrc" "$BACKUP/$rel_npm"
      # Remplacement de la valeur
      sed -i "s/^EAS_PROJECT_ID=.*/EAS_PROJECT_ID=$expected_id/" "$npmrc" || true
      echo "  .npmrc mis à jour pour EAS_PROJECT_ID=$expected_id"
    fi
  fi

  # Affichage de la configuration résolue
  echo "  Config après correction :"
  (cd "$dir" && npx expo config --type public --json 2>/dev/null | node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(0,'utf8')); console.log(JSON.stringify({ app:'$app', slug:j.slug, projectId:j.extra?.eas?.projectId }, null, 2));") || true
}

# Traitement de chaque application
for app in "${APPS[@]}"; do
  process_and_fix_app "$app"
done

# Nettoyage du .npmrc à la racine du monorepo si une variable EAS_PROJECT_ID y est définie.
ROOT_NPMRC="$ROOT/.npmrc"
if [ -f "$ROOT_NPMRC" ]; then
  if grep -qE '^EAS_PROJECT_ID=' "$ROOT_NPMRC"; then
    mkdir -p "$BACKUP/root_npmrc"
    cp -a "$ROOT_NPMRC" "$BACKUP/root_npmrc/.npmrc"
    sed -i '/^EAS_PROJECT_ID=/d' "$ROOT_NPMRC"
    echo "Le fichier racine .npmrc contenait une ligne EAS_PROJECT_ID qui a été supprimée pour éviter les conflits."
  fi
fi

echo ""
echo "==== Sentinel: résumé des modifications ===="
echo "Les éventuels répertoires en double ont été déplacés dans : $BACKUP"
echo "Les configurations des apps ont été réconciliées selon l'ID détecté."
echo "Vous pouvez maintenant lancer vos builds dans les répertoires : ${APPS[*]}"
