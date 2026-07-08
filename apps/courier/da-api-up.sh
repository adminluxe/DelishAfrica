# === da-api-up.sh ===
set -euo pipefail

API_DIR="/opt/delishafrica/monorepo/services/api"
API_HEALTH_LOCAL="http://127.0.0.1:3010/api/health"
PUBLIC_HEALTH="https://api.delishafrica.me/api/health"

echo "1) Vérif stack DB/Redis via docker compose…"
cd /opt/delishafrica/monorepo
docker compose ps
echo
echo "→ (Re)démarrage DB/Redis si arrêtés…"
docker compose up -d db redis || true
sleep 2

echo "2) (Re)lancer l'API (PM2)…"
cd "$API_DIR"
# Dépendances (tolère warnings)
pnpm install --silent || true

# Build si présent, mais on ne bloque pas si TS gêne
pnpm build || true

# (Re)démarrage PM2
if pm2 describe delish-api >/dev/null 2>&1; then
  pm2 restart delish-api
else
  # Remplace par la vraie commande de start prod si besoin
  # Exemple classique NestJS:
  pm2 start "node dist/main.js" --name delish-api || pm2 start "pnpm start:prod" --name delish-api
fi
sleep 2

echo "→ Logs courts (10 lignes) :"
pm2 logs delish-api --lines 10 || true

echo "3) Attente active de l’API locale :4001 (max 20s)…"
ok=""
for i in {1..20}; do
  if curl -sf "$API_HEALTH_LOCAL" >/dev/null; then ok="yes"; break; fi
  sleep 1
done
if [ -z "$ok" ]; then
  echo "✖ L’API ne répond pas sur :4001. Aide au diagnostic ci-dessous :" >&2
  echo "→ Port 4001 occupé ?"
  ss -lntp | grep :4001 || true
  echo "→ Logs PM2 (100 lignes) :"
  pm2 logs delish-api --lines 100 || true
  echo "→ Conteneurs :"
  docker compose ps || true
  exit 1
fi
echo "✔ API locale OK sur :4001"

echo "4) Test Nginx (vhost) en HTTP→HTTPS puis HTTPS local…"
curl -si -H "Host: api.delishafrica.me" http://127.0.0.1/api/health | sed -n '1,4p' || true
curl -skI -H "Host: api.delishafrica.me" https://127.0.0.1/api/health | sed -n '1,4p' || true

echo "5) Test public (Cloudflare)…"
curl -svo /dev/null "$PUBLIC_HEALTH" 2>&1 | sed -n '1,12p'
echo
curl -s "$PUBLIC_HEALTH" && echo || true

echo "→ Si le public n’est pas 200 mais la locale oui : regarde règles Cloudflare/Firewall."
