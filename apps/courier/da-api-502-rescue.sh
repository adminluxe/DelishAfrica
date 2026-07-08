# === da-api-502-rescue.sh ===
set -euo pipefail

echo "1) Ping API locale (bypass Nginx/Cloudflare)…"
if curl -sf http://127.0.0.1:3010/api/health >/dev/null; then
  echo "   ✔ API locale OK sur :4001"
else
  echo "   ✖ API locale KO → restart PM2 + deps"
  cd /opt/delishafrica/monorepo/services/api
  pnpm install --silent || true
  pm2 restart delish-api || pm2 start "pnpm --filter=services/api start:prod" --name delish-api
  sleep 2
  curl -sf http://127.0.0.1:3010/api/health && echo "   ✔ API locale OK après restart"
fi

echo "2) Vérifier Nginx (syntax + vhost)…"
nginx -t

echo "3) Afficher bloc /api/ du vhost…"
VHOST="/etc/nginx/sites-enabled/api.delishafrica.me.conf"
if [ -f "$VHOST" ]; then
  sed -n '/server_name/,/}/p' "$VHOST" | sed -n '1,200p'
else
  echo "   ⚠ Vhost introuvable: $VHOST"
fi

echo "4) (Ré)appliquer un vhost sain si nécessaire…"
# NB: on proxy en HTTP local vers 127.0.0.1:4001
cat >/etc/nginx/sites-available/api.delishafrica.me.conf <<'CONF'
server {
  listen 80;
  server_name api.delishafrica.me;

  location /api/ {
    proxy_pass http://127.0.0.1:3010/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;
  }

  location / {
    return 200 'OK';
    add_header Content-Type text/plain;
  }
}
CONF

ln -sf /etc/nginx/sites-available/api.delishafrica.me.conf /etc/nginx/sites-enabled/api.delishafrica.me.conf

echo "5) Reload Nginx…"
nginx -t && systemctl reload nginx

echo "6) Test HTTP (80) via Nginx local…"
curl -si http://127.0.0.1/api/health | sed -n '1,10p'

echo "7) Test public (Cloudflare/HTTPS)…"
curl -svo /dev/null https://api.delishafrica.me/api/health 2>&1 | sed -n '1,20p'
echo
echo "→ Si encore 502 :"
echo "   - Vérifie que Cloudflare pointe bien sur l'IP du VPS (A/AAAA),"
echo "   - ou repasse le proxy Cloudflare en 'gris' (DNS only) le temps du test."
