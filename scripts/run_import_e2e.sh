#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail

ID="${1:-}"; CSV_IN="${2:-templates/menu_template.csv}"
API_PORT="${API_PORT:-4001}"
OUT="/tmp/menu_with_id.csv"

[[ -n "$ID" ]] || { echo "Usage: $0 <MERCHANT_ID> [CSV_IN]"; exit 1; }

# 0) CSV source : s'il manque, on crée un mini gabarit de test
if [[ ! -f "$CSV_IN" ]]; then
  echo "⚠️  $CSV_IN introuvable — création d'un mini CSV de test."
  mkdir -p templates
  CSV_IN="templates/menu_template.csv"
  cat > "$CSV_IN" <<'CSV'
name,price,category,description,spicy_level,imageUrl,available
Jollof Rice,12.50,Main,Classic West African rice,1,,true
Suya Beef,9.90,Starter,Grilled spicy beef skewers,3,,true
Egusi Soup,14.00,Main,Melon seed soup with beef,2,,true
CSV
fi

# 1) Fabrique un CSV avec merchant_id (ajoute la colonne si absente)
header="$(head -n1 "$CSV_IN" | tr -d '\r')"
TMP="$(mktemp)"
if echo "$header" | grep -qi '^merchant_id[ ,;]'; then
  # Remplace uniquement MERCH1 par l'ID réel
  awk -F, -v OFS=, -v ID="$ID" '
    NR==1{print;next}
    {gsub(/^"MERCH1"$/,"MERCH1",$1); if($1 ~ /^"?MERCH1"?$/) $1=ID; print}
  ' "$CSV_IN" > "$TMP"
else
  SEP=$(echo "$header" | grep -q ';' && echo ';' || echo ',')
  awk -v ID="$ID" -v SEP="$SEP" '
    NR==1{print "merchant_id" SEP $0; next}
    {print ID SEP $0}
  ' "$CSV_IN" > "$TMP"
fi

# 2) Sanity : non vide, >1 ligne
LINES="$(wc -l < "$TMP" | tr -d ' ')"
if [[ "$LINES" -le 1 ]]; then
  echo "❌ Fichier prêt à l'upload vide ou invalide ($TMP). Abandon."
  exit 2
fi

mv "$TMP" "$OUT"
echo "→ Fichier prêt : $OUT ($LINES lignes)"

# 3) API up ? (lance si nécessaire)
if ! ss -ltnp | grep -q ":$API_PORT"; then
  echo "→ API: démarrage via PM2…"
  pm2 describe delish-api >/dev/null 2>&1 || {
    pm2 start "bash -lc 'cd services/api && set -a; . prisma/.env; set +a; PORT=$API_PORT pnpm exec ts-node --transpile-only src/main.ts'" --name delish-api
    pm2 save
  }
  sleep 1
fi

# 4) Upload
echo "→ Upload CSV vers /api/merchants/import-menu …"
HTTP="$(curl -s -o /tmp/import_resp.json -w "%{http_code}" -X POST "http://localhost:$API_PORT/api/merchants/import-menu" -F "file=@$OUT;type=text/csv")"
echo "HTTP $HTTP"
cat /tmp/import_resp.json | sed -n '1,200p'

# 5) Vérif + aperçu
echo
echo "→ Vérif JSON du menu…"
curl -fsS "http://localhost:$API_PORT/api/merchants/$ID/menu" | jq '.[0:5]'
echo "→ Compte d’items :"
curl -fsS "http://localhost:$API_PORT/api/merchants/$ID/menu" | jq 'length'

# 6) Export CSV lisible
mkdir -p ./data/exports
EXP="./data/exports/menu_after_import.csv"
curl -fsS "http://localhost:$API_PORT/api/merchants/$ID/menu" | jq -r '
 (["name","price","category","description","spicy_level","imageUrl","available"] | @csv),
 (.[] | [
   .name, (.price|tostring), (.category//""), (.description//""),
   (.spicy_level//""), (.imageUrl//""),
   (if .available==true then "true" else "false" end)
 ] | @csv)
' > "$EXP"
echo "✓ Export : $EXP"
