#!/usr/bin/env bash
set -euo pipefail

echo "== cloudflared services (running) =="
systemctl list-units --type=service --state=running | grep -i cloudflared || true
echo

echo "== cloudflared ExecStart =="
while read -r svc; do
  echo "--- $svc ---"
  systemctl show "$svc" -p ExecStart --no-pager | sed 's/^/  /'
  journalctl -u "$svc" -n 40 --no-pager | grep -E "Starting tunnel|tunnelID|Updated to new configuration" || true
  echo
done < <(systemctl list-units --type=service --all | awk '{print $1}' | grep -i cloudflared || true)

echo "== listening ports (3010/18080/18081) =="
ss -lntp | egrep ':(3010|18080|18081)\b' || true
echo

echo "== local health checks =="
curl -sS --max-time 3 http://127.0.0.1:3010/api/v1/health || true; echo
curl -sS --max-time 3 http://127.0.0.1:18080/ || true; echo
curl -sS --max-time 3 http://127.0.0.1:18081/ || true; echo
echo

echo "== public check =="
curl -sv --max-time 8 https://api.delishafrica.me/api/v1/health || true
echo
