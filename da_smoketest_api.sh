#!/usr/bin/env bash
set -euo pipefail

LOCAL="http://127.0.0.1:3010"
REMOTE="https://api.delishafrica.me"

echo "== Local =="
curl -s -o /dev/null -w "local health=%{http_code}\n"   "$LOCAL/api/health" || true
curl -s -o /dev/null -w "local partners=%{http_code}\n" "$LOCAL/api/partners" || true
curl -s -o /dev/null -w "local thieyp=%{http_code}\n"   "$LOCAL/api/partners/thieyp" || true

echo
echo "== Remote (DEMO) =="
curl -s -o /dev/null -w "remote health=%{http_code}\n"   "$REMOTE/api/health"
curl -s -o /dev/null -w "remote partners=%{http_code}\n" "$REMOTE/api/partners"
curl -s -o /dev/null -w "remote thieyp=%{http_code}\n"   "$REMOTE/api/partners/thieyp"
