#!/usr/bin/env bash
set -Eeuo pipefail

# ---------- Config & helpers ----------
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ENV_FILE="backend/.env"
PRISMA_DIR="backend"
SCHEMA_REL="prisma/schema.prisma"
SCHEMA_PATH="$PRISMA_DIR/$SCHEMA_REL"
CONTAINER_NAME="delish_postgres"

# couleurs
c_info="\033[1;36m"; c_ok="\033[1;32m"; c_warn="\033[1;33m"; c_err="\033[1;31m"; c_off="\033[0m"
info(){ echo -e "${c_info}ℹ︎${c_off} $*"; }
ok(){ echo -e "${c_ok}✓${c_off} $*"; }
warn(){ echo -e "${c_warn}!${c_off} $*"; }
err(){ echo -e "${c_err}✗${c_off} $*" >&2; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Commande requise manquante: $1"; exit 1; }; }

port_in_use() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn | awk '{print $4}' | grep -q ":$1$"
  else
    lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | awk '{print $9}' | grep -q ":$1$"
  fi
}

choose_port() {
  for p in 5433 5434 5435 5436 5437 5438 5439 5440 5441 5442 5443 5444 5445; do
    if ! port_in_use "$p"; then echo "$p"; return 0; fi
  done
  return 1
}

# ---------- Options ----------
HOST_PORT=""
FRESH=0
SEED=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port=*) HOST_PORT="${1#*=}";;
    --fresh)  FRESH=1;;
    --seed)   SEED=1;;
    *) warn "Option inconnue ignorée: $1";;
  esac
  shift
done

# ---------- Pré-requis ----------
need docker
[[ -f "$SCHEMA_PATH" ]] || { err "Schéma Prisma introuvable: $SCHEMA_PATH"; exit 1; }

# ---------- Extraire (ou fabriquer) user/pass/db depuis backend/.env ----------
DEFAULT_DB="delishafrica"
DEFAULT_USER="tonton"
DEFAULT_PASS="$(openssl rand -hex 12 2>/dev/null || echo 'ChangeMe!42')"

DB_USER="$DEFAULT_USER"
DB_PASS="$DEFAULT_PASS"
DB_NAME="$DEFAULT_DB"

if [[ -f "$ENV_FILE" ]]; then
  URL="$(sed -nE 's/^DATABASE_URL="?([^"]*)"?/\1/p' "$ENV_FILE" | tail -n1 || true)"
  if [[ -n "${URL:-}" ]]; then
    u="$(printf '%s' "$URL" | sed -E 's#^postgresql://([^:]+):.*#\1#')" || true
    p="$(printf '%s' "$URL" | sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#')" || true
    d="$(printf '%s' "$URL" | sed -E 's#.*/([^/?]+).*#\1#')" || true
    [[ -n "${u:-}" ]] && DB_USER="$u"
    [[ -n "${p:-}" ]] && DB_PASS="$p"
    [[ -n "${d:-}" ]] && DB_NAME="$d"
  fi
fi

# ---------- Choix du port ----------
if [[ -z "${HOST_PORT:-}" ]]; then
  HOST_PORT="$(choose_port || true)"
  [[ -n "$HOST_PORT" ]] || { err "Aucun port libre trouvé (5433..5445). Libère un port ou passe --port=NNNN"; exit 1; }
fi
info "PostgreSQL sera exposé sur le port hôte ${HOST_PORT}"

# ---------- Conteneur & volume ----------
VOLUME_NAME="delish_pgdata_${DB_NAME}"

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
  warn "Conteneur ${CONTAINER_NAME} existant: suppression…"
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

if [[ $FRESH -eq 1 ]]; then
  warn "Suppression du volume ${VOLUME_NAME} (--fresh)…"
  docker volume rm -f "$VOLUME_NAME" >/dev/null 2>&1 || true
fi

info "Démarrage PostgreSQL (docker) sur ${HOST_PORT} avec volume ${VOLUME_NAME}…"
docker run -d --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "${HOST_PORT}:5432" \
  -v "${VOLUME_NAME}:/var/lib/postgresql/data" \
  postgres:16 >/dev/null

# ---------- Attente readiness ----------
info "Attente de readiness de PostgreSQL…"
for i in {1..60}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" >/dev/null 2>&1; then
    ok "PostgreSQL prêt."
    break
  fi
  sleep 1
  if [[ $i -eq 60 ]]; then
    err "PostgreSQL ne répond pas à temps."
    docker logs "$CONTAINER_NAME" | tail -n 80 || true
    exit 1
  fi
done

# ---------- Construire & imposer DATABASE_URL ----------
NEW_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${HOST_PORT}/${DB_NAME}?schema=public"

# Sauvegarde & réécriture propre de backend/.env
mkdir -p "$(dirname "$ENV_FILE")"
[[ -f "$ENV_FILE" ]] && cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)" || true
printf 'DATABASE_URL="%s"\n' "$NEW_URL" > "$ENV_FILE"
ok "backend/.env mis à jour → $NEW_URL"

# ---------- Prisma migrate + generate (URL imposée) ----------
info "Lancement Prisma migrate (URL imposée)…"
pushd "$PRISMA_DIR" >/dev/null
DATABASE_URL="$NEW_URL" npx prisma migrate dev --schema="$SCHEMA_REL"
DATABASE_URL="$NEW_URL" npx prisma generate
popd >/dev/null
ok "Migrations appliquées et Prisma Client généré."

# ---------- Seed optionnel ----------
if [[ $SEED -eq 1 ]]; then
  if [[ -f "$PRISMA_DIR/prisma/seed.cjs" ]]; then
    info "Seed via prisma/seed.cjs…"
    (cd "$PRISMA_DIR" && DATABASE_URL="$NEW_URL" node prisma/seed.cjs) || { err "Seed échoué."; exit 1; }
  elif [[ -f "$PRISMA_DIR/prisma/seed.js" ]]; then
    info "Seed via prisma/seed.js…"
    (cd "$PRISMA_DIR" && DATABASE_URL="$NEW_URL" node prisma/seed.js) || { err "Seed échoué."; exit 1; }
  else
    warn "Aucun seed trouvé (prisma/seed.cjs|seed.js). Skip."
  fi
fi

# ---------- Récap ----------
echo
ok "DB opérationnelle."
echo -e "   • Port hôte : ${HOST_PORT}"
echo -e "   • Base      : ${DB_NAME}"
echo -e "   • Utilisateur : ${DB_USER}"
echo -e "   • Fichier    : ${ENV_FILE}"
echo -e "   • Conteneur  : ${CONTAINER_NAME}"
echo -e "   • Volume     : ${VOLUME_NAME}"
echo
info "Commandes utiles :"
echo "  docker ps --format 'table {{.Names}}\\t{{.Ports}}' | egrep '5432|5433|544.' || true"
echo "  docker logs -n 60 ${CONTAINER_NAME}"
echo "  docker exec -it ${CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME}"
