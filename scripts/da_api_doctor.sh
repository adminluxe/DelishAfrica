#!/usr/bin/env bash
set -euo pipefail

LOCAL="http://127.0.0.1:3010"
REMOTE="https://api.delishafrica.me"

check() {
  local base="$1"
  local path="$2"
  local url="${base}${path}"
  echo "→ $url"
  curl -sS -o /tmp/da_api_doctor_body.json -w "   [http=%{http_code}]\n" "$url" || true
  head -c 250 /tmp/da_api_doctor_body.json 2>/dev/null || true
  echo
  echo
}

echo "=== DelishAfrica API Doctor ==="
echo "Local : $LOCAL"
echo "Remote: $REMOTE"
echo

# Endpoints de base confirmés
check "$LOCAL"  "/api/health"
check "$LOCAL"  "/api/partners"
check "$LOCAL"  "/api/partners/thieyp"

check "$REMOTE" "/api/health"
check "$REMOTE" "/api/partners"
check "$REMOTE" "/api/partners/thieyp"

echo "✅ Doctor terminé"
