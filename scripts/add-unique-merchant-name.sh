#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -euo pipefail

SCHEMA="services/api/prisma/schema.prisma"

if [[ ! -f "$SCHEMA" ]]; then
  echo "❌ Fichier introuvable: $SCHEMA"
  exit 1
fi

# Backup horodaté
BACKUP="${SCHEMA}.bak.$(date +%F_%H%M%S)"
cp "$SCHEMA" "$BACKUP"
echo "🗂  Backup créé: $BACKUP"

# Injecte @@unique([merchantId, name], name: "merchantId_name") si absent
awk '
BEGIN{in_model=0; has_unique=0}
# Début du modèle MenuItem
/model[ \t]+MenuItem[ \t]*\{/ {in_model=1}
# Détecte si la ligne d unique existe déjà (peu importe l espace)
/@@unique\(\[ *merchantId *, *name *\]/ { if(in_model) has_unique=1 }
# Fin du modèle : insère juste avant la } si pas présent
in_model && /^\}/ {
  if(!has_unique){
    print "  @@unique([merchantId, name], name: \"merchantId_name\")"
  }
  in_model=0; has_unique=0
}
{print}
' "$SCHEMA" > "${SCHEMA}.tmp" && mv "${SCHEMA}.tmp" "$SCHEMA"

echo "🧩 Index unique injecté (si absent)."

# Format du schéma
pnpm -F @delish/api exec prisma format

# Migration
pnpm -F @delish/api exec prisma migrate dev -n "menuitem_unique_merchant_name"

# Regenerate client
pnpm -F @delish/api exec prisma generate

echo "✅ Fini : index unique en place, migration appliquée."
