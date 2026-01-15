#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backups/orderid_replace_safe_$TS"
mkdir -p "$BK"

echo "Backup dir: $BK"

# Cible : uniquement apps/*
SEARCH_DIRS=("$ROOT/apps/client" "$ROOT/apps/merchant" "$ROOT/apps/courier")

mapfile -t FILES < <(
  grep -RIl --include="*.ts" --include="*.tsx" "\.orderId\.replace\(" "${SEARCH_DIRS[@]}" 2>/dev/null || true
)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "OK: aucun .orderId.replace( trouvé. Rien à patch."
  exit 0
fi

echo "Fichiers à patch:"
printf " - %s\n" "${FILES[@]}"

patched=0
for f in "${FILES[@]}"; do
  rel="${f#"$ROOT/"}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"

  # Patch ultra ciblé:
  #   X.orderId.replace(  ->  String(X?.orderId ?? "").replace(
  # (ne touche rien d'autre)
  perl -0777 -pe 's/\b([A-Za-z_][A-Za-z0-9_]*)\.orderId\.replace\(/String(\1?.orderId ?? "").replace(/g' \
    -i "$f"

  patched=$((patched+1))
done

echo "PATCH_SUMMARY patched_files=$patched"
echo "Backups: $BK"
