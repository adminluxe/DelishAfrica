#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail
API_DIR="services/api"
pushd "$API_DIR" >/dev/null

ts=$(date +%Y%m%d-%H%M%S)
mkdir -p backups/env
[ -f prisma/.env ] && cp prisma/.env "backups/env/prisma.env.$ts" || true
[ -f .env ] && cp .env "backups/env/dotenv.$ts" || true

# -- Normalise prisma/.env : supprime BOM + CRLF, trim
perl -0777 -pe 's/^\x{FEFF}//; s/\r//g' prisma/.env > prisma/.env.norm
mv prisma/.env.norm prisma/.env

# -- Récupère DATABASE_URL
DB="$(grep -E '^DATABASE_URL=' -m1 prisma/.env | sed 's/^DATABASE_URL=//')"
DB="${DB#"${DB%%[![:space:]]*}"}"; DB="${DB%"${DB##*[![:space:]]}"}" # trim

# -- Tentatives d’auto-fix si préfixes connus
if [[ -n "$DB" ]]; then
  DB="${DB// /}"  # pas d'espace
  DB="$(printf '%s' "$DB" | sed -E 's|^jdbc:postgresql://|postgresql://|')"
  DB="$(printf '%s' "$DB" | sed -E 's|^postgresql\+[^:]*://|postgresql://|')"
fi

# -- Vérif protocole
if [[ -z "$DB" || ! "$DB" =~ ^postgres(ql)?:// ]]; then
  echo "❌ DATABASE_URL invalide dans services/api/prisma/.env"
  echo "   Exemple attendu : postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public"
  echo "   Contenu actuel  : ${DB:-<vide>}"
  exit 1
fi

# -- Réécrit proprement la ligne dans prisma/.env (sans doublons)
grep -vE '^DATABASE_URL=' prisma/.env > prisma/.env.tmp || true
printf 'DATABASE_URL=%s\n' "$DB" >> prisma/.env.tmp
mv prisma/.env.tmp prisma/.env

# -- Purge DATABASE_URL de services/api/.env pour éviter tout override
if [ -f .env ]; then
  grep -vE '^DATABASE_URL=' .env > .env.tmp || true
  mv .env.tmp .env
fi

echo "✓ DATABASE_URL validé : $(printf '%s' "$DB" | sed 's/:[^:@/]*@/:***@/')"  # masque éventuel mot de passe
popd >/dev/null
