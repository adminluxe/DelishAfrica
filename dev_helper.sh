#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

c_info="\033[1;36m"; c_ok="\033[1;32m"; c_warn="\033[1;33m"; c_off="\033[0m"
info(){ echo -e "${c_info}ℹ︎${c_off} $*"; }
ok(){ echo -e "${c_ok}✓${c_off} $*"; }
warn(){ echo -e "${c_warn}!${c_off} $*"; }

PORT_ARG="${PORT_ARG:-}"
FRESH=0
SEED=1
STUDIO=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port=*) PORT_ARG="$1";;
    --fresh)  FRESH=1;;
    --no-seed) SEED=0;;
    --studio) STUDIO=1;;
    *) warn "Option inconnue: $1";;
  esac
  shift
done

info "Étape 1 — Utilisation courante: DB + migrate + seed"
CMD=( "./setup_prisma.sh" )
[[ -n "$PORT_ARG" ]] && CMD+=( "$PORT_ARG" )
[[ $FRESH -eq 1 ]] && CMD+=( "--fresh" )
[[ $SEED -eq 1 ]] && CMD+=( "--seed" )
"${CMD[@]}"

info "Étape 2 — Exemple Prisma rapide: (check count produits)"
export DATABASE_URL="$(sed -nE 's/^DATABASE_URL=\"?([^"]*)\"?/\1/p' backend/.env)"
node - <<'JS'
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  const n = await prisma.product.count().catch(()=>null);
  console.log("Products count (preview):", n);
  await prisma.$disconnect();
})();
JS

info "Étape 3 — Seed idempotent: vérification"
if [[ -f backend/prisma/seed.cjs ]]; then
  ( cd backend && node prisma/seed.cjs )
else
  warn "backend/prisma/seed.cjs absent (ok si déjà fait)."
fi

info "Étape 4 — Éviter les .env parasites"
unset DATABASE_URL || true
ok "Variable d'environnement DATABASE_URL unset. Prisma lira backend/.env."

info "Étape 5 — Avertissement Prisma (config future)"
echo -e "Note: \033[1mpackage.json#prisma\033[0m est déprécié (Prisma 7). On migrera vers \033[1mprisma.config.ts\033[0m plus tard."

[[ $STUDIO -eq 1 ]] && (cd backend && npx prisma studio --schema=prisma/schema.prisma) || true

ok "Fin — Helper exécuté."
