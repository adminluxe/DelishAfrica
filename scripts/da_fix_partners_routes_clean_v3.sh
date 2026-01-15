#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/delishafrica/monorepo}"
TS="$(date +%Y%m%d_%H%M%S)"

die(){ echo "❌ $*" >&2; exit 1; }

echo "== DelishAfrica | Fix Partners Routes (v3) =="
echo "Root: $ROOT"
[ -d "$ROOT" ] || die "Root introuvable: $ROOT"

locate_api_root(){
  local root="$1"

  # 1) chemins usuels
  for cand in \
    "$root/services/api" \
    "$root/service/api" \
    "$root/backend/api" \
    "$root/backend" \
    "$root/api" \
    "$root/apps/api" \
    "$root/apps/backend" \
    "$root/apps/server" \
    "$root/packages/api" \
    "$root/packages/backend" \
    "$root/server" \
    "$root/services/backend"
  do
    if [ -f "$cand/package.json" ] && [ -d "$cand/src" ]; then
      if grep -q '"@nestjs/core"' "$cand/package.json" 2>/dev/null || grep -q '"@nestjs/common"' "$cand/package.json" 2>/dev/null; then
        if [ -f "$cand/src/main.ts" ] && grep -q "NestFactory" "$cand/src/main.ts" 2>/dev/null; then
          echo "$cand"; return 0
        fi
        if find "$cand/src" -maxdepth 3 -type f -name "*.ts" -print0 2>/dev/null | xargs -0 grep -l "NestFactory" 2>/dev/null | head -n 1 >/dev/null; then
          echo "$cand"; return 0
        fi
      fi
    fi
  done

  # 2) recherche profonde (maxdepth 14)
  while IFS= read -r -d '' pj; do
    local dir
    dir="$(dirname "$pj")"

    [[ "$dir" == *"/node_modules/"* ]] && continue
    [[ "$dir" == *"/dist/"* ]] && continue
    [[ "$dir" == *"/.git/"* ]] && continue

    if grep -q '"@nestjs/core"' "$pj" 2>/dev/null || grep -q '"@nestjs/common"' "$pj" 2>/dev/null; then
      if [ -f "$dir/src/main.ts" ] && grep -q "NestFactory" "$dir/src/main.ts" 2>/dev/null; then
        echo "$dir"; return 0
      fi
      if [ -d "$dir/src" ] && find "$dir/src" -maxdepth 4 -type f -name "*.ts" -print0 2>/dev/null | xargs -0 grep -l "NestFactory" 2>/dev/null | head -n 1 >/dev/null; then
        echo "$dir"; return 0
      fi
    fi
  done < <(find "$root" -maxdepth 14 -type f -name package.json -print0 2>/dev/null)

  return 1
}

API_ROOT="$(locate_api_root "$ROOT" || true)"
if [ -z "${API_ROOT:-}" ]; then
  echo "❌ Impossible de localiser le package NestJS API sous $ROOT." >&2
  echo "➡️  Diagnostic rapide:" >&2
  echo "   find $ROOT -maxdepth 14 -type f \\( -name 'main.ts' -o -name 'app.module.ts' \\) -not -path '*/node_modules/*' | head -n 50" >&2
  echo "   docker ps --format '{{.Names}}\\t{{.Ports}}' | grep 4001 || true" >&2
  exit 2
fi

echo "✅ API_ROOT détecté: $API_ROOT"

APP_MODULE="$API_ROOT/src/app.module.ts"
[ -f "$APP_MODULE" ] || die "app.module.ts introuvable: $APP_MODULE"

cp -a "$APP_MODULE" "$APP_MODULE.bak.$TS"
echo "🧷 Backup: $APP_MODULE.bak.$TS"

mkdir -p "$API_ROOT/src/partners"

PARTNERS_CONTROLLER="$API_ROOT/src/partners/partners.controller.ts"
PARTNERS_MODULE="$API_ROOT/src/partners/partners.module.ts"

if [ ! -f "$PARTNERS_CONTROLLER" ]; then
  cat > "$PARTNERS_CONTROLLER" <<'TSFILE'
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

type Partner = {
  slug: string;
  name: string;
  city: string;
  country: string;
  cuisine: string;
  address?: string;
  heroImage?: string;
  tagline?: string;
};

