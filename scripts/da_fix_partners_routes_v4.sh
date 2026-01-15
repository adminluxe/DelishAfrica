#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
PORT="4001"

echo "== DelishAfrica | Fix Partners Routes (v4) =="
echo "Root: $ROOT"
cd "$ROOT"

die(){ echo "❌ $*" >&2; exit 1; }

echo
echo "== (1) Trouver le PID qui écoute sur :$PORT =="
PID="$(ss -lptn 2>/dev/null | awk -v p=":$PORT" '$0 ~ p {match($0,/pid=([0-9]+)/,m); if(m[1]!=""){print m[1]; exit}}' || true)"
if [[ -z "${PID:-}" ]]; then
  echo "⚠️  Aucun PID trouvé via ss. On va tenter Docker..."
else
  echo "✅ PID: $PID"
  echo "   ps: $(ps -p "$PID" -o pid=,comm=,args= | sed -e 's/[[:space:]]\+/ /g')"
  CWD="$(readlink -f "/proc/$PID/cwd" 2>/dev/null || true)"
  echo "   cwd: ${CWD:-?}"
fi

echo
echo "== (2) Détecter si Docker expose :$PORT =="
DOCKER_CONTAINER_ID="$(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' 2>/dev/null | awk -v p="$PORT" '$0 ~ p {print $1; exit}' || true)"
if [[ -n "${DOCKER_CONTAINER_ID:-}" ]]; then
  echo "✅ Container qui expose $PORT: $DOCKER_CONTAINER_ID"
  echo "   $(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' | grep "$DOCKER_CONTAINER_ID" || true)"
else
  echo "ℹ️  Aucun container n’expose $PORT (possible: host process / network host)."
fi

echo
echo "== (3) Localiser le code NestJS (API_ROOT) =="
API_ROOT=""

# 3A) Si process host: on remonte depuis le cwd
if [[ -z "${DOCKER_CONTAINER_ID:-}" && -n "${CWD:-}" ]]; then
  # Remonter jusqu’à trouver un package.json nest + src/main.ts
  cur="$CWD"
  for _ in $(seq 1 8); do
    if [[ -f "$cur/package.json" && -f "$cur/src/main.ts" ]]; then
      if grep -qE '"@nestjs/(core|common)"' "$cur/package.json" 2>/dev/null; then
        API_ROOT="$cur"
        break
      fi
    fi
    cur="$(dirname "$cur")"
  done
fi

# 3B) Fallback: scan dans le monorepo (rapide, maxdepth)
if [[ -z "$API_ROOT" ]]; then
  API_ROOT="$(find "$ROOT" -maxdepth 6 -type f -name main.ts 2>/dev/null \
    | xargs -I{} sh -c 'p="$(dirname "{}")"; test -f "$p/package.json" && grep -qE "\"@nestjs/(core|common)\"" "$p/package.json" && echo "$p" || true' \
    | head -n 1 || true)"
fi

if [[ -z "$API_ROOT" ]]; then
  echo "❌ Impossible de localiser un dossier NestJS (package.json + src/main.ts)."
  echo "➡️  On va quand même sortir un diagnostic utile:"
  echo "   ss -lptn | grep :$PORT"
  ss -lptn | grep ":$PORT" || true
  echo
  echo "   docker ps (ports) | grep $PORT"
  docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' | grep "$PORT" || true
  exit 2
fi

echo "✅ API_ROOT détecté: $API_ROOT"

echo
echo "== (4) Patch: ajouter module/controller Partners si absent =="
APP_MODULE="$API_ROOT/src/app.module.ts"
[[ -f "$APP_MODULE" ]] || die "app.module.ts introuvable: $APP_MODULE"

PARTNERS_DIR="$API_ROOT/src/partners"
mkdir -p "$PARTNERS_DIR"

# 4A) partners.service.ts
cat > "$PARTNERS_DIR/partners.service.ts" <<'TS'
import { Injectable } from '@nestjs/common';

type Partner = {
  id: string;
  slug: string;
  name: string;
  city?: string;
  country?: string;
};

@Injectable()
export class PartnersService {
  private readonly partners: Partner[] = [
    { id: 'thieyp', slug: 'thieyp', name: 'Thieyp', city: 'Bruxelles', country: 'BE' },
  ];

