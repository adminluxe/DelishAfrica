#!/usr/bin/env bash
# =====================================================================
# DelishAfrica – setup_thiepy_demo.sh (V4 – API réelle : backendsrc)
# Ajoute un module "ThiepyDemo" à l’API NestJS (demo-orders)
# API réelle : /opt/delishafrica/monorepo/delishafrica-monorepo/backendsrc
# =====================================================================

set -euo pipefail

API_DIR="/opt/delishafrica/monorepo/delishafrica-monorepo/backendsrc"
SRC_DIR="${API_DIR}"
DEMO_DIR="${SRC_DIR}/thiepy-demo"
APP_MODULE="${SRC_DIR}/app.module.ts"

log()  { echo -e "[THIEPY-DEMO] $*"; }
ok()   { echo -e "[THIEPY-DEMO] ✅ $*"; }
err()  { echo -e "[THIEPY-DEMO] ❌ $*"; }

# --- Vérifications ---
if [[ ! -d "${API_DIR}" ]]; then
  err "Répertoire API introuvable : ${API_DIR}"
  exit 1
fi

if [[ ! -f "${APP_MODULE}" ]]; then
  err "Fichier app.module.ts introuvable : ${APP_MODULE}"
  exit 1
fi

log "API trouvée : ${API_DIR}"
log "app.module.ts OK."

# --- Création module ---
mkdir -p "${DEMO_DIR}/dto" "${DEMO_DIR}/entities"

cat > "${DEMO_DIR}/thiepy-demo.module.ts" <<'EOF'
import { Module } from '@nestjs/common';
import { ThiepyDemoController } from './thiepy-demo.controller';
import { ThiepyDemoService } from './thiepy-demo.service';

@Module({
  controllers: [ThiepyDemoController],
  providers: [ThiepyDemoService],
})
export class ThiepyDemoModule {}
EOF

cat > "${DEMO_DIR}/thiepy-demo.service.ts" <<'EOF'
import { Injectable } from '@nestjs/common';
import { CreateDemoOrderDto } from './dto/create-demo-order.dto';
import { DemoOrder } from './entities/demo-order.entity';

@Injectable()
export class ThiepyDemoService {
  private orders: DemoOrder[] = [];

  private ensureDefault() {
    if (this.orders.length === 0) this.create({});
  }

  create(dto: CreateDemoOrderDto): DemoOrder {
    const id = `THIEPY-DEMO-${this.orders.length + 1}`;
    const now = new Date().toISOString();

    const order: DemoOrder = {
      id,
      createdAt: now,
      status: 'pending',
      restaurantSlug: 'thieyp',
      restaurantName: 'Thiepy – Démo',
      customerName: dto.customerName ?? 'Client démo',
      customerAddress: dto.customerAddress ?? 'Adresse de démo',
      totalAmount: dto.totalAmount ?? 19.9,
      currency: dto.currency ?? 'EUR',
    };

    this.orders.unshift(order);
    return order;
  }

  findAll(): DemoOrder[] {
    this.ensureDefault();
    return this.orders;
  }
}
EOF

cat > "${DEMO_DIR}/thiepy-demo.controller.ts" <<'EOF'
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ThiepyDemoService } from './thiepy-demo.service';
import { CreateDemoOrderDto } from './dto/create-demo-order.dto';

@Controller('api')
export class ThiepyDemoController {
  constructor(private readonly service: ThiepyDemoService) {}

  @Post('demo-orders')
  create(@Body() dto: CreateDemoOrderDto) {
    return this.service.create(dto);
  }

  @Get('demo-orders')
  findAll() {
    return this.service.findAll();
  }
}
EOF

cat > "${DEMO_DIR}/dto/create-demo-order.dto.ts" <<'EOF'
export class CreateDemoOrderDto {
  customerName?: string;
  customerAddress?: string;
  totalAmount?: number;
  currency?: string;
}
EOF

cat > "${DEMO_DIR}/entities/demo-order.entity.ts" <<'EOF'
export type DemoOrderStatus = 'pending' | 'prepared' | 'picked-up' | 'delivered';

export class DemoOrder {
  id: string;
  createdAt: string;
  status: DemoOrderStatus;
  restaurantSlug: string;
  restaurantName: string;
  customerName: string;
  customerAddress: string;
  totalAmount: number;
  currency: string;
}
EOF

# --- Patch app.module.ts ---
log "Patch app.module.ts..."

cp "${APP_MODULE}" "${APP_MODULE}.before_thiepy_demo"

node <<'NODE'
const fs = require("fs");
const path = require("path");

const file = path.join("app.module.ts");
let content = fs.readFileSync(file, "utf8");

if (!content.includes("ThiepyDemoModule")) {

  content =
    "import { ThiepyDemoModule } from './thiepy-demo/thiepy-demo.module';\n" +
    content;

  content = content.replace(
    /imports:\s*\[/,
    "imports: [ThiepyDemoModule, "
  );
}

fs.writeFileSync(file, content);
NODE

ok "Module ThiepyDemo installé avec succès."
