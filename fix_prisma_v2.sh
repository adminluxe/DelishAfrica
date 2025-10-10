#!/usr/bin/env bash
set -Eeuo pipefail

log() { printf "\n—— %s ——\n" "$*"; }
on_err() { code=$?; echo "❌ ERREUR (exit $code) à la ligne $BASH_LINENO — regarde fix_prisma_v2.log"; exit $code; }
trap on_err ERR

API_DIR="services/api"
SRC_DIR="$API_DIR/src"
PRISMA_DIR="$SRC_DIR/prisma"
MERCHANT_DIR="$SRC_DIR/modules/merchant"

[ -d "$SRC_DIR" ] || { echo "❌ Dossier $SRC_DIR introuvable. Lance ce script depuis la racine du repo."; exit 1; }

log "1) Préparer prisma/ (service + module)"
mkdir -p "$PRISMA_DIR"

# PrismaService
if [ ! -f "$PRISMA_DIR/prisma.service.ts" ]; then
  cat > "$PRISMA_DIR/prisma.service.ts" <<'TS'
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
TS
  echo "✅ prisma.service.ts créé"
else
  echo "ℹ️  prisma.service.ts existe déjà (ok)"
fi

# PrismaModule
if [ ! -f "$PRISMA_DIR/prisma.module.ts" ]; then
  cat > "$PRISMA_DIR/prisma.module.ts" <<'TS'
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
TS
  echo "✅ prisma.module.ts créé"
else
  echo "ℹ️  prisma.module.ts existe déjà (ok)"
fi

# index.ts
if [ ! -f "$PRISMA_DIR/index.ts" ]; then
  cat > "$PRISMA_DIR/index.ts" <<'TS'
export * from './prisma.service';
export * from './prisma.module';
TS
  echo "✅ prisma/index.ts créé"
else
  echo "ℹ️  prisma/index.ts existe déjà (ok)"
fi

log "2) Patch merchant.module.ts (imports + providers)"
if [ -f "$MERCHANT_DIR/merchant.module.ts" ]; then
  node - <<'NODE'
const fs = require('fs');
const path = 'services/api/src/modules/merchant/merchant.module.ts';
let s = fs.readFileSync(path, 'utf8');
let changed = false;

if (!/from '\.\.\/\.\.\/prisma\/prisma\.module'/.test(s)) {
  s = s.replace(/(^import[\s\S]*?;)(\s*)/m,
    `$1\nimport { PrismaModule } from '../../prisma/prisma.module';\nimport { PrismaService } from '../../prisma/prisma.service';\n`);
  changed = true;
}
if (/@Module\(\{[\s\S]*?\}\)\s*export class/m.test(s)) {
  s = s.replace(/@Module\(\{([\s\S]*?)\}\)/m, (m, inner) => {
    if (!/imports\s*:\s*\[/.test(inner)) {
      inner = `imports: [PrismaModule],\n` + inner;
      changed = true;
    } else if (!/imports\s*:\s*\[[^\]]*PrismaModule/.test(inner)) {
      inner = inner.replace(/imports\s*:\s*\[([^\]]*)\]/m, (mm, g) => `imports: [${g.trim()}${g.trim()?', ':''}PrismaModule]`);
      changed = true;
    }
    if (!/providers\s*:\s*\[/.test(inner)) {
      inner = inner.replace(/imports\s*:\s*\[[^\]]*\],?/m, (mm) => mm + `\nproviders: [PrismaService],`);
      changed = true;
    } else if (!/providers\s*:\s*\[[^\]]*PrismaService/.test(inner)) {
      inner = inner.replace(/providers\s*:\s*\[([^\]]*)\]/m, (mm, g) => `providers: [${g.trim()}${g.trim()?', ':''}PrismaService]`);
      changed = true;
    }
    return `@Module({${inner}})`;
  });
}
if (changed) {
  fs.writeFileSync(path, s);
  console.log('✅ merchant.module.ts patché');
} else {
  console.log('ℹ️  merchant.module.ts déjà correct');
}
NODE
else
  echo "⚠️  $MERCHANT_DIR/merchant.module.ts introuvable — étape ignorée"
fi

log "3) Patch merchant.service.ts (import relatif stable)"
if [ -f "$MERCHANT_DIR/merchant.service.ts" ]; then
  sed -i "s#from 'src/prisma/prisma.service'#from '../../prisma/prisma.service'#g" "$MERCHANT_DIR/merchant.service.ts" || true
  sed -i "s#from \"src/prisma/prisma.service\"#from '../../prisma/prisma.service'#g" "$MERCHANT_DIR/merchant.service.ts" || true
  echo "✅ merchant.service.ts : import corrigé (si nécessaire)"
else
  echo "⚠️  $MERCHANT_DIR/merchant.service.ts introuvable — étape ignorée"
fi

log "4) Dépendances Prisma dans services/api"
# On n'échoue pas si pnpm absent : on informe seulement
if command -v pnpm >/dev/null 2>&1; then
  set +e
  pnpm -C "$API_DIR" add @prisma/client@latest
  add_client=$?
  [ $add_client -ne 0 ] && echo "⚠️  @prisma/client non ajouté (peut déjà exister)"
  if [ -f "$API_DIR/prisma/schema.prisma" ]; then
    pnpm -C "$API_DIR" add -D prisma@latest
    pnpm -C "$API_DIR" exec prisma generate
  else
    echo "ℹ️  Pas de $API_DIR/prisma/schema.prisma — génération du client sautée"
  fi
  set -e
else
  echo "❗ pnpm non trouvé. Installe-le ou utilise npm/yarn dans services/api."
fi

log "5) État final"
ls -la "$PRISMA_DIR" || true
echo "✅ Fix terminé."
echo "👉 Démarrage conseillé :"
echo "   PORT=4001 pnpm -C services/api exec ts-node --transpile-only src/main.ts"
echo "   (ou avec aliases) PORT=4001 pnpm -C services/api exec ts-node -r tsconfig-paths/register --transpile-only src/main.ts"
