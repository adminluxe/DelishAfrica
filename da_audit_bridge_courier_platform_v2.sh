#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

TS="$(date -u +"%Y%m%dT%H%M%SZ")"
OUT="/opt/delishafrica/audits/bridge_audit_${TS}"
R="${OUT}/REPORT.md"
mkdir -p "$OUT"
: > "$R"

API_PUBLIC="https://api.delishafrica.me"
API_LOCAL="http://127.0.0.1:3010"
ROOT="/opt/delishafrica/monorepo"
API_DIR="$ROOT/services/api"

log(){ printf "%s\n" "$*" | tee -a "$R" >/dev/null; }

run(){
  log ""
  log "```bash"
  log "\$ $*"
  # exécuter dans CE shell (pas de bash -lc) => variables stables
  ( eval "$*" ) 2>&1 | tee -a "$R" >/dev/null || true
  log "```"
}

need(){
  command -v "$1" >/dev/null 2>&1 || { log "❌ Missing required command: $1"; exit 1; }
}

need curl
need ss

log "# DelishAfrica — Bridge Audit v2 (Courier ↔ Plateforme)"
log "- UTC: $TS"
log "- API_PUBLIC: $API_PUBLIC"
log "- API_LOCAL : $API_LOCAL"
log "- API_DIR   : $API_DIR"
log "- PATH      : $PATH"

log "## 1) Health baseline (public + local)"
run "curl -s -i -m 10 $API_PUBLIC/api/health | sed -n '1,25p'"
run "curl -s -i -m 6  $API_LOCAL/api/health  | sed -n '1,25p'"

log "## 2) Public baseline endpoints (partners)"
run "curl -s -i -m 10 $API_PUBLIC/api/partners | sed -n '1,25p' || true"
run "curl -s -i -m 10 $API_PUBLIC/partners     | sed -n '1,25p' || true"

log "## 3) Listener on 3010 (truth)"
run "ss -lntp | grep -E ':(3010)\\b' || true"

log "## 4) Cloudflared config (ingress excerpt)"
run "test -f /root/.cloudflared/config.yml && sed -n '1,220p' /root/.cloudflared/config.yml || echo 'NO /root/.cloudflared/config.yml'"

log "## 5) Apps env alignment (EXPO_PUBLIC_API_BASE_URL)"
run "for a in client courier merchant; do echo \"--- $a ---\"; sed -n '1,60p' \"$ROOT/apps/$a/.env.local\" 2>/dev/null || echo 'NO .env.local'; done"

log "## 6) API code discovery (courier/dispatch/missions + CORS/auth hints)"
if command -v rg >/dev/null 2>&1; then
  run "cd $API_DIR && rg -n \"(courier|couriers|dispatch|mission|missions)\" -S . --glob '!node_modules/**' --glob '!dist/**' | head -n 220"
  run "cd $API_DIR && rg -n \"cors\\(|Access-Control-Allow|authorization|bearer|jwt\" -S . --glob '!node_modules/**' --glob '!dist/**' | head -n 220"
else
  run "cd $API_DIR && grep -RIn \"courier\\|dispatch\\|mission\\|cors\\|authorization\\|jwt\" . | head -n 220 || true"
fi

log "## 7) Quick endpoint probe (common candidates)"
paths=(
  "/api/couriers"
  "/api/v1/couriers"
  "/api/dispatch"
  "/api/v1/dispatch"
  "/api/v1/dispatch/active"
  "/api/missions"
  "/api/v1/missions"
  "/api/v1/courier/missions"
)

for p in "${paths[@]}"; do
  log ""
  log "### PROBE $p"
  run "curl -s -i -m 10 \"$API_PUBLIC$p\" | sed -n '1,35p'"
done

log ""
log "✅ Report saved: $R"
