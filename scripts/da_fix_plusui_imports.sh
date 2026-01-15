#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)

TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/plusui_imports_fix_$TS"
mkdir -p "$BK"

echo "== Backup des index (sécurité) =="
for a in "${APPS[@]}"; do
  f="$ROOT/apps/$a/app/index.tsx"
  if [ -f "$f" ]; then
    cp -a "$f" "$BK/${a}_index.tsx"
  fi
done

echo "== Occurrences AVANT =="
rg -n --hidden -g'!**/node_modules/**' '\./\+ui/' "$ROOT/apps"/{client,courier,merchant}/app || true

echo "== Patch: ./+ui/ -> ./_ui/ (tous fichiers app/*.ts/tsx/js/jsx) =="
for a in "${APPS[@]}"; do
  find "$ROOT/apps/$a/app" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 \
  | xargs -0 perl -pi -e 's#\./\+ui/#\./_ui/#g; s#\./\+ui"#\./_ui"#g; s#\./\+ui'\''#\./_ui'\''#g'
done

echo "== Vérif (doit afficher 0 ligne) =="
rg -n --hidden -g'!**/node_modules/**' '\./\+ui/' "$ROOT/apps"/{client,courier,merchant}/app && {
  echo "❌ Il reste des imports ./+ui/ quelque part (voir ci-dessus)."
  exit 1
} || true

echo "✅ OK. Backup: $BK"
echo "Prochaine étape: restart Expo --clear dans les 3 fenêtres."
