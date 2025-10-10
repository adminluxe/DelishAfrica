#!/usr/bin/env bash
set -euo pipefail

: "${CF_API_TOKEN:?export CF_API_TOKEN=... (Cloudflare API Token with Zone.DNS edit)}"
ZONE_NAME="${ZONE_NAME:-delishafrica.me}"
ORIGIN_IP="${ORIGIN_IP:-188.166.135.189}"

api() { curl -sS -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" "$@"; }

echo "→ Lookup zone id for $ZONE_NAME"
ZONE_ID="$(api "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME" | jq -r '.result[0].id')"
[[ -n "$ZONE_ID" && "$ZONE_ID" != "null" ]] || { echo "Zone introuvable"; exit 1; }

upsert() {
  local type="$1" name="$2" content="$3" proxied="$4"
  local fqdn="$([ "$name" = "@" ] && echo "$ZONE_NAME" || echo "$name.$ZONE_NAME")"
  local id
  id="$(api "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=$type&name=$fqdn" | jq -r '.result[0].id // empty')"
  local payload
  payload="$(jq -n --arg type "$type" --arg name "$fqdn" --arg content "$content" --argjson proxied "$proxied" \
    '{type:$type,name:$name,content:$content,ttl:1,proxied:$proxied}')"
  if [[ -n "$id" ]]; then
    api -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$id" --data "$payload" >/dev/null
    echo "✓ updated $type $fqdn -> $content (proxied=$proxied)"
  else
    api -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" --data "$payload" >/dev/null
    echo "✓ created $type $fqdn -> $content (proxied=$proxied)"
  fi
}

echo "→ Upsert A @, A staging (proxied)"
upsert A @        "$ORIGIN_IP" true
upsert A staging  "$ORIGIN_IP" true

echo "→ Upsert CNAME www/app vers apex (proxied)"
upsert CNAME www  "$ZONE_NAME" true
upsert CNAME app  "$ZONE_NAME" true

echo "→ Purge NS apex non-Cloudflare (si présents)"
CF_NS1="chuck.ns.cloudflare.com"
CF_NS2="joyce.ns.cloudflare.com"
api "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=NS&name=$ZONE_NAME" \
| jq -r '.result[]? | "\(.id) \(.content)"' | while read -r id content; do
  if [[ "$content" != "$CF_NS1" && "$content" != "$CF_NS2" ]]; then
    api -X DELETE "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$id" >/dev/null \
      && echo "✓ removed stray NS $content at apex"
  fi
done

echo "→ Sanity dig (Cloudflare NS):"
dig +short @$CF_NS1 staging.$ZONE_NAME A
dig +short @$CF_NS1 www.$ZONE_NAME CNAME
dig +short @$CF_NS1 app.$ZONE_NAME CNAME

echo "Done ✅"
