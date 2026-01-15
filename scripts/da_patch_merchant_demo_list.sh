#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/tonton_backups/merchant_patch_${TS}"
LOG="$ROOT/tonton_logs/merchant_patch_${TS}.log"
mkdir -p "$BK" "$ROOT/tonton_logs"

log(){ echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }

cd "$ROOT"
log "== MERCHANT PATCH demo/list =="
log "APP=$APP"
log "BK=$BK"
log "LOG=$LOG"

if [[ ! -d "$APP" ]]; then
  log "❌ apps/merchant introuvable: $APP"
  exit 1
fi

# 1) Trouver les fichiers Merchant qui parlent des orders/demo ou /orders
log "[1] Scan fichiers cibles..."
mapfile -t CAND < <(grep -RIl --line-number -E "orders/demo|demo/list|status-ready|/api/v1/orders" "$APP" 2>/dev/null | head -n 25 || true)

if [[ ${#CAND[@]} -eq 0 ]]; then
  log "❌ Aucun fichier candidat trouvé (orders/demo|/api/v1/orders) dans merchant."
  log "👉 Donne-moi: grep -RIn \"orders\" $APP | head"
  exit 1
fi

log "Candidats:"
for f in "${CAND[@]}"; do log " - $f"; done

# 2) On choisit le meilleur candidat : priorise *orders*demo* ou écran commandes
TARGET=""
for f in "${CAND[@]}"; do
  if echo "$f" | grep -qiE "orders|commande|workflow|demo"; then TARGET="$f"; break; fi
done
TARGET="${TARGET:-${CAND[0]}}"
log "[2] TARGET=$TARGET"

cp -a "$TARGET" "$BK/$(basename "$TARGET").bak"
log "Backup -> $BK/$(basename "$TARGET").bak"

# 3) Patch: remplacer toute logique "status-ready" / GET list / mauvais endpoint par POST demo/list + partnerSlug
#    On fait un patch best-effort : si on repère une URL orders, on la force.
log "[3] Patch contenu (best-effort)..."

# a) Remplace l'endpoint status-ready (souvent faux/inexistant côté demo) par demo/list
perl -0777 -i -pe '
  s#/api/v1/orders/status-ready#\/api\/v1\/orders\/demo\/list#g;
  s#status-ready#demo\/list#g;
' "$TARGET"

# b) Force toute URL "orders/demo/list" ou "orders/list" vers "/api/v1/orders/demo/list"
perl -0777 -i -pe '
  s#\/api\/v1\/orders\/(demo\/list|list)#\/api\/v1\/orders\/demo\/list#g;
  s#\/api\/v1\/orders\/demo\/get#\/api\/v1\/orders\/demo\/list#g;
' "$TARGET"

# c) Si on trouve un fetch(...orders...) on force method POST + body partnerSlug (patch simple)
#    (si le code est très différent, on ne casse pas: on n’injecte que si pattern fetch(".../api/v1/orders...")
perl -0777 -i -pe '
  if (m/fetch\(\s*([`"\x27]).*?\/api\/v1\/orders\/.*?\1/s) {
    s/fetch\(\s*([`"\x27])([^`"\x27]*?)\/api\/v1\/orders\/.*?\1\s*,\s*\{(.*?)\}\s*\)/fetch($1$2\/api\/v1\/orders\/demo\/list$1, { method: "POST", headers: { "content-type":"application\/json" }, body: JSON.stringify({ partnerSlug: "thieyp" }) })/sg;
  }
' "$TARGET" || true

# d) Patch anti-filtre: si on voit un filtre status==="ready" on le neutralise (affiche pending aussi)
perl -0777 -i -pe '
  s/\.filter\(\s*\(?\s*\w+\s*=>\s*\w+\.status\s*===\s*["\x27]ready["\x27]\s*\)?\s*\)//g;
' "$TARGET" || true

log "[4] Diff (aperçu):"
diff -u "$BK/$(basename "$TARGET").bak" "$TARGET" | head -n 120 | tee -a "$LOG" || true

log "✅ Patch terminé."
log "👉 Prochaine étape: restart hard Merchant (nouveau tunnel + cache clear)."