const PARTNERS: Partner[] = [
  {
    slug: 'thieyp',
    name: 'Thieyp',
    city: 'Bruxelles',
    country: 'BE',
    cuisine: 'Sénégalais',
    address: 'Bruxelles (démo)',
    tagline: 'Mode démo – partenaire vitrine',
    heroImage: 'https://picsum.photos/seed/thieyp/1200/800',
  },
  {
    slug: 'afrosian',
    name: 'Afrosian',
    city: 'Bruxelles',
    country: 'BE',
    cuisine: 'Fusion afro-asiatique',
    address: 'Bruxelles (démo)',
    heroImage: 'https://picsum.photos/seed/afrosian/1200/800',
  },
  {
    slug: 'toukoul',
    name: 'Toukoul',
    city: 'Bruxelles',
    country: 'BE',
    cuisine: 'Éthiopien',
    address: 'Bruxelles (démo)',
    heroImage: 'https://picsum.photos/seed/toukoul/1200/800',
  },
];

@Controller('partners')
export class PartnersController {
  @Get()
  list() {
    return { items: PARTNERS, count: PARTNERS.length };
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    const p = PARTNERS.find((x) => x.slug === slug);
    if (!p) throw new NotFoundException('Partner not found');
    return p;
  }
}
TSFILE
  echo "✅ Created: $PARTNERS_CONTROLLER"
else
  echo "ℹ️  Exists: $PARTNERS_CONTROLLER (skipped)"
fi

if [ ! -f "$PARTNERS_MODULE" ]; then
  cat > "$PARTNERS_MODULE" <<'TSFILE'
import { Module } from '@nestjs/common';
import { PartnersController } from './partners.controller';

@Module({
  controllers: [PartnersController],
})
export class PartnersModule {}
TSFILE
  echo "✅ Created: $PARTNERS_MODULE"
else
  echo "ℹ️  Exists: $PARTNERS_MODULE (skipped)"
fi

APP_MODULE="$APP_MODULE" node <<'NODE'
const fs = require('fs');

const p = process.env.APP_MODULE;
if (!p) throw new Error('APP_MODULE missing');

let txt = fs.readFileSync(p, 'utf8');
const importLine = `import { PartnersModule } from './partners/partners.module';`;

function ensureImport(s) {
  if (s.includes(importLine)) return s;
  const lines = s.split('\n');
  let last = -1;
  for (let i=0;i<lines.length;i++) if (lines[i].trim().startsWith('import ')) last = i;
  if (last === -1) return importLine + '\n' + s;
  lines.splice(last+1, 0, importLine);
  return lines.join('\n');
}

function ensureInImports(s) {
  const idx = s.indexOf('@Module');
  if (idx === -1) throw new Error('Cannot find @Module in app.module.ts');
  const before = s.slice(0, idx);
  let after = s.slice(idx);

  // already wired?
  if (/imports\s*:\s*\[[\s\S]*?PartnersModule/.test(after)) return s;

  if (/imports\s*:\s*\[/.test(after)) {
    after = after.replace(/imports\s*:\s*\[/, (m) => m + 'PartnersModule, ');
    return before + after;
  }

  after = after.replace(/@Module\s*\(\s*\{\s*/m, (m) => m + '\n  imports: [PartnersModule],\n');
  return before + after;
}

txt = ensureImport(txt);
txt = ensureInImports(txt);

fs.writeFileSync(p, txt);
console.log('✅ Patched app.module.ts (PartnersModule wired)');
NODE

echo "🔄 Restart/rebuild API (best effort)..."
set +e

DOCKER_COMPOSE_FILE=""
[ -f "$ROOT/docker-compose.yml" ] && DOCKER_COMPOSE_FILE="$ROOT/docker-compose.yml"
[ -f "$ROOT/docker-compose.yaml" ] && DOCKER_COMPOSE_FILE="$ROOT/docker-compose.yaml"

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1 && [ -n "$DOCKER_COMPOSE_FILE" ]; then
    svc_list="$(docker compose -f "$DOCKER_COMPOSE_FILE" config --services 2>/dev/null)"
    if echo "$svc_list" | grep -qx "api"; then
      docker compose -f "$DOCKER_COMPOSE_FILE" up -d --build api
    else
      docker compose -f "$DOCKER_COMPOSE_FILE" up -d --build
    fi
  else
    cn="$(docker ps --format '{{.Names}}\t{{.Ports}}' | awk '$0 ~ /:4001->/ {print $1; exit}')"
    if [ -n "${cn:-}" ]; then
      echo "ℹ️ docker compose absent; restart container: $cn"
      docker restart "$cn"
    else
      echo "⚠️ Pas de compose, et pas de container mappant :4001 trouvé."
    fi
  fi
else
  echo "⚠️ docker absent; restart API manuellement."
fi

set -e

echo
echo "🧪 Tests locaux (attendu 200/200/200):"
for u in \
  "http://127.0.0.1:3010/api/health" \
  "http://127.0.0.1:3010/api/partners" \
  "http://127.0.0.1:3010/api/partners/thieyp"
do
  code="$(curl -s -o /dev/null -w "%{http_code}" "$u" || true)"
  echo " - $u -> $code"
done

echo "✅ Done (v3)."
