#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail
API_DIR="services/api/src"
CTRL_FILE="$API_DIR/modules/merchant/merchant.public.controller.ts"
MOD_FILE="$API_DIR/modules/merchant/merchant.module.ts"

# 1) Existe déjà ?
if grep -RIn "Get\\('.*menu" "$API_DIR" >/dev/null 2>&1; then
  echo "✓ Route GET /api/merchants/:id/menu détectée. Rien à faire."
  exit 0
fi

# 2) Controller minimal
mkdir -p "$(dirname "$CTRL_FILE")"
cat > "$CTRL_FILE" <<'TS'
import { Controller, Get, Param } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Controller('api/merchants')
export class MerchantPublicController {
  private prisma = new PrismaClient();
  @Get(':id/menu')
  async getMenu(@Param('id') id: string) {
    return this.prisma.menuItem.findMany({
      where: { merchantId: id },
      orderBy: { name: 'asc' },
    });
  }
}
TS

# 3) Wiring module
if [ -f "$MOD_FILE" ]; then
  # import + ajout aux controllers (idempotent)
  grep -q "MerchantPublicController" "$MOD_FILE" || {
    # Ajoute l'import
    sed -i "1i import { MerchantPublicController } from './merchant.public.controller';" "$MOD_FILE"
    # Ajoute dans controllers: [ ... ]
    perl -0777 -pe 's/controllers:\s*\[([^\]]*)\]/"controllers: [" . $1 . (length($1)?", ":"") . "MerchantPublicController]"/se' -i "$MOD_FILE" || true
  }
else
  echo "⚠️ Module introuvable: $MOD_FILE — ajoute le controller dans le module Merchant à la main."
fi

echo "→ Build & restart…"
pnpm -C services/api build || true
pm2 restart delish-api --update-env
