#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail
MOD_DIR="services/api/src/modules/merchant"
MOD_FILE="$MOD_DIR/merchant.module.ts"

[[ -f "$MOD_FILE" ]] || { echo "❌ Introuvable: $MOD_FILE"; exit 1; }

ts=$(date +%Y%m%d-%H%M%S)
cp "$MOD_FILE" "$MOD_FILE.bak.$ts"

# 1) Lister les fichiers controller
mapfile -t files < <(find "$MOD_DIR" -maxdepth 1 -type f -name "*controller.ts" ! -name "*.spec.ts" | sort)
[[ ${#files[@]} -gt 0 ]] || { echo "❌ Aucun controller trouvé"; exit 2; }

# 2) Extraire les noms de classes exportées
controllers=()
declare -A importPaths=()
for f in "${files[@]}"; do
  cls=$(grep -Eo 'export class [A-Za-z0-9_]+Controller' "$f" | head -n1 | awk '{print $3}')
  [[ -n "$cls" ]] || continue
  controllers+=("$cls")
  base="$(basename "$f" .ts)"           # ex: merchant.public.controller
  importPaths["$cls"]="./$base"         # import relatif
done

# 3) Ajouter les imports manquants en tête de fichier (idempotent)
tmp="$MOD_FILE.tmp.$ts"
cp "$MOD_FILE" "$tmp"
for cls in "${controllers[@]}"; do
  imp="import { $cls } from '${importPaths[$cls]}';"
  grep -q "import { $cls } from" "$tmp" || sed -i "1i $imp" "$tmp"
done

# 4) Reconstruire controllers: [ ... ]
joined=$(printf "%s, " "${controllers[@]}")
joined="${joined%, }"
perl -0777 -pe "s/controllers:\s*\[([^\]]*)\]/controllers: \[${joined}\]/s" -i "$tmp"

# 5) Vérif basique: aucune référence inconnue
if grep -q 'controllers:\s*\[\s*\]' "$tmp"; then
  echo "❌ Liste controllers vide après scan — abandon."
  exit 3
fi

mv "$tmp" "$MOD_FILE"
echo "✓ merchant.module.ts reconstruit avec controllers: [${joined}]"

# 6) Build + restart + healthcheck
pnpm -C services/api build
pm2 restart delish-api --update-env
sleep 1
echo "→ Health:"
curl -fsS http://localhost:4001/api/health | jq .
