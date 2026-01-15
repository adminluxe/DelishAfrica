#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
ts="$(date +%Y%m%d_%H%M%S)"
APPS=(client courier merchant)

cd "$ROOT"

for a in "${APPS[@]}"; do
  f="apps/$a/app.config.ts"
  test -f "$f" || { echo "Missing $f"; exit 1; }

  cp -a "$f" "$f.bak.$ts"

  # Si icon: absent → injecte juste après "...config," (cas le plus fréquent)
  if ! rg -q "^\s*icon\s*:" "$f"; then
    perl -i -pe 'if($.==1){$done=0} if(!$done && /(\.\.\.config,\s*)/){s//"$1\n  icon: \"\\.\\/assets\\/icon.png\",\n"/e; $done=1}' "$f"
    echo "✅ $a: icon ajouté"
  else
    echo "ℹ️  $a: icon déjà présent"
  fi

  # Si splash: absent → injecte après icon (ou après ...config si icon existait déjà)
  if ! rg -q "^\s*splash\s*:" "$f"; then
    perl -i -pe 'if($.==1){$done=0} if(!$done && /^\s*icon\s*:/){$_ .= "  splash: { image: \"./assets/splash.png\", resizeMode: \"contain\", backgroundColor: \"#000000\" },\n"; $done=1}' "$f"
    if rg -q "^\s*splash\s*:" "$f"; then
      echo "✅ $a: splash ajouté (après icon)"
    else
      # fallback: après ...config,
      perl -i -pe 'if($.==1){$done=0} if(!$done && /(\.\.\.config,\s*)/){s//"$1\n  splash: { image: \"\\.\\/assets\\/splash.png\", resizeMode: \"contain\", backgroundColor: \"#000000\" },\n"/e; $done=1}' "$f"
      echo "✅ $a: splash ajouté (fallback après ...config)"
    fi
  else
    echo "ℹ️  $a: splash déjà présent"
  fi
done

echo
echo "== Vérif finale (expo config) =="
for a in "${APPS[@]}"; do
  echo "----- $a"
  (cd "apps/$a" && npx expo config --type public | rg -n "\"icon\"|\"splash\"" || true)
done
