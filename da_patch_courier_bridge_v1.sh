#!/usr/bin/env bash
set -euo pipefail

API_DIR="/opt/delishafrica/monorepo/services/api"
[[ -f "$API_DIR/package.json" ]] || { echo "❌ API_DIR introuvable: $API_DIR"; exit 1; }

TS="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT="/opt/delishafrica/audits/patch_courier_bridge_${TS}"
mkdir -p "$OUT"

backup(){ [[ -f "$1" ]] && cp -a "$1" "$OUT/$(echo "$1" | sed 's#/#_#g').bak"; }

is_nest(){
  node -e "p=require('$API_DIR/package.json');d={...(p.dependencies||{}),...(p.devDependencies||{})};process.exit(d['@nestjs/core']?0:1)" >/dev/null 2>&1
}

echo "=== Patch Courier Bridge v1 ==="
echo "API_DIR=$API_DIR"
echo "OUT=$OUT"

if is_nest; then
  echo "✅ Detected: NestJS"

  MAIN="$API_DIR/src/main.ts"
  APPMOD="$API_DIR/src/app.module.ts"
  [[ -f "$MAIN" ]] || { echo "❌ Missing $MAIN"; exit 1; }
  [[ -f "$APPMOD" ]] || { echo "❌ Missing $APPMOD"; exit 1; }

  mkdir -p "$API_DIR/src/courier"
  CTRL="$API_DIR/src/courier/courier.controller.ts"
  MOD="$API_DIR/src/courier/courier.module.ts"

  # Create controller if missing
  if [[ ! -f "$CTRL" ]]; then
    cat > "$CTRL" <<'TS'
import { Controller, Get } from '@nestjs/common';

@Controller('api/v1')
export class CourierController {
  @Get('dispatch/active')
  dispatchActive() {
    return {
      ok: true,
      active: true,
      demo: true,
      message: 'Demo active dispatch (bridge)',
      mission: {
        id: 'demo-mission-1',
        partnerSlug: 'thieyp',
        pickup: 'Restaurant Thieyp (demo)',
        dropoff: 'Client (demo)',
        status: 'assigned',
      },
    };
  }

  @Get('missions')
  missions() {
    return {
      ok: true,
      demo: true,
      missions: [
        { id: 'demo-mission-1', status: 'assigned', partnerSlug: 'thieyp' },
      ],
    };
  }

  @Get('couriers/me')
  me() {
    return {
      ok: true,
      demo: true,
      courier: {
        id: 'demo-courier-1',
        name: 'Demo Courier',
        status: 'online',
      },
    };
  }
}
TS
  fi

  # Create module if missing
  if [[ ! -f "$MOD" ]]; then
    cat > "$MOD" <<'TS'
import { Module } from '@nestjs/common';
import { CourierController } from './courier.controller';

@Module({
  controllers: [CourierController],
})
export class CourierModule {}
TS
  fi

  # Wire into AppModule (idempotent)
  backup "$APPMOD"
  if ! grep -q "CourierModule" "$APPMOD"; then
    # add import
    sed -i "1i\\import { CourierModule } from './courier/courier.module';" "$APPMOD"
    # add to imports array
    perl -0777 -i -pe "s/imports:\\s*\\[([^\\]]*)\\]/imports: [\$1, CourierModule]/s" "$APPMOD"
  fi

  # Ensure CORS enabled in main.ts (idempotent)
  backup "$MAIN"
  if ! grep -q "enableCors" "$MAIN"; then
    perl -0777 -i -pe "s/(const app = await NestFactory\\.create\\([^\\)]*\\);)/\$1\\n  app.enableCors({ origin: true, credentials: true, allowedHeaders: ['Content-Type','Authorization'] });/s" "$MAIN"
  fi

  echo "✅ Nest patch applied."

else
  echo "✅ Detected: Express/Other (fallback patch)"
  # Find file where /api/health route is declared
  FILE="$(grep -RIn \"api/health\" \"$API_DIR/src\" 2>/dev/null | head -n 1 | cut -d: -f1 || true)"
  [[ -n "$FILE" ]] || { echo "❌ Cannot find a file containing api/health in $API_DIR/src"; exit 1; }

  backup "$FILE"
  if grep -q "TONTON_COURIER_BRIDGE_V1" "$FILE"; then
    echo "✅ Bridge already present in $FILE"
  else
    cat >> "$FILE" <<'JS'

/* === TONTON_COURIER_BRIDGE_V1 ===
   Minimal bridge endpoints for Courier ↔ Plateforme
*/
try {
  // CORS permissif (debug)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.get('/api/v1/dispatch/active', (req, res) => {
    res.json({ ok:true, active:true, demo:true, mission:{ id:'demo-mission-1', partnerSlug:'thieyp', status:'assigned' } });
  });

  app.get('/api/v1/missions', (req, res) => {
    res.json({ ok:true, demo:true, missions:[{ id:'demo-mission-1', status:'assigned', partnerSlug:'thieyp' }] });
  });

  app.get('/api/v1/couriers/me', (req, res) => {
    res.json({ ok:true, demo:true, courier:{ id:'demo-courier-1', name:'Demo Courier', status:'online' } });
  });
} catch (e) {
  // ignore if app not in scope
}
/* === /TONTON_COURIER_BRIDGE_V1 === */
JS
    echo "✅ Express patch appended to $FILE"
  fi
fi

echo ""
echo "=== NEXT: restart API ==="
echo "Run the API start command you normally use (tmux window 1)."
echo ""
echo "Smoke tests:"
echo "  curl -i https://api.delishafrica.me/api/v1/dispatch/active"
echo "  curl -i https://api.delishafrica.me/api/v1/missions"
echo "  curl -i https://api.delishafrica.me/api/v1/couriers/me"
