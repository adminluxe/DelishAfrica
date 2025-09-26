#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

DB_USER="${DB_USER:-luxeevents_user}"
DB_NAME="${DB_NAME:-delishafrica}"
DB_PASS="${DB_PASS:-devpass}"

# Détecte le port (5433 très probable chez toi)
if ss -ltn | grep -q ':5433'; then PGPORT=5433; else PGPORT=5432; fi

echo "→ Using port      : $PGPORT"
echo "→ Database        : $DB_NAME"
echo "→ Role (owner)    : $DB_USER"

# Astuce: pas de -h -> socket UNIX => pas de mot de passe
PSQL="sudo -u postgres psql -p $PGPORT -v ON_ERROR_STOP=1 -qAt"

# 0) S'assure que le rôle existe + mdp (au cas où)
$PSQL -d postgres -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER';" | grep -q 1 || \
  $PSQL -d postgres -c "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
$PSQL -d postgres -c "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"

# 1) Met l'OWNER correctement
$PSQL -d postgres -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO $DB_USER;"

# 2) Réassigne la propriété de tous les objets (créés avant) à $DB_USER
$PSQL -d "$DB_NAME" -c "REASSIGN OWNED BY postgres TO $DB_USER;"

# 3) Droits complets sur le schéma et objets existants
$PSQL -d "$DB_NAME" -c "GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "GRANT USAGE, CREATE ON SCHEMA public TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;"

# 4) Par défaut pour les futurs objets
$PSQL -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;"
$PSQL -d "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $DB_USER;"

# 5) Edge case: _prisma_migrations encore mauvais owner → force
$PSQL -d "$DB_NAME" -c "ALTER TABLE IF EXISTS _prisma_migrations OWNER TO $DB_USER;"

echo "✓ Ownership & grants OK"
