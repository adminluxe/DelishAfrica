#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"

echo "== DelishAfrica | Fix Partners Routes =="
echo "Root: $ROOT"

# 1) Trouver le dossier API
API_DIR=""
CANDIDATES=(
  "$ROOT/services/api"
  "$ROOT/service/api"
  "$ROOT/backend"
  "$ROOT/api"
  "$ROOT/apps/api"
)

for d in "${CANDIDATES[@]}"; do
  if [ -f "$d/package.json" ] && [ -d "$d/src" ]; then
    API_DIR="$d"
    break
  fi
done

if [ -z "$API_DIR" ]; then
  echo "❌ Impossible de trouver le dossier API (package.json + src)."
  echo "   Candidats testés:"
  printf " - %s\n" "${CANDIDATES[@]}"
  exit 1
fi

SRC="$API_DIR/src"
MODULE="$(find "$SRC" -maxdepth 4 -name app.module.ts | head -n 1 || true)"
if [ -z "${MODULE:-}" ] || [ ! -f "$MODULE" ]; then
  echo "❌ app.module.ts introuvable sous: $SRC"
  exit 1
fi

echo "API_DIR : $API_DIR"
echo "MODULE  : $MODULE"

# 2) Backup module
cp -a "$MODULE" "$MODULE.bak.$TS"
echo "✅ Backup: $MODULE.bak.$TS"

# 3) Créer le controller Partners (si absent)
CTRL="$SRC/partners.controller.ts"
if [ ! -f "$CTRL" ]; then
  cat > "$CTRL" << 'TSFILE'
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

type Partner = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  tagline?: string;
  cuisine?: string[];
  rating?: number;
  heroImageUrl?: string;
};

const PARTNERS: Partner[] = [
  {
    id: 'thieyp',
    slug: 'thieyp',
    name: 'Thieyp',
    city: 'Bruxelles',
    country: 'BE',
    tagline: 'Mode démo — partenaire vitrine',
    cuisine: ['Sénégalais', 'Africain'],
    rating: 4.7,
    heroImageUrl: 'https://picsum.photos/seed/thieyp/1200/800',
  },
  {
    id: 'afro-bowl',
    slug: 'afro-bowl',
    name: 'Afro Bowl',
    city: 'Bruxelles',
    country: 'BE',
    tagline: 'Fast-good afro',
    cuisine: ['Pan-africain'],
    rating: 4.5,
    heroImageUrl: 'https://picsum.photos/seed/afrobowl/1200/800',
  },
];

@Controller('partners')
export class PartnersController {
  @Get()
  list() {
    // Retour simple et tolérant côté apps : array directe
    return PARTNERS;
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    const found = PARTNERS.find((p) => p.slug === slug);
    if (!found) throw new NotFoundException(`Partner not found: ${slug}`);
    return found;
  }
}
TSFILE
  echo "✅ Created: $CTRL"
else
  echo "ℹ️ Already exists: $CTRL (skip)"
fi

# 4) Patch app.module.ts (import + controllers)
node - "$MODULE" << 'NODE'
const fs = require("fs");

const file = process.argv[1];
let s = fs.readFileSync(file, "utf8");

// Helper: insert import after last import line
function ensureImport(code) {
  const importLine = `import { PartnersController } from './partners.controller';`;
  if (code.includes(importLine)) return code;

  // si un import PartnersController existe déjà sous une autre forme
  if (/PartnersController/.test(code) && /from\s+['"]\.\/partners\.controller['"]/.test(code)) {
    return code;
  }

  const lines = code.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImport = i;
  }
  if (lastImport === -1) {
    throw new Error("No import lines found in app.module.ts");
  }
  lines.splice(lastImport + 1, 0, importLine);
  return lines.join("\n");
}

function ensureInControllers(code) {
  // Cherche "controllers: [ ... ]"
  const re = /controllers\s*:\s*\[([\s\S]*?)\]/m;
  const m = code.match(re);
  if (!m) throw new Error("controllers: [ ... ] not found in app.module.ts");

  const inside = m[1];
  if (inside.includes("PartnersController")) return code;

  let newInside = inside;
  const trimmed = inside.trim();

  if (trimmed.length === 0) {
    newInside = "PartnersController";
  } else {
    // Ajout propre avec virgule
    const endsWithComma = trimmed.endsWith(",");
    newInside = inside.replace(/\s*$/, "");
    newInside += (endsWithComma ? " " : ", ") + "PartnersController";
  }

  return code.replace(re, `controllers: [${newInside}]`);
}

try {
  let out = s;
  out = ensureImport(out);
  out = ensureInControllers(out);
  if (out !== s) fs.writeFileSync(file, out, "utf8");
} catch (e) {
  console.error("❌ Patch failed:", e.message);
  process.exit(1);
}
NODE

echo "✅ app.module.ts patched OK"

# 5) Restart API (docker > pm2)
restarted="0"

if command -v docker >/dev/null 2>&1; then
  CN="$(docker ps --format '{{.Names}}' | grep -E 'delish.*api' | head -n 1 || true)"
  if [ -n "${CN:-}" ]; then
    echo "🔄 docker restart: $CN"
    docker restart "$CN" >/dev/null
    restarted="1"
    sleep 2
  fi
fi

if [ "$restarted" = "0" ] && command -v pm2 >/dev/null 2>&1; then
  if pm2 jlist 2>/dev/null | grep -q '"name":"delish-api"'; then
    echo "🔄 pm2 restart: delish-api"
    pm2 restart delish-api >/dev/null
    restarted="1"
    sleep 2
  fi
fi

if [ "$restarted" = "0" ]; then
  echo "⚠️ Je n'ai pas trouvé de container 'delish*api' ni de process pm2 'delish-api'."
  echo "   => Redémarre manuellement ton API (Docker Compose / pm2 / node) puis relance le doctor."
fi

# 6) Tests rapides
echo "🧪 Tests local endpoints:"
for u in \
  "http://127.0.0.1:3010/api/health" \
  "http://127.0.0.1:3010/api/partners" \
  "http://127.0.0.1:3010/api/partners/thieyp"
do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$u" || true)"
  echo " - $u -> $code"
done

echo "✅ Done."
