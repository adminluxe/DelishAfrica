#!/usr/bin/env bash
set -euo pipefail
SCHEMA="services/api/prisma/schema.prisma"
grep -q "model Merchant" "$SCHEMA" || { echo "❌ Merchant introuvable dans $SCHEMA"; exit 1; }
grep -qE '^\s*phone\s+String\??' "$SCHEMA" || {
  # Ajoute phone String? juste après name si présent, sinon à la fin du modèle
  awk '
    BEGIN{inM=0}
    /model[ \t]+Merchant[ \t]*\{/ {inM=1}
    inM && /name[ \t]+String/ && !added {print; print "  phone     String?"; added=1; next}
    inM && /\}/ && !added {print "  phone     String?"; added=1}
    {print}
  ' "$SCHEMA" > "$SCHEMA.tmp" && mv "$SCHEMA.tmp" "$SCHEMA"
  echo "✅ phone String? ajouté dans Merchant"
}
pnpm -C services/api add -D prisma@latest
pnpm -C services/api exec prisma migrate dev --name add_merchant_phone
pnpm -C services/api exec prisma generate
echo "✅ migration & generate ok"
