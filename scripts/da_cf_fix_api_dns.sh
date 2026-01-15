#!/usr/bin/env bash
set -euo pipefail

ZONE_NAME="${CF_ZONE_NAME:-delishafrica.me}"
RECORD_NAME="${CF_RECORD_NAME:-api.delishafrica.me}"
PROXIED="${CF_PROXIED:-true}"

TUNNEL_ID="${CF_TUNNEL_ID:-}"
TARGET="${CF_TARGET:-}"

if [[ -z "$TARGET" ]]; then
  if [[ -z "$TUNNEL_ID" ]]; then
    echo "ERROR: Provide CF_TUNNEL_ID (tunnel UUID) or CF_TARGET (full CNAME target)."
    exit 2
  fi
  TARGET="${TUNNEL_ID}.cfargotunnel.com"
fi

sanitize() { printf "%s" "${1:-}" | tr -d '\r\n'; }

CF_API_TOKEN="$(sanitize "${CF_API_TOKEN:-}")"
CF_API_EMAIL="$(sanitize "${CF_API_EMAIL:-}")"
CF_API_KEY="$(sanitize "${CF_API_KEY:-}")"

# If user pasted whole header, normalize hard:
CF_API_TOKEN="$(printf "%s" "$CF_API_TOKEN" | sed -E 's/^[Aa]uthorization:[[:space:]]*//; s/^[Bb]earer[[:space:]]+//; s/^[[:space:]]+//; s/[[:space:]]+$//')"
CF_API_EMAIL="$(printf "%s" "$CF_API_EMAIL" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
CF_API_KEY="$(printf "%s" "$CF_API_KEY" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"

auth_headers=()
AUTH_MODE=""
if [[ -n "$CF_API_TOKEN" ]]; then
  auth_headers=(-H "Authorization: Bearer $CF_API_TOKEN")
  AUTH_MODE="token"
elif [[ -n "$CF_API_EMAIL" && -n "$CF_API_KEY" ]]; then
  auth_headers=(-H "X-Auth-Email: $CF_API_EMAIL" -H "X-Auth-Key: $CF_API_KEY")
  AUTH_MODE="global_key"
else
  echo "ERROR: Provide CF_API_TOKEN (API Token) OR (CF_API_EMAIL + CF_API_KEY Global Key)."
  exit 2
fi

CF_LAST_HTTP=""
CF_LAST_CURL_RC=""

cf_api() {
  local method="$1"; shift
  local path="$1"; shift
  local tmp; tmp="$(mktemp)"
  local code rc

  set +e
  code="$(curl -sS --connect-timeout 10 --max-time 30 \
    -X "$method" "https://api.cloudflare.com/client/v4${path}" \
    "${auth_headers[@]}" \
    -H "Content-Type: application/json" \
    -o "$tmp" -w "%{http_code}" \
    "$@")"
  rc="$?"
  set -e

  CF_LAST_HTTP="${code:-000}"
  CF_LAST_CURL_RC="$rc"
  cat "$tmp"
  rm -f "$tmp"
}

py_get_first_id() {
  python3 -c 'import sys,json
raw=sys.stdin.read()
if not raw.strip(): sys.exit(0)
try: d=json.loads(raw)
except Exception: sys.exit(0)
if not d.get("success"): sys.exit(0)
res=d.get("result") or []
sys.stdout.write((res[0].get("id","") if res else ""))'
}

py_print_verify() {
  python3 -c 'import sys,json
raw=sys.stdin.read().strip()
d=json.loads(raw)
print("success=", d.get("success"))
if not d.get("success"):
  print("errors=", d.get("errors"))'
}

py_verify_ok() {
  python3 -c 'import sys,json
raw=sys.stdin.read().strip()
d=json.loads(raw)
raise SystemExit(0 if d.get("success") else 1)'
}

echo "== Cloudflare DNS fix (v3.3) =="
echo "Auth:   $AUTH_MODE"
echo "Zone:   $ZONE_NAME"
echo "Record: $RECORD_NAME"
echo "Target: $TARGET"
echo "Proxied:$PROXIED"
echo

echo "== Token verify =="
verify_json="$(cf_api GET "/user/tokens/verify" || true)"
echo "HTTP=$CF_LAST_HTTP curl_rc=$CF_LAST_CURL_RC"
if [[ -z "${verify_json:-}" ]]; then
  echo "ERROR: empty response from Cloudflare. Check network/SSL or headers."
  exit 10
fi
printf "%s" "$verify_json" | py_print_verify
if ! printf "%s" "$verify_json" | py_verify_ok >/dev/null; then
  echo "ERROR: token verify failed. Fix token/permissions before DNS."
  exit 11
fi
echo

echo "== Fetch zone_id =="
zone_json="$(cf_api GET "/zones?name=${ZONE_NAME}&status=active&per_page=1" || true)"
echo "HTTP=$CF_LAST_HTTP curl_rc=$CF_LAST_CURL_RC"
zone_id="$(printf "%s" "$zone_json" | py_get_first_id)"
if [[ -z "$zone_id" ]]; then
  echo "ERROR: zone_id not found for $ZONE_NAME."
  echo "Body (first 400 chars):"
  printf "%s" "$zone_json" | head -c 400; echo
  exit 3
fi
echo "zone_id=$zone_id"
echo

echo "== Lookup existing DNS record =="
rec_json="$(cf_api GET "/zones/${zone_id}/dns_records?name=${RECORD_NAME}&per_page=1" || true)"
echo "HTTP=$CF_LAST_HTTP curl_rc=$CF_LAST_CURL_RC"
rec_id="$(printf "%s" "$rec_json" | py_get_first_id)"
echo "record_id=${rec_id:-<none>}"
echo

# ✅ FIX: set env vars correctly for python
payload="$(env RECORD_NAME="$RECORD_NAME" TARGET="$TARGET" PROXIED="$PROXIED" python3 -c '
import os,json
record=os.environ.get("RECORD_NAME","")
target=os.environ.get("TARGET","")
prox=(os.environ.get("PROXIED","true").strip().lower()=="true")
print(json.dumps({"type":"CNAME","name":record,"content":target,"ttl":1,"proxied":prox}))
')"

if [[ -n "${rec_id:-}" ]]; then
  echo "== Update DNS record =="
  out="$(cf_api PUT "/zones/${zone_id}/dns_records/${rec_id}" --data "$payload" || true)"
else
  echo "== Create DNS record =="
  out="$(cf_api POST "/zones/${zone_id}/dns_records" --data "$payload" || true)"
fi
echo "HTTP=$CF_LAST_HTTP curl_rc=$CF_LAST_CURL_RC"

python3 -c 'import sys,json
raw=sys.stdin.read().strip()
if not raw:
  print("success= False")
  print("errors= empty_response")
  raise SystemExit(1)
d=json.loads(raw)
print("success=", d.get("success"))
if not d.get("success"):
  print("errors=", d.get("errors"))' <<<"$out"

echo
echo "== Quick checks =="
dig +short "$RECORD_NAME" @1.1.1.1 || true
getent hosts "$RECORD_NAME" || true
