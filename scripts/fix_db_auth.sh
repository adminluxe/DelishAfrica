#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
# ~/delishafrica-monorepo/scripts/fix_db_auth.sh
#!/usr/bin/env bash
set -euo pipefail

API_DIR="$HOME/delishafrica-monorepo/services/api"
DB_NAME="delishafrica_dev"
DB_USER="luxeevents_user"
DB_PASS="devpass"
DB_HOST="localhost"
DB_PORT="5432"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

echo "→ 1) Unifier l'ENV Prisma"
mkdir -p "$API_DIR/prisma"
# Déplace/force DATABASE_URL dans prisma/.env comme source unique
cat > "$API_DIR/prisma/.env" <<EOF
DATABASE_URL="${DB_URL}"
EOF

# Commente DATABASE_URL dans services/api/.env s'il existe (évite les conflits Prisma)
if [ -f "$API_DIR/.env" ] && grep -q '^DATABASE_URL=' "$API_DIR/.env"; then
  sed -i 's/^DATABASE_URL=.*/# DATABASE_URL déplacé vers prisma\/.env/' "$API_DIR/.env"
fi
echo "✓ prisma/.env prêt"

echo "→ 2) (Re)créer l’utilisateur & les droits dans Postgres (sudo requis)"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}') THEN
    CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
  END IF;
END
\$\$;

ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER ROLE ${DB_USER} CREATEDB; -- pratique pour Prisma shadow DB en dev
SQL

# Assure la propriété du schema public
sudo -u postgres psql -d "$DB_NAME" -c "ALTER SCHEMA public OWNER TO ${DB_USER};" >/dev/null
echo "✓ Utilisateur/DB/Schema OK"

echo "→ 3) Test de connexion applicative"
psql "${DB_URL}" -c "\conninfo" >/dev/null && echo "✓ Connexion DB OK (${DB_USER}@${DB_NAME})"

echo "→ 4) Prisma generate + migrate (dev)"
export DATABASE_URL="$(grep ^DATABASE_URL "$API_DIR/prisma/.env" | cut -d'"' -f2)"
pnpm -C "$API_DIR" exec prisma generate
pnpm -C "$API_DIR" exec prisma migrate dev --name init_local --skip-seed

echo "→ 5) (Re)démarrer l'API au port 4001 avec l'env chargé depuis prisma/.env"
pm2 delete delish-api >/dev/null 2>&1 || true
# On source prisma/.env pour garantir le bon DATABASE_URL
pm2 start "bash -lc 'cd $API_DIR && set -a; . prisma/.env; set +a; PORT=4001 pnpm exec ts-node --transpile-only src/main.ts'" --name delish-api --time
pm2 save

echo "→ 6) Healthcheck"
sleep 1
curl -fsS http://localhost:4001/api/health && echo && echo "✓ API OK sur :4001"