  list(): Partner[] {
    return this.partners;
  }

  bySlug(slug: string): Partner | null {
    return this.partners.find((p) => p.slug === slug) ?? null;
  }
}
TS

# 4B) partners.controller.ts
cat > "$PARTNERS_DIR/partners.controller.ts" <<'TS'
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PartnersService } from './partners.service';

@Controller('partners')
export class PartnersController {
  constructor(private readonly partners: PartnersService) {}

  @Get()
  list() {
    return { items: this.partners.list() };
  }

  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    const p = this.partners.bySlug(slug);
    if (!p) throw new NotFoundException(`Partner not found: ${slug}`);
    return p;
  }
}
TS

# 4C) partners.module.ts
cat > "$PARTNERS_DIR/partners.module.ts" <<'TS'
import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  controllers: [PartnersController],
  providers: [PartnersService],
})
export class PartnersModule {}
TS

echo "✅ Fichiers Partners écrits dans: $PARTNERS_DIR"

echo
echo "== (5) Patcher app.module.ts pour importer PartnersModule (idempotent) =="

if ! grep -q "PartnersModule" "$APP_MODULE"; then
  # 5A) Ajouter import
  if grep -q "^import" "$APP_MODULE"; then
    # on insère après le dernier import
    perl -0777 -i -pe 's/(^(?:import .*;\n)+)/$1import { PartnersModule } from '\''.\/partners\/partners.module'\'';\n/sm' "$APP_MODULE"
  else
    # fichier bizarre, on préfixe
    perl -0777 -i -pe 's/^/import { PartnersModule } from '\''.\/partners\/partners.module'\'';\n\n/sm' "$APP_MODULE"
  fi

  # 5B) Ajouter dans imports: []
  if grep -q "imports\s*:\s*\[" "$APP_MODULE"; then
    perl -0777 -i -pe 's/imports\s*:\s*\[\s*/imports: [PartnersModule, /sm' "$APP_MODULE"
  else
    echo "⚠️  Je ne vois pas imports: [] dans app.module.ts. Ajoute PartnersModule manuellement."
  fi

  echo "✅ app.module.ts patché (import + imports[])"
else
  echo "ℹ️ PartnersModule déjà référencé, skip."
fi

echo
echo "== (6) Restart API (best effort) =="

RESTARTED="0"

# 6A) Docker (si container expose port)
if [[ -n "${DOCKER_CONTAINER_ID:-}" ]]; then
  echo "➡️ Tentative restart container: $DOCKER_CONTAINER_ID"
  docker restart "$DOCKER_CONTAINER_ID" && RESTARTED="1" || true
fi

# 6B) systemd (si service typique existe)
if [[ "$RESTARTED" == "0" ]]; then
  for svc in delish-api api delishafrica-api; do
    if systemctl list-units --type=service --all 2>/dev/null | grep -q "${svc}.service"; then
      echo "➡️ Tentative systemd restart: ${svc}.service"
      systemctl restart "${svc}.service" && RESTARTED="1" || true
      break
    fi
  done
fi

if [[ "$RESTARTED" == "0" ]]; then
  echo "⚠️  Je n’ai pas pu redémarrer automatiquement l’API."
  echo "➡️  Redémarre le process qui écoute sur :$PORT (pm2/docker/systemd) puis relance les curls."
fi

echo
echo "== (7) Tests (local + remote) =="
set +e
curl -s -o /dev/null -w "local /api/health=%{http_code}\n" "http://127.0.0.1:${PORT}/api/health"
curl -s -o /dev/null -w "local /api/partners=%{http_code}\n" "http://127.0.0.1:${PORT}/api/partners"
curl -s -o /dev/null -w "local /api/partners/thieyp=%{http_code}\n" "http://127.0.0.1:${PORT}/api/partners/thieyp"

curl -s -o /dev/null -w "remote /api/health=%{http_code}\n" "https://api.delishafrica.me/api/health"
curl -s -o /dev/null -w "remote /api/partners=%{http_code}\n" "https://api.delishafrica.me/api/partners"
curl -s -o /dev/null -w "remote /api/partners/thieyp=%{http_code}\n" "https://api.delishafrica.me/api/partners/thieyp"
set -e

echo
echo "✅ Fin. Objectif: 200/200/200 en local + remote."
