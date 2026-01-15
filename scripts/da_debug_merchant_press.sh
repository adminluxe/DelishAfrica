#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/.tonton_backups/merchant_press_$TS"
mkdir -p "$BK"

log(){ echo -e "\n🧡 $*\n"; }

cd "$ROOT"

log "Recherche des écrans merchant contenant 'Marquer PRÊT' / 'Accepter'..."
mapfile -t FILES < <(grep -RIn --include='*.ts' --include='*.tsx' -E "Marquer PRÊT|Marquer PRET|Accepter" "$APP/app" "$APP/src" 2>/dev/null || true | cut -d: -f1 | sort -u)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "❌ Aucun fichier trouvé avec ces libellés dans $APP/app ou $APP/src"
  exit 1
fi

log "Fichiers candidats:"
printf '%s\n' "${FILES[@]}"

log "Affiche les lignes autour des occurrences (onPress etc.)"
for f in "${FILES[@]}"; do
  echo "==== $f ===="
  grep -nE "Marquer PRÊT|Marquer PRET|Accepter|onPress" "$f" | head -n 80
done

log "OPTION: injection safe d'un log PRESS_READY si pattern simple trouvé."
log "➡️ Je n’injecte que si je vois 'onPress={() => ...}' dans le même fichier."

for f in "${FILES[@]}"; do
  if grep -qE "Marquer PRÊT|Marquer PRET" "$f" && grep -qE "onPress=\\{\\(\\) =>" "$f"; then
    cp -a "$f" "$BK/$(basename "$f").bak"
    # injection: ajoute console.log juste après onPress={() =>
    sed -i 's/onPress={[[:space:]]*()[[:space:]]*=>[[:space:]]*{/onPress={() => { console.log("PRESS_READY");/g' "$f" || true
  fi
done

log "✅ Debug script done."
log "Backups: $BK"
echo "Relance merchant avec clear cache :"
echo "cd $APP && pnpm dev -- --tunnel --port 8083 --clear"
