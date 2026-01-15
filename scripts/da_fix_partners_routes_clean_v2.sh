#!/usr/bin/env bash
set -euo pipefail

TS="$(date +%Y%m%d_%H%M%S)"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== DelishAfrica | Fix Partners Routes (v2) =="
echo "Root: $ROOT"
echo

die() { echo "❌ $*" >&2; exit 1; }

pick_api_root() {
  # 1) Chemin canon (d'après l'organisation monorepo)
  local cand="$ROOT/services/api"
  if [ -f "$cand/package.json" ] && [ -d "$cand/src" ] && grep -q '"@nestjs/core"' "$cand/package.json" 2>/dev/null; then
    echo "$cand"; return 0
  fi

  # 2) Cherche un app.module.ts NestJS et remonte au package.json
  local f api
  while IFS= read -r f; do
    api="$(dirname "$(dirname "$f")")" # .../src/app.module.ts -> .../
    if [ -f "$api/package.json" ] && [ -d "$api/src" ] && grep -q '"@nestjs/core"' "$api/package.json" 2>/dev/null; then
      echo "$api"; return 0
    fi
  done < <(find "$ROOT" -maxdepth 6 -type f -name "app.module.ts" 2>/dev/null | head -n 20)

  # 3) Fallback: main.ts contenant NestFactory
  while IFS= read -r f; do
    if grep -q "NestFactory" "$f" 2>/dev/null; then
      api="$(dirname "$(dirname "$f")")"
      if [ -f "$api/package.json" ] && [ -d "$api/src" ]; then
        echo "$api"; return 0
      fi
    fi
  done < <(find "$ROOT" -maxdepth 6 -type f -name "main.ts" 2>/dev/null | head -n 50)

  return 1
}

API_ROOT="$(pick_api_root || true)"
[ -n "${API_ROOT:-}" ] || die "Impossible de localiser le dossier API NestJS. Attendu typiquement: $ROOT/services/api"

echo "✅ API_ROOT détecté: $API_ROOT"

APP_MODULE="$API_ROOT/src/app.module.ts"
[ -f "$APP_MODULE" ] || APP_MODULE="$(find "$API_ROOT" -maxdepth 3 -type f -name "app.module.ts" 2>/dev/null | head -n 1 || true)"
[ -f "${APP_MODULE:-}" ] || die "app.module.ts introuvable dans $API_ROOT"

echo "app.module.ts: $APP_MODULE"
cp -a "$APP_MODULE" "$APP_MODULE.bak.$TS"
echo "Backup: $APP_MODULE.bak.$TS"

PARTNERS_DIR="$API_ROOT/src/partners"
CTRL="$PARTNERS_DIR/partners.controller.ts"
mkdir -p "$PARTNERS_DIR"
[ ! -f "$CTRL" ] || cp -a "$CTRL" "$CTRL.bak.$TS"

cat > "$CTRL" << 'TS'
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

type Partner = {
  slug: string;
  name: string;
  city?: string;
  country?: string;
  tagline?: string;
  heroImageUrl?: string;
  isDemo?: boolean;
};

const PARTNERS: Partner[] = [
  {
    slug: 'thieyp',
    name: 'Thieyp',
    city: 'Bruxelles',
    country: 'BE',
    tagline: 'Mode démo — Restaurant partenaire',
    heroImageUrl: '',
    isDemo: true,
  },
  {
    slug: 'demo-1',
    name: 'AfriFood Corner',
    city: 'Bruxelles',
    country: 'BE',
    tagline: 'Mode démo — Partenaire',
    heroImageUrl: '',
    isDemo: true,
  },
  {
    slug: 'demo-2',
    name: 'Sawa Kitchen',
    city: 'Bruxelles',
    country: 'BE',
    tagline: 'Mode démo — Partenaire',
    heroImageUrl: '',
    isDemo: true,
  },
];

@Controller('partners')
export class PartnersController {
  @Get()
  list() {
    return PARTNERS;
  }

  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    const p = PARTNERS.find((x) => x.slug === slug);
    if (!p) throw new NotFoundException('Partner not found');
    return p;
  }
}
TS

echo "✅ Controller écrit: $CTRL"
[ -f "$CTRL.bak.$TS" ] && echo "Backup: $CTRL.bak.$TS" || true

echo
echo "🔧 Patch app.module.ts (ajout PartnersController)…"

node <<'NODE' "$APP_MODULE"
const fs = require('fs');

const file = process.argv[1];
let s = fs.readFileSync(file, 'utf8');

const has = (needle) => s.includes(needle);
const importNeedle = "./partners/partners.controller";

if (!has('PartnersController')) {
  // 1) Import
  if (!has(importNeedle)) {
    const importLine = "import { PartnersController } from './partners/partners.controller';";
    const lines = s.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImport = i;
    }
    if (lastImport >= 0) lines.splice(lastImport + 1, 0, importLine);
    else lines.unshift(importLine);
    s = lines.join('\n');
  }

  // 2) Ajout dans controllers: [...]
  const re = /controllers\s*:\s*\[/m;
  const match = re.exec(s);
  if (!match) {
    console.error("❌ Impossible de trouver 'controllers: [' dans app.module.ts");
    process.exit(1);
  }

  const open = match.index + match[0].length - 1; // index du '['
  let depth = 0;
  let close = -1;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) { close = i; break; }
    }
  }
  if (close === -1) {
    console.error("❌ Crochet fermant ']' introuvable pour controllers");
    process.exit(1);
  }

  const inner = s.slice(open + 1, close);
  const trimmed = inner.trim();

  let updatedInner = inner;
  if (trimmed.length === 0) {
    updatedInner = 'PartnersController';
  } else if (trimmed.includes('PartnersController')) {
    // rien
  } else if (trimmed.endsWith(',')) {
    updatedInner = inner + ' PartnersController';
  } else {
    updatedInner = inner + ', PartnersController';
  }

  s = s.slice(0, open + 1) + updatedInner + s.slice(close);
  fs.writeFileSync(file, s, 'utf8');
  console.log('✅ PartnersController ajouté dans app.module.ts');
} else {
  console.log('ℹ️ PartnersController déjà présent (skip)');
}
NODE

echo
echo "♻️ Restart API (Docker si port 4001 mappé, sinon PM2 delish-api si présent)…"

restarted="no"

if command -v docker >/dev/null 2>&1; then
  c="$(docker ps --format '{{.Names}}\t{{.Ports}}' | awk '$2 ~ /:4001->/ {print $1; exit}')"
  if [ -n "${c:-}" ]; then
    echo "→ Docker container détecté sur :4001 -> $c"
    docker restart "$c" >/dev/null
    restarted="yes"
  fi
fi

if [ "$restarted" = "no" ] && command -v pm2 >/dev/null 2>&1; then
  if pm2 list 2>/dev/null | grep -q "delish-api"; then
    echo "→ PM2 process delish-api détecté"
    pm2 restart delish-api >/dev/null || true
    restarted="yes"
  fi
fi

if [ "$restarted" = "no" ]; then
  echo "⚠️ Restart auto non déterminé (ni docker :4001, ni pm2 delish-api)."
  echo "   ➜ Redémarre l’API manuellement (docker compose / pm2 / node) puis relance les tests ci-dessous."
fi

sleep 1
echo
echo "🧪 Tests local (doit être 200/200/200) :"
for p in /api/health /api/partners /api/partners/thieyp; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3010$p" || true)"
  echo "  http://127.0.0.1:3010$p -> $code"
done

echo
echo "✅ Fin Fix Partners (v2)"
