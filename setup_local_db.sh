#!/usr/bin/env bash
set -euo pipefail

DB_NAME="delishafrica_dev"
DB_USER="delish_user"
DB_PASS="delish_password_strong"
DB_HOST="localhost"
DB_PORT="5432"

echo "→ Vérification PostgreSQL local sur ${DB_HOST}:${DB_PORT}"
pg_isready -h "$DB_HOST" -p "$DB_PORT"

echo "→ Création rôle si absent"
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'"

echo "→ Création base si absente"
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"

echo "→ Droits"
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER}"

echo "✅ DB prête: ${DB_NAME} (user: ${DB_USER})"
