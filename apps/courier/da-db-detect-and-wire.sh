# === da-db-detect-and-wire.sh ===
set -euo pipefail

COMPOSE_DIR="/opt/delishafrica/monorepo"
API_DIR="/opt/delishafrica/monorepo/services/api"
DB_NAME="delish"
DB_USER="postgres"
DB_PORT="5432"

echo "1) S'assurer que la DB tourne…"
cd "$COMPOSE_DIR"
docker compose up -d db >/dev/null

CID="$(docker compose ps -q db)"
[ -n "$CID" ] || { echo "✖ Conteneur 'db' introuvable"; exit 1; }

echo "2) Récupérer IP interne du conteneur…"
DB_HOST="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$CID")"
[ -n "$DB_HOST" ] || { echo "✖ IP du conteneur db introuvable"; exit 1; }
echo "   → DB @ ${DB_HOST}:${DB_PORT}"

echo "3) Récupérer mot de passe éventuel…"
DB_PASS="$(docker exec -T "$CID" printenv POSTGRES_PASSWORD 2>/dev/null || true)"
if [ -n "${DB_PASS:-}" ]; then
  AUTH="${DB_USER}:${DB_PASS}"
else
  AUTH="${DB_USER}"
fi

echo "4) Construire DATABASE_URL…"
DB_URL="postgresql://${AUTH}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
echo "   → ${DB_URL}"

echo "5) Exporter pour la session + persister (profile + .env)…"
export DATABASE_URL="$DB_URL"
echo "export DATABASE_URL='${DB_URL}'" >/etc/profile.d/delishafrica-db.sh
echo "DATABASE_URL='${DB_URL}'" > "${API_DIR}/.env"

echo "6) Vérifier que Postgres écoute (depuis le conteneur)…"
docker exec -T "$CID" pg_isready -h 127.0.0.1 -p 5432 || true

echo "7) (Re)générer Prisma client + rebuild + restart PM2…"
cd "$API_DIR"
pnpm install --silent || true
pnpm prisma generate || npx prisma generate || true
pnpm build || true

if pm2 describe delish-api >/dev/null 2>&1; then
  pm2 restart delish-api --update-env
else
  if [ -f "dist/main.js" ]; then
    DATABASE_URL="$DB_URL" pm2 start "node dist/main.js" --name delish-api
  else
    DATABASE_URL="$DB_URL" pm2 start "pnpm start:prod" --name delish-api
  fi
fi

echo "8) Tests santé…"
echo "→ Local API (:4001)";  curl -sf http://127.0.0.1:3010/api/health && echo " (OK local)" || { echo "✖ KO local"; pm2 logs delish-api --lines 80; exit 1; }
echo "→ Nginx local (HTTPS + Host)"; curl -skI -H "Host: api.delishafrica.me" https://127.0.0.1/api/health | head -n1
echo "→ Public (Cloudflare)"; curl -svo /dev/null https://api.delishafrica.me/api/health 2>&1 | sed -n '1,12p'; echo; curl -s https://api.delishafrica.me/api/health && echo
