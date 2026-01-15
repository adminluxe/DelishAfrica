#!/usr/bin/env bash
set -euo pipefail

DOMAIN="api.delishafrica.me"
ORIGIN="http://127.0.0.1:3010"

ROOT="/opt/delishafrica/monorepo"
SCRIPTS="$ROOT/scripts"

green(){ echo -e "\033[0;32m✅ $*\033[0m"; }
yellow(){ echo -e "\033[0;33m⚠️  $*\033[0m"; }
red(){ echo -e "\033[0;31m❌ $*\033[0m"; }

if [ "$(id -u)" -ne 0 ]; then
  red "Lance en root."
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"

echo "== (0) Snapshot (si dispo) =="
if [ -x "$SCRIPTS/da_snapshot.sh" ]; then
  bash "$SCRIPTS/da_snapshot.sh" || true
else
  yellow "da_snapshot.sh introuvable -> skip."
fi

echo "== (1) Fix Cloudflared (hostname + origin + service) =="
CF="$(command -v cloudflared || true)"
if [ -z "${CF}" ]; then
  red "cloudflared introuvable. Installe/verify cloudflared puis relance."
  exit 1
fi

CFDIR="/root/.cloudflared"
CFG="$CFDIR/config.yml"
mkdir -p "$CFDIR"

TUNNEL_NAME="delish-api"
TUNNEL_ID="$($CF tunnel list 2>/dev/null | awk 'NR>1 && $2=="'"$TUNNEL_NAME"'"{print $1; exit}' || true)"

if [ -z "$TUNNEL_ID" ] && [ -f "$CFG" ]; then
  TUNNEL_ID="$(awk '/^tunnel:/{print $2; exit}' "$CFG" || true)"
fi

if [ -z "$TUNNEL_ID" ]; then
  yellow "Tunnel '$TUNNEL_NAME' non trouvé. Tentative de création (nécessite login Cloudflare)."
  $CF tunnel create "$TUNNEL_NAME" || true
  TUNNEL_ID="$($CF tunnel list 2>/dev/null | awk 'NR>1 && $2=="'"$TUNNEL_NAME"'"{print $1; exit}' || true)"
fi

if [ -z "$TUNNEL_ID" ]; then
  red "Impossible d’identifier le tunnel. Fais: cloudflared tunnel list"
  exit 1
fi
green "Tunnel ID: $TUNNEL_ID"

CRED="$CFDIR/${TUNNEL_ID}.json"
if [ ! -f "$CRED" ]; then
  CRED="$(ls -1 "$CFDIR"/*.json 2>/dev/null | grep -F "$TUNNEL_ID" | head -n 1 || true)"
fi
if [ -z "$CRED" ] || [ ! -f "$CRED" ]; then
  red "Credentials introuvables pour $TUNNEL_ID dans $CFDIR"
  ls -la "$CFDIR" || true
  exit 1
fi

if [ -f "$CFG" ]; then
  cp -a "$CFG" "$CFG.bak.$TS"
fi

cat > "$CFG" <<EOCFG
tunnel: $TUNNEL_ID
credentials-file: $CRED

ingress:
  - hostname: $DOMAIN
    service: $ORIGIN
  - service: http_status:404
EOCFG

chmod 600 "$CFG" "$CRED" || true

echo "== DNS route (overwrite) =="
# "route dns" crée/écrase un CNAME vers le tunnel 
$CF tunnel route dns --overwrite-dns "$TUNNEL_ID" "$DOMAIN" || $CF tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$DOMAIN" || true

SERVICE="/etc/systemd/system/cloudflared-delish-api.service"
if [ -f "$SERVICE" ]; then
  cp -a "$SERVICE" "$SERVICE.bak.$TS"
fi

cat > "$SERVICE" <<EOSVC
[Unit]
Description=Cloudflared Tunnel (delish-api) for DelishAfrica API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=$CF --config $CFG tunnel run
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOSVC

systemctl daemon-reload
systemctl enable --now cloudflared-delish-api.service
systemctl restart cloudflared-delish-api.service
sleep 2

echo "== Cloudflared service (short) =="
if systemctl is-active --quiet cloudflared-delish-api.service; then
  green "cloudflared-delish-api.service ACTIVE"
else
  yellow "cloudflared-delish-api.service NOT active"
fi
systemctl --no-pager -l status cloudflared-delish-api.service | sed -n '1,16p' || true

