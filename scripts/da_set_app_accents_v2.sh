#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/accents_fix_$TS"
mkdir -p "$BK"

accent_for() {
  case "$1" in
    client)  echo "#F59E0B" ;; # amber
    courier) echo "#22C55E" ;; # green
    merchant)echo "#3B82F6" ;; # blue
    *) echo "#8B5CF6" ;;      # fallback violet
  esac
}

patch_theme() {
  local app="$1"
  local accent="$2"
  local f="$ROOT/apps/$app/ui/theme.ts"

  if [[ ! -f "$f" ]]; then
    echo "ERROR: theme introuvable: $f"
    exit 1
  fi

  cp -a "$f" "$BK/${app}_theme.ts"

  # 1) si une constante APP_ACCENT existe, on la met à jour
  perl -0777 -i -pe "s/(APP_ACCENT\\s*=\\s*['\"])#[0-9A-Fa-f]{3,8}(['\"])/\\1$accent\\2/g" "$f"

  # 2) on remplace quelques clés fréquentes dans colors{}
  perl -0777 -i -pe "s/\\b(primary|accent|brand|tint)\\b\\s*:\\s*['\"][^'\"]+['\"]/\\1: '$accent'/g" "$f"

  echo "OK: $app accent => $accent"
}

for app in client courier merchant; do
  patch_theme "$app" "$(accent_for "$app")"
done

echo "Backup: $BK"
echo "DONE"
