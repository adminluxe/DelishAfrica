set -euo pipefail

DOMAIN="api.delishafrica.me"
API_UPSTREAM="http://127.0.0.1:3010"

echo "1) Vérif API locale…"
if curl -sf ${API_UPSTREAM}/api/health >/dev/null; then
  echo "   ✔ API OK sur ${API_UPSTREAM}"
else
  echo "   ✖ API KO → restart PM2"
  cd /opt/delishafrica/monorepo/services/api
  pnpm install --silent || true
  pm2 restart delish-api || pm2 start "pnpm --filter=services/api start:prod" --name delish-api
  sleep 2
  curl -sf ${API_UPSTREAM}/api/health && echo "   ✔ API OK après restart"
fi

echo "2) Certificat auto-signé pour ${DOMAIN} (si absent)…"
mkdir -p /etc/nginx/ssl
if [ ! -s /etc/nginx/ssl/${DOMAIN}.crt ] || [ ! -s /etc/nginx/ssl/${DOMAIN}.key ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout /etc/nginx/ssl/${DOMAIN}.key \
    -out /etc/nginx/ssl/${DOMAIN}.crt \
    -subj "/CN=${DOMAIN}"
fi
chmod 600 /etc/nginx/ssl/${DOMAIN}.key

echo "3) Vhost Nginx 80/443 pour ${DOMAIN}…"
cat >/etc/nginx/sites-available/${DOMAIN}.conf <<'CONF'
server {
  listen 80;
  server_name api.delishafrica.me;
  # Option: redir HTTP->HTTPS pour tout
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.delishafrica.me;

  ssl_certificate     /etc/nginx/ssl/api.delishafrica.me.crt;
  ssl_certificate_key /etc/nginx/ssl/api.delishafrica.me.key;

  # Paramètres TLS minimaux
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  # Proxy API
  location /api/ {
    proxy_pass http://127.0.0.1:3010/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300s;

    # CORS (optionnel)
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE" always;
    add_header Access-Control-Allow-Headers "*" always;
    if ($request_method = OPTIONS) { return 204; }
  }

  # Sanity route
  location = / {
    return 200 'OK';
    add_header Content-Type text/plain;
  }
}
CONF

ln -sf /etc/nginx/sites-available/${DOMAIN}.conf /etc/nginx/sites-enabled/${DOMAIN}.conf

echo "4) Test & reload Nginx…"
nginx -t
systemctl reload nginx

echo "5) Test local CORRECT (avec Host) en HTTP (80 via redir HTTPS attendu)…"
curl -si -H "Host: ${DOMAIN}" http://127.0.0.1/api/health | sed -n '1,8p'

echo "6) Test local HTTPS (self-signed) avec Host (on ignore le cert: -k)…"
curl -ski -H "Host: ${DOMAIN}" https://127.0.0.1/api/health | sed -n '1,12p'

echo "7) Test public (Cloudflare) :"
curl -svo /dev/null https://${DOMAIN}/api/health 2>&1 | sed -n '1,20p'
echo "→ Si encore 525/526/SSL error : mets Cloudflare SSL en 'Full' (pas Strict)."
