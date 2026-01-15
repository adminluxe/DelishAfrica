#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

APPS=(client merchant courier)

echo "== DA Debug | CTA 'Commander (démo)' wiring =="

echo
echo "== 1) Où est le texte 'Commander (démo)' ? =="
rg -n --hidden --no-ignore "Commander\s*\(démo\)" apps/* -S || true

echo
echo "== 2) Contexte autour (120 lignes) pour voir onPress / Link / router.push =="
rg -n --hidden --no-ignore "Commander\s*\(démo\)" apps/* -S \
  | while read -r line; do
      f="$(echo "$line" | cut -d: -f1)"
      ln="$(echo "$line" | cut -d: -f2)"
      echo
      echo "---- $f:$ln ----"
      start=$((ln-40)); [ $start -lt 1 ] && start=1
      end=$((ln+80))
      nl -ba "$f" | sed -n "${start},${end}p" | sed 's/\t/  /g'
    done || true

echo
echo "== 3) Routes disponibles (expo-router) par app =="
for a in "${APPS[@]}"; do
  echo
  echo "--- apps/$a/app routes ---"
  if [ -d "apps/$a/app" ]; then
    find "apps/$a/app" -type f \( -name "*.tsx" -o -name "*.ts" \) \
      ! -name "_layout.*" \
      | sed "s|apps/$a/app||" \
      | sed "s|/index\..*$|/|; s|\..*$||" \
      | sort
  else
    echo "No apps/$a/app directory"
  fi
done

echo
echo "== 4) Cherche les router.push/href relatifs au démo (dans chaque app) =="
for a in "${APPS[@]}"; do
  echo
  echo "--- app: $a ---"
  rg -n --hidden --no-ignore -S "router\.push|href=|Link\s" "apps/$a" | rg -n -S "demo|orders|order|Commander|Thieyp|Action principale" || true
done

echo
echo "== DONE =="
echo "👉 Envoie-moi juste la sortie des sections 1 + 2 (le bloc qui contient le CTA) et je te renvoie un patch 100% sûr."
