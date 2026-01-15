#!/usr/bin/env bash
set -euo pipefail

URL="https://api.delishafrica.me/api/health"

echo "== DelishAfrica | Cloudflared Fix =="
echo "Test: $URL"

code="$(curl -sk -o /dev/null -w '%{http_code}' "$URL" || true)"
echo "Before: HTTP $code"

if [ "$code" = "200" ]; then
  echo "✅ HTTPS déjà OK."
  exit 0
fi

# Restart systemd service si présent
if command -v systemctl >/dev/null 2>&1; then
  if systemctl list-unit-files 2>/dev/null | grep -q '^cloudflared'; then
    echo "🔄 systemctl restart cloudflared"
    systemctl restart cloudflared || systemctl restart cloudflared.service || true
    sleep 2
  else
    echo "⚠️ cloudflared systemd unit introuvable (pas forcément un problème)."
  fi
else
  echo "⚠️ systemctl absent (environnement non-systemd)."
fi

code2="$(curl -sk -o /dev/null -w '%{http_code}' "$URL" || true)"
echo "After:  HTTP $code2"

if [ "$code2" = "200" ]; then
  echo "✅ HTTPS OK après restart cloudflared."
  exit 0
fi

echo "❌ Toujours KO (ex: 530/1033). Checks à lancer :"
echo "  1) systemctl status cloudflared --no-pager || true"
echo "  2) journalctl -u cloudflared -n 200 --no-pager || true"
echo "  3) ls -la /root/.cloudflared || true"
echo "  4) sed -n '1,200p' /root/.cloudflared/config.yml || true"
echo "  5) cloudflared tunnel list || true"
echo "  6) dig +short api.delishafrica.me || true"
exit 1
