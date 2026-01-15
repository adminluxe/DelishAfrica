#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"

echo "== Detect Merchant Orders screen =="
echo "APP=$APP"
cd "$APP"

# On cherche le fichier qui contient des marqueurs UI typiques de l'écran orders
# (adapté à ton projet : "File de production", "Commandes", "Aucune commande", etc.)
PATTERNS=(
  "File de production"
  "Aucune commande"
  "Commandes"
  "Dernier refresh"
  "Rafraîchir"
)

TMP="/tmp/da_orders_candidates_merchant.txt"
: > "$TMP"

for p in "${PATTERNS[@]}"; do
  rg -n --hidden --no-ignore -S "$p" app 2>/dev/null | awk -F: '{print $1}' >> "$TMP" || true
done

# fallback: fichiers qui s'appellent orders.*
rg -n --hidden --no-ignore -S "orders" app 2>/dev/null | awk -F: '{print $1}' >> "$TMP" || true

CANDIDATES=$(cat "$TMP" | sort -u | grep -E '\.(t|j)sx?$' || true)

echo
echo "---- Candidates ----"
if [[ -z "${CANDIDATES:-}" ]]; then
  echo "❌ Aucun candidat trouvé. (bizarre) -> liste app/:"
  find app -maxdepth 4 -type f | sed 's#^# - #' | head -n 200
  exit 1
fi

echo "$CANDIDATES" | sed 's#^# - #'

# heuristique: on préfère les chemins qui ressemblent à une route orders
BEST=$(echo "$CANDIDATES" | grep -E 'app/.*/orders(/index)?\.(t|j)sx$' | head -n 1 || true)
if [[ -z "${BEST:-}" ]]; then
  BEST=$(echo "$CANDIDATES" | head -n 1)
fi

echo
echo "✅ BEST_GUESS=$BEST"
echo "$BEST" > /tmp/da_orders_best_merchant.txt
