#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-api.delishafrica.me}"
CFG="${CFG:-/root/.cloudflared/config.yml}"
SERVICE_NAME="${SERVICE_NAME:-cloudflared-delish-api.service}"
TUNNEL_NAME="${TUNNEL_NAME:-delish-api}"

die(){ echo "❌ $*" >&2; exit 1; }

echo "== DelishAfrica | Cloudflared API Fix (v3) =="
echo "DOMAIN: $DOMAIN"
echo "CFG: $CFG"
echo "SERVICE: $SERVICE_NAME"
echo "TUNNEL_NAME hint: $TUNNEL_NAME"

command -v cloudflared >/dev/null 2>&1 || die "cloudflared introuvable"

TUNNEL_ID=""
if [ -f "$CFG" ]; then
  TUNNEL_ID="$(grep -E '^[[:space:]]*tunnel:' "$CFG" | awk '{print $2}' | tr -d '\r' || true)"
fi

if [ -z "${TUNNEL_ID:-}" ]; then
  TUNNEL_ID="$(cloudflared tunnel list 2>/dev/null | awk -v name="$TUNNEL_NAME" '$2==name {print $1; exit}' || true)"
fi

if [ -z "${TUNNEL_ID:-}" ]; then
  echo "❌ Impossible d’identifier le tunnel via config ou tunnel list." >&2
  echo "➡️  Lance: cloudflared tunnel list" >&2
  exit 2
fi

echo "✅ Tunnel détecté: $TUNNEL_ID"

echo "🌐 DNS route: $DOMAIN -> $TUNNEL_ID"
set +e
cloudflared tunnel route dns --overwrite-dns "$TUNNEL_ID" "$DOMAIN"
rc=$?
if [ $rc -ne 0 ]; then
  echo "⚠️ Route DNS via ID a échoué (rc=$rc), retry via name: $TUNNEL_NAME"
  cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$DOMAIN" || true
fi
set -e

if command -v dig >/dev/null 2>&1; then
  echo "🔎 dig +short $DOMAIN"
  dig +short "$DOMAIN" || true
else
  echo "ℹ️ dig absent; skip."
fi

if systemctl list-unit-files | grep -q "^$SERVICE_NAME"; then
  echo "🔄 Restart systemd: $SERVICE_NAME"
  systemctl daemon-reload
  systemctl restart "$SERVICE_NAME"
  systemctl --no-pager --full status "$SERVICE_NAME" || true
else
  echo "⚠️ Service $SERVICE_NAME introuvable."
  echo "➡️ Services cloudflared:"
  systemctl list-units --type=service | grep cloudflared || true
fi

echo
echo "🧪 Tests remote (attendu 200/200/200):"
for p in "/api/health" "/api/partners" "/api/partners/thieyp"; do
  url="https://$DOMAIN$p"
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)"
  echo " - $url -> $code"
done

echo "✅ Done (v3)."
