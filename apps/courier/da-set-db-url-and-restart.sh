# === da-set-db-url-and-restart.sh ===
set -euo pipefail

API_DIR="/opt/delishafrica/monorepo/services/api"
DB_NAME="delish"
DB_USER="postgres"
DB_PORT="5432"

echo "1) Détecter l'accès Postgres (host:port)…"
cd /opt/delishafrica/monorepo
HP="$(docker compose port db ${DB_PORT} 2>/dev/null | awk '{print $1}' || true)"
if [ -n "$HP" ]; then
  # format attendu: 0.0.0.0:5432 ou [::]:5432
  HOST="127.0.0.1"
  PORT="$(echo "$HP" | awk -F: '{print $NF}')"
else
  # Pas de port publié → on passe par l'IP du conteneur
  CID="$(docker compose ps -q db)"
  [ -n "$CID" ] || { echo "✖ Conteneur 'db' introuvable"; exit 1; }
  HOST="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$CID")"
  PORT="$DB_PORT"
fi
echo "   → DB détectée sur ${HOST}:${PORT}"

echo "2) Construire DATABASE_URL…"
DB_URL="postgresql://${DB_USER}@${HOST}:${PORT}/${DB_NAME}?schema=public"
echo "   → $DB_URL"

echo "3) Exporter pour la session + rendre persistant…"
export DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL securely before running}"
# persistance système (pour futurs shells)
echo "export DATABASE_URL='${DB_URL}'" >/etc/profile.d/delishafrica-db.sh

echo "4) (Re)générer Prisma client…"
cd "$API_DIR"
pnpm install --silent || true
pnpm prisma generate || npx prisma generate || true

echo "5) Redémarrer l'API (PM2) avec l'env à jour…"
if pm2 describe delish-api >/dev/null 2>&1; then
  pm2 restart delish-api --update-env
else
  # tente dist puis start:prod
  if [ -f "dist/main.js" ]; then
    DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL securely before running}"
  else
    DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL securely before running}"
  fi
fi
sleep 2

echo "6) Tests santé…"
echo "→ Local API (:4001)";  curl -sf http://127.0.0.1:3010/api/health && echo " (OK local)" || { echo "✖ KO local"; pm2 logs delish-api --lines 50; exit 1; }
echo "→ Nginx local (HTTPS + Host)"; curl -skI -H "Host: api.delishafrica.me" https://127.0.0.1/api/health | head -n1
echo "→ Public (Cloudflare)"; curl -svo /dev/null https://api.delishafrica.me/api/health 2>&1 | sed -n '1,12p'; echo; curl -s https://api.delishafrica.me/api/health && echo