echo "== Test remote health (doit être 200) =="
REMOTE_CODE="$(curl -sk -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/health" || true)"
echo "https://$DOMAIN/api/health -> $REMOTE_CODE"

echo "== (2) Patch API container: ajoute /api/partners et /api/partners/thieyp =="
API_CONTAINER="$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E '(:|0.0.0.0:)4001->|:4001/' | head -n 1 | awk '{print $1}' || true)"
if [ -z "$API_CONTAINER" ]; then
  yellow "Aucun container exposant 4001 trouvé. Skip patch partners."
else
  green "API container: $API_CONTAINER"
  WD="$(docker inspect -f '{{.Config.WorkingDir}}' "$API_CONTAINER" 2>/dev/null || true)"
  if [ -z "$WD" ] || [ "$WD" = "<no value>" ]; then WD="/usr/src/app"; fi
  echo "WorkingDir: $WD"

  MAIN_JS=""
  for cand in "$WD/dist/main.js" "$WD/dist/src/main.js" "/usr/src/app/dist/main.js" "/app/dist/main.js"; do
    if docker exec "$API_CONTAINER" sh -lc "test -f '$cand'"; then MAIN_JS="$cand"; break; fi
  done
  if [ -z "$MAIN_JS" ]; then
    MAIN_JS="$(docker exec "$API_CONTAINER" sh -lc "find '$WD' -maxdepth 6 -type f -path '*/dist/*' -name 'main.js' 2>/dev/null | head -n 1" || true)"
  fi

  if [ -z "$MAIN_JS" ]; then
    yellow "Impossible de trouver dist/main.js dans le container. Skip patch partners."
  else
    green "main.js trouvé: $MAIN_JS"
    TMP="/tmp/delish_main.js.$TS"
    docker cp "$API_CONTAINER:$MAIN_JS" "$TMP"

    python3 - <<'PY' "$TMP"
import sys, re, pathlib
p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8", errors="ignore")

marker = "DELISHAFRICA_DEMO_PARTNERS_PATCH_BEGIN"
if marker in s:
    print("Already patched.")
    sys.exit(0)

snippet = r"""
// DELISHAFRICA_DEMO_PARTNERS_PATCH_BEGIN
try {
  const http = app.getHttpAdapter().getInstance();
  const partners = [
    { "id":"thieyp", "slug":"thieyp", "name":"Thieyp", "city":"Bruxelles", "cuisine":"Sénégalaise", "featured": true },
    { "id":"afrifood", "slug":"afrifood", "name":"AfriFood", "city":"Bruxelles", "cuisine":"Mix", "featured": false }
  ];
  http.get("/api/partners", (_req, res) => res.json(partners));
  http.get("/api/partners/thieyp", (_req, res) => res.json(partners.find(p => p.slug === "thieyp") || partners[0]));
} catch (e) {}
// DELISHAFRICA_DEMO_PARTNERS_PATCH_END
"""

m = re.search(r"\n\s*await\s+app\.listen\(", s)
if not m:
    m = re.search(r"\n\s*app\.listen\(", s)

idx = m.start() if m else s.rfind("}")
if idx < 0:
    idx = len(s)

p.write_text(s[:idx] + snippet + s[idx:], encoding="utf-8")
print("Patched.")
PY

    docker exec "$API_CONTAINER" sh -lc "cp -a '$MAIN_JS' '$MAIN_JS.bak.$TS'"
    docker cp "$TMP" "$API_CONTAINER:$MAIN_JS"

    echo "== Restart API container =="
    docker restart "$API_CONTAINER" >/dev/null
    sleep 2
  fi
fi

echo "== (3) Tests finaux (attendu: 200 partout) =="
URLS=(
  "http://127.0.0.1:3010/api/health"
  "http://127.0.0.1:3010/api/partners"
  "http://127.0.0.1:3010/api/partners/thieyp"
  "https://$DOMAIN/api/health"
  "https://$DOMAIN/api/partners"
  "https://$DOMAIN/api/partners/thieyp"
)

for u in "${URLS[@]}"; do
  code="$(curl -sk -o /dev/null -w "%{http_code}" "$u" || true)"
  echo "$u -> $code"
done

echo
green "FIN. Si tu vois 200/200/200 en local + 200/200/200 en remote => Chapitre A VERROUILLÉ ✅"
