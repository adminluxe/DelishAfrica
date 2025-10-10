#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

# Configure the DATABASE_URL in backend/.env with user-provided credentials.
#
# This script prompts for PostgreSQL connection parameters, constructs a
# DATABASE_URL, and writes it to backend/.env. Use it from the root of
# the delishafrica-monorepo. You can run it again to overwrite the
# existing .env file.

set -e

echo "\n=== DelishAfrica Database Configuration ==="

read -rp "PostgreSQL user: " PGUSER
read -rsp "Password for $PGUSER: " PGPASS
echo
read -rp "Host [localhost]: " PGHOST
read -rp "Database name [delishafrica]: " PGDB

# Set defaults if inputs are empty
PGHOST=${PGHOST:-localhost}
PGDB=${PGDB:-delishafrica}

DATABASE_URL="postgresql://${PGUSER}:${PGPASS}@${PGHOST}:5432/${PGDB}"

# Ensure backend directory exists
if [ ! -d backend ]; then
  echo "Error: backend directory not found. Run this script from the root of the monorepo."
  exit 1
fi

echo "DATABASE_URL=\"${DATABASE_URL}\"" > backend/.env
echo "✔ backend/.env updated with DATABASE_URL"

echo "You can now run migrations with: pnpm --filter backend prisma migrate dev --name init"
