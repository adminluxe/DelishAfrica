# === da-fix-appmodule.v2.sh ===
set -euo pipefail
API="/opt/delishafrica/monorepo/services/api"
APP="$API/src/app.module.ts"

[ -f "$APP" ] || { echo "Introuvable: $APP"; exit 1; }
cp -a "$APP" "$APP.bak.$(date +%F-%H%M%S)"

# Patch via Node en passant le chemin en ARG (pas d'env var)
node - "$APP" <<'NODE'
const fs=require('fs');
const p=process.argv[2];
let s=fs.readFileSync(p,'utf8');

// 1) Supprimer un éventuel import direct du controller de santé
s = s.replace(/^\s*import\s*{\s*HealthController\s*}\s*from\s*'\.\/health\/health\.controller';?\s*$/m, '');

// 2) Ajouter l'import du HealthModule s'il manque
if (!/from\s*'\.\/health\/health\.module'/.test(s)) {
  // insère juste après la première ligne d'import
  s = s.replace(/(^import[^\n]*\n)/, `$1import { HealthModule } from './health/health.module';\n`);
}

// 3) Ajouter HealthModule dans imports:[…] (ou créer imports si absent)
if (/imports\s*:\s*\[/.test(s)) {
  s = s.replace(/imports\s*:\s*\[([\s\S]*?)\]/m, (full, inner)=>{
    if (!/\bHealthModule\b/.test(inner)) inner = `HealthModule, ${inner}`.replace(/,\s*]/,']');
    return `imports: [${inner}]`;
  });
} else {
  s = s.replace(/@Module\s*\(\s*{/, '@Module({ imports: [HealthModule],');
}

// 4) Retirer HealthModule/HealthController de controllers:[…] s'ils traînent
s = s.replace(/controllers\s*:\s*\[([\s\S]*?)\]/m, (full, inner)=>{
  const items = inner.split(',').map(t=>t.trim()).filter(Boolean)
    .filter(x => x !== 'HealthModule' && x !== 'HealthController');
  return `controllers: [${items.join(', ')}]`;
});

fs.writeFileSync(p, s);
console.log('✔ AppModule patché.');
NODE

# Build + (re)start
cd "$API"
pnpm install --silent || true
pnpm build || true

if pm2 describe delish-api >/dev/null 2>&1; then
  pm2 restart delish-api
else
  if [ -f "dist/main.js" ]; then
    pm2 start "node dist/main.js" --name delish-api
  else
    pm2 start "pnpm start:prod" --name delish-api
  fi
fi
sleep 2

echo "→ Test API locale :4001"
curl -sf http://127.0.0.1:3010/api/health && echo " (OK local)"

echo "→ Test Nginx local (HTTPS + Host)"
curl -skI -H "Host: api.delishafrica.me" https://127.0.0.1/api/health | head -n1

echo "→ Test public (Cloudflare)"
curl -svo /dev/null https://api.delishafrica.me/api/health 2>&1 | sed -n '1,12p'
echo
curl -s https://api.delishafrica.me/api/health && echo
