#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

# ---- Paramètres (change si tu veux d'autres noms) ----
DB_USER="${DB_USER:-luxeevents_user}"
DB_PASS="${DB_PASS:-devpass}"
DB_NAME="${DB_NAME:-delishafrica}"
DB_HOST="${DB_HOST:-localhost}"
# Détecte 5433 (très probable chez toi) sinon 5432
if ss -ltn | grep -q ':5433'; then PGPORT=5433; else PGPORT=5432; fi

echo "→ Postgres port: $PGPORT"
echo "→ Target DB    : $DB_NAME"
echo "→ Target USER  : $DB_USER"

# ---- Vérifie Postgres écoute ----
if ! ss -ltn | grep -q ":$PGPORT"; then
  echo "❌ Postgres n'écoute pas sur $PGPORT. Démarre-le puis relance ce script."; exit 1
fi

# ---- psql helper (superuser) ----
PSQL_SUPER="sudo -n -u postgres psql -h $DB_HOST -p $PGPORT -v ON_ERROR_STOP=1 -qAt"

# ---- Crée/MAJ le rôle ----
$PSQL_SUPER -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER';" | grep -q 1 || \
  $PSQL_SUPER -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
# (force un password propre si déjà existant)
$PSQL_SUPER -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"

# ---- Crée la DB si besoin & droits ----
if ! $PSQL_SUPER -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -q 1; then
  $PSQL_SUPER -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi
# Droits sur le schéma public
sudo -n -u postgres psql -h "$DB_HOST" -p "$PGPORT" -d "$DB_NAME" -v ON_ERROR_STOP=1 -qAt \
  -c "GRANT ALL ON SCHEMA public TO $DB_USER; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;"

# ---- Compose la DATABASE_URL ----
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@$DB_HOST:$PGPORT/$DB_NAME?schema=public"
echo "→ DATABASE_URL=$DATABASE_URL"

# ---- Prisma generate + schema ----
pnpm -C services/api exec prisma generate
# Déploie les migrations si présentes, sinon pousse le schema
pnpm -C services/api exec prisma migrate deploy || pnpm -C services/api exec prisma db push

# ---- Build + PM2 (dev) ----
pnpm -C services/api build
pm2 delete delish-api >/dev/null 2>&1 || true
NODE_ENV=development PORT=4001 DATABASE_URL="$DATABASE_URL" \
pm2 start services/api/dist/main.js --name delish-api --time --update-env
pm2 save

# ---- Vérifs ----
echo
echo "→ Vérifs:"
ss -ltnp | grep ':4001' || echo "(port 4001 fermé)"
curl -sS http://127.0.0.1:4001/api/health || true
pm2 logs delish-api --lines 100 | egrep 'ENTRY|BOOT|CORS|API up|Swagger|Prisma' || true
