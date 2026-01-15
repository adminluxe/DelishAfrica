#!/usr/bin/env bash
set -euo pipefail

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
run(){ log ""; log "```bash"; bash -lc "$*" 2>&1 | tee -a "$R" >/dev/null || true; log "```"; }

log "# DelishAfrica — Bridge Audit (Courier ↔ Plateforme)"
log "- UTC: $TS"
log "- API_PUBLIC: $API_PUBLIC"
log "- API_LOCAL: $API_LOCAL"
log "- API_DIR: $API_DIR"

log "## 1) Health / Partners (public + local)"
run "curl -s -i -m 8 $API_PUBLIC/api/health | sed -n '1,20p'"
run "curl -s -i -m 8 $API_LOCAL/api/health | sed -n '1,20p'"
run "curl -s -i -m 8 $API_PUBLIC/api/partners | sed -n '1,20p' || true"
run "curl -s -i -m 8 $API_PUBLIC/partners | sed -n '1,20p' || true"

log "## 2) Cloudflared mapping sanity"
run "test -f /root/.cloudflared/config.yml && sed -n '1,200p' /root/.cloudflared/config.yml || echo 'NO /root/.cloudflared/config.yml'"
run "ss -lntp | grep -E ':(3010)\\b' || true"

log "## 3) Apps env alignment (EXPO_PUBLIC_API_BASE_URL)"
run "grep -R \"^EXPO_PUBLIC_API_BASE_URL=\" -n $ROOT/apps 2>/dev/null || true"
run "for a in client courier merchant; do echo \"--- $a ---\"; sed -n '1,40p' \"$ROOT/apps/$a/.env.local\" 2>/dev/null || true; done"

log "## 4) API routes discovery (courier/dispatch/missions)"
if command -v rg >/dev/null 2>&1; then
  run "cd $API_DIR && rg -n \"courier|couriers|dispatch|mission|missions\" -S . --glob '!node_modules/**' --glob '!dist/**' | head -n 200"
  log "## 5) CORS/Auth hints"
  run "cd $API_DIR && rg -n \"cors\\(|Access-Control-Allow|authorization|bearer|jwt\" -S . --glob '!node_modules/**' --glob '!dist/**' | head -n 200"
else
  run "cd $API_DIR && grep -RIn \"courier\\|dispatch\\|mission\\|cors\\|authorization\\|jwt\" . | head -n 200 || true"
fi

log "## 6) Quick endpoint probe (common candidates)"
paths=(
  "/api/couriers"
  "/api/v1/couriers"
  "/api/dispatch"
  "/api/v1/dispatch"
  "/api/missions"
  "/api/v1/missions"
  "/api/v1/dispatch/active"
)
for p in "${paths[@]}"; do
  log ""
  log "### PROBE $p"
  run "curl -s -i -m 8 $API_PUBLIC$p | sed -n '1,25p'"
done

log ""
log "✅ Report: $R"
