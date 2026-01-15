#!/usr/bin/env bash
# Script de nettoyage des écrans de test du scroll (DelishAfrica monorepo)
# Ce script supprime les fichiers de test de scroll obsolètes et nettoie les références associées, avec sauvegarde des éléments supprimés.

TARGET_DIR="/opt/delishafrica/monorepo"
APPS_DIRS="apps/client apps/courier apps/merchant"

# Vérification de l'existence du répertoire cible
if [ ! -d "$TARGET_DIR" ]; then
  echo "Erreur : le répertoire $TARGET_DIR est introuvable."
  exit 1
fi

# Se placer dans le répertoire du monorepo
cd "$TARGET_DIR" || exit 1

# Création d'un dossier de sauvegarde avec horodatage
backup_dir="scrolltester_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

# Liste des noms de fichiers à supprimer (anciens écrans de scroll)
files_to_remove=( "scroll-tester.tsx" "ScrollTester.tsx" "ScrollProbe.tsx" "scroll-probe.tsx" "probe.tsx" )

# Parcours de chaque nom de fichier cible
for filename in "${files_to_remove[@]}"; do
  # Recherche des fichiers correspondants dans les apps concernées
  find $APPS_DIRS -type f -name "$filename" -print0 | while IFS= read -r -d $'\0' file; do
    # Sauvegarde du fichier (en conservant l'arborescence d'origine) puis suppression
    mkdir -p "$backup_dir/$(dirname "$file")"
    cp --parents "$file" "$backup_dir" 2>/dev/null  # --parents conserve l'arborescence d'origine:contentReference[oaicite:0]{index=0}
    rm -f "$file"
    echo "Supprimé : $file (backup dans $backup_dir/$file)"
  done
done

# Recherche et nettoyage des références (imports, liens, etc.) restantes
# On cible les motifs de texte correspondant aux fichiers supprimés.
patterns="scroll-tester|ScrollTester|ScrollProbe|scroll-probe|app/probe"
grep -RIlE "$patterns" $APPS_DIRS | while IFS= read -r file; do
  mkdir -p "$backup_dir/$(dirname "$file")"
  cp "$file" "$backup_dir/$file"
  sed -i -e '/scroll-tester/d' \
         -e '/ScrollTester/d' \
         -e '/ScrollProbe/d' \
         -e '/scroll-probe/d' \
         -e '/app\/probe/d' "$file"
  echo "Nettoyé références dans : $file"
done

echo "✅ Nettoyage terminé. Les fichiers supprimés sont sauvegardés dans $backup_dir."
