#!/usr/bin/env bash
set -euo pipefail

HOSTNAME="${HOSTNAME:-api.delishafrica.me}"
TUNNEL_NAME="${TUNNEL_NAME:-delish-api}"
ORIGIN="${ORIGIN:-http://127.0.0.1:3010}"
CFDIR="${CFDIR:-/root/.cloudflared}"
CFG="${CFDIR}/config.yml"

echo "== DelishAfrica | Cloudflared API Fix (v2) =="
echo "HOSTNAME   : $HOSTNAME"
echo "TUNNEL_NAME: $TUNNEL_NAME"
echo "ORIGIN     : $ORIGIN"
echo

die(){ echo "❌ $*" >&2; exit 1; }

echo "🔎 Precheck local API:"
curl -sSf "${ORIGIN}/api/health" >/dev/null || die "Local API KO sur ${ORIGIN}/api/health (corrige d'abord l'API)."
echo "✅ Local health OK"
echo

command -v cloudflared >/dev/null 2>&1 || die "cloudflared introuvable. Installe cloudflared puis relance."

mkdir -p "$CFDIR"

echo "📋 Tunnels disponibles:"
cloudflared tunnel list || true
echo

UUID="$(cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" '$0 ~ n {print $1; exit}')"
[ -n "${UUID:-}" ] || die "Tunnel '$TUNNEL_NAME' introuvable. Crée-le via: cloudflared tunnel create $TUNNEL_NAME"

CREDS="${CFDIR}/${UUID}.json"
[ -f "$CREDS" ] || die "Credentials manquants: $CREDS (refais cloudflared login + tunnel create si besoin)"

echo "✅ Tunnel UUID: $UUID"
echo "✅ Creds     : $CREDS"
echo

echo "✍️ Écriture config: $CFG"
cat > "$CFG" <<EOF2
tunnel: ${UUID}
credentials-file: ${CREDS}
ingress:
  - hostname: ${HOSTNAME}
    service: ${ORIGIN}
  - service: http_status:404
EOF2

echo "🔗 DNS route (overwrite):"
cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$HOSTNAME" || true
echo

BIN="$(command -v cloudflared)"
SERVICE="cloudflared-${TUNNEL_NAME}.service"
UNIT="/etc/systemd/system/${SERVICE}"

echo "⚙️ Création unit systemd: $UNIT"
cat > "$UNIT" <<EOF3
[Unit]
Description=Cloudflared Tunnel (${TUNNEL_NAME}) for DelishAfrica API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${BIN} tunnel --config ${CFG} run ${TUNNEL_NAME}
Restart=on-failure
RestartSec=2
User=root

[Install]
WantedBy=multi-user.target
EOF3

systemctl daemon-reload
systemctl enable --now "$SERVICE"

sleep 1
echo
echo "📌 Status service:"
systemctl --no-pager status "$SERVICE" || true

echo
echo "🧪 Tests remote (doit être 200/200/200) :"
for p in /api/health /api/partners /api/partners/thieyp; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "https://${HOSTNAME}${p}" || true)"
  echo "  https://${HOSTNAME}${p} -> $code"
done

echo
echo "Logs si KO:"
echo "  journalctl -u ${SERVICE} -n 200 --no-pager"
echo "✅ Fin Cloudflared Fix (v2)"
