#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -euo pipefail

ROOT="${ROOT:-$HOME/delishafrica-monorepo}"
API_DIR="${API_DIR:-$ROOT/services/api}"
ECO="${ECO:-$ROOT/ecosystem.delish-api.config.js}"

DBPORT="${DBPORT:-5433}"
DBHOST="${DBHOST:-127.0.0.1}"
DBUSER="${DBUSER:-postgres}"
DBNAME="${DBNAME:-postgres}"
DBPASS="${DBPASS:-DelishLocal_2025!}" # override: DBPASS='xxx' ./scripts/ensure_db_password.sh

echo "→ Ensuring postgres password for ${DBUSER}@${DBHOST}:${DBPORT}/${DBNAME}"

# 1) Si Postgres est exposé par Docker sur DBPORT, on altère le mdp depuis le conteneur
CID="$(command -v docker >/dev/null 2>&1 && docker ps --filter "publish=${DBPORT}" --format '{{.ID}}' | head -n1 || true)"
if [[ -n "${CID:-}" ]]; then
  echo "→ Docker detected (container: $CID) – setting password via docker exec"
  docker exec -u postgres "$CID" psql -U postgres -d postgres -c "ALTER USER ${DBUSER} WITH PASSWORD '${DBPASS}';" >/dev/null
else
  echo "→ No Docker container detected on port ${DBPORT}. Trying TCP with provided password…"
  if ! PGPASSWORD="${DBPASS}" psql -h "${DBHOST}" -p "${DBPORT}" -U "${DBUSER}" -d "${DBNAME}" -c 'select 1;' >/dev/null 2>&1; then
    echo "!! Connexion échouée. Installe psql et/ou ajuste pg_hba.conf si nécessaire."
    exit 1
  fi
fi

# 2) Test
echo "→ Testing connection"
PGPASSWORD="${DBPASS}" psql -h "${DBHOST}" -p "${DBPORT}" -U "${DBUSER}" -d "${DBNAME}" -c 'select now(), current_user;' | sed -n '1,5p'

# 3) Aligne DATABASE_URL (.env + PM2 ecosystem)
echo "→ Sync DATABASE_URL in ${API_DIR}/.env and ${ECO}"
URL="postgresql://${DBUSER}:${DBPASS}@localhost:${DBPORT}/${DBNAME}?schema=public"
mkdir -p "${API_DIR}"
touch "${API_DIR}/.env"
awk -v url="$URL" 'BEGIN{FS=OFS="="}
  $1=="DATABASE_URL"{print "DATABASE_URL",url;found=1;next}
  {print}
  END{if(!found)print "DATABASE_URL="url}
' "${API_DIR}/.env" > "${API_DIR}/.env.tmp" && mv "${API_DIR}/.env.tmp" "${API_DIR}/.env"

sed -i "s#^\(\s*DATABASE_URL:\s*\).*#\1'${URL}'#" "${ECO}" 2>/dev/null || true

# 4) Build + restart API
echo "→ Build + restart delish-api"
pnpm -C "${API_DIR}" build
pm2 delete delish-api >/dev/null 2>&1 || true
pm2 start "${ECO}" --only delish-api
sleep 1
pm2 logs delish-api --lines 10

# 5) Health
echo "→ Health"
curl -sS "http://localhost:${PORT:-4001}/api/health" | jq .
