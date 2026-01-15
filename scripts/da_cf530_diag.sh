#!/usr/bin/env bash
set -euo pipefail

echo "== CURL headers =="
curl -I -m 8 -sS https://api.delishafrica.me/api/health || true
echo

echo "== CF trace =="
curl -m 8 -sS https://api.delishafrica.me/cdn-cgi/trace | sed -n '1,30p' || true
echo

echo "== DNS =="
command -v dig >/dev/null 2>&1 && {
  echo "A/AAAA:"
  dig +short api.delishafrica.me A api.delishafrica.me AAAA || true
  echo "CNAME:"
  dig +short api.delishafrica.me CNAME || true
} || echo "dig missing"
echo

echo "== cloudflared configs mentioning api.delishafrica.me =="
grep -R "api.delishafrica.me" -n /etc/cloudflared 2>/dev/null || echo "(not found)"
echo

echo "== cloudflared services =="
systemctl list-units --type=service | grep -i cloudflared || true
echo
systemctl status cloudflared --no-pager 2>/dev/null || true
echo

echo "== local API is up? =="
curl -m 5 -sS http://127.0.0.1:3010/api/health || true
echo
