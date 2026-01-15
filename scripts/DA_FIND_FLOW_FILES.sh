#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"

echo "==> CLIENT: files containing 'Commander' button label"
rg -n --hidden --no-ignore -S "Commander" "$ROOT/apps/client/app" || true

echo
echo "==> CLIENT: files containing 'Commande créée' screen text"
rg -n --hidden --no-ignore -S "Commande créée" "$ROOT/apps/client/app" || true

echo
echo "==> CLIENT: files containing 'Voir menu'"
rg -n --hidden --no-ignore -S "Voir menu" "$ROOT/apps/client/app" || true

echo
echo "==> CLIENT: files using expo-router navigation (router.push / Link)"
rg -n --hidden --no-ignore -S "router\.push|useRouter\(|<Link|href=" "$ROOT/apps/client/app" || true

echo
echo "==> MERCHANT: files containing 'Accepter' or 'Commandes entrantes'"
rg -n --hidden --no-ignore -S "Accepter|Commandes entrantes|Réception" "$ROOT/apps/merchant/app" || true

echo
echo "==> COURIER: files containing 'Voir mission' or 'Mission en cours'"
rg -n --hidden --no-ignore -S "Voir mission|Mission en cours|Confirmer pick-up|Confirmer livraison" "$ROOT/apps/courier/app" || true
