#!/usr/bin/env bash
set -euo pipefail

echo "== cloudflared status (last 40 lines) =="
systemctl status cloudflared --no-pager | tail -n 40 || true
echo

echo "== cloudflared unit ExecStart =="
systemctl cat cloudflared --no-pager | sed -n '/^\[Service\]/,/^\[Install\]/p' || true
echo

echo "== /etc/cloudflared files =="
ls -la /etc/cloudflared || true
echo

CFG="/etc/cloudflared/config.yml"
if [ -f "$CFG" ]; then
  echo "== /etc/cloudflared/config.yml =="
  sed -n '1,200p' "$CFG"
  echo
fi

echo "== Quick hint =="
echo "If you see: 'Invalid tunnel secret' => token/credentials mismatch."
echo "Fix options:"
echo "  1) If service uses --token: generate a NEW token in Cloudflare dashboard (Zero Trust > Tunnels) and update ExecStart."
echo "  2) If service uses config.yml + credentials-file: ensure the credentials JSON matches the tunnel in config.yml."
echo
