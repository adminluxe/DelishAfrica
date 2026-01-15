#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
log(){ echo "[$(date +'%H:%M:%S')] $*"; }

log "=== TONTON RECOVER ALL STRICT ==="

# 1) kill 3010 hard (phantom)
bash "$ROOT/scripts/da_kill_3010_hard.sh" 3010

# 2) start API strict (single instance)
bash "$ROOT/scripts/da_api_supervisor_3010_strict.sh"

# 3) gate E2E (ton script existant)
if [[ -x "$ROOT/scripts/da_flow_gate_e2e.sh" ]]; then
  bash "$ROOT/scripts/da_flow_gate_e2e.sh"
else
  log "⚠️ da_flow_gate_e2e.sh introuvable/exécutable. (OK si tu l’as sous un autre nom)"
  ls -la "$ROOT/scripts" | grep -E "gate|smoke|flow" || true
fi

log "=== OK. Maintenant relance Client/Merchant/Courier ==="
log "Rappel: ne lance PAS 'pnpm dev' API à la main. API = supervisor only."
