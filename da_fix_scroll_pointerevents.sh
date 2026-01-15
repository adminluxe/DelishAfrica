#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ missing: $1"; exit 1; }; }
need rg
need perl
need find
need cp
need mkdir

STAMP="$(date +%Y%m%d_%H%M%S)"
BAK="/tmp/da_fix_scroll_pointerevents_bak_${STAMP}"
mkdir -p "$BAK"

echo "== DA FIX SCROLL pointerEvents =="
echo "ROOT=$ROOT"
echo "BACKUP=$BAK"
echo

# 1) Cibles prioritaires: wrappers connus (souvent la source du bug global)
mapfile -t WRAPPERS < <(
  find "$ROOT/apps" -type f \
    \( -name "AppBackground.tsx" -o -name "BrandBackground.tsx" -o -name "SnowOverlay.tsx" \) \
    ! -path "*/node_modules/*" \
    ! -name "*.bak*" ! -name "*.BAK*" ! -name "*.DISABLED*" \
    -print | sort -u
)

# 2) Cibles secondaires: écrans expo-router (si un écran a un root pointerEvents="none")
mapfile -t SCREENS < <(
  find "$ROOT/apps" -type f \
    -path "*/app/*.tsx" -o -path "*/app/*/*.tsx" -o -path "*/app/*/*/*.tsx" \
    ! -path "*/node_modules/*" \
    ! -name "*.bak*" ! -name "*.BAK*" ! -name "*.DISABLED*" \
    -print 2>/dev/null | sort -u
)

patch_file_root_none_to_boxnone() {
  local f="$1"

  # Patch uniquement si on voit pointerEvents="none" quelque part
  rg -q 'pointerEvents="none"' "$f" || return 0

  # Backup
  mkdir -p "$BAK/$(dirname "${f#$ROOT/}")"
  cp -a "$f" "$BAK/${f#$ROOT/}"

  # Patch: UNIQUEMENT le 1er tag JSX après "return ("
  # (c’est exactement le pattern d’un root wrapper)
  perl -0777 -i -pe '
    my $orig = $_;
    s/(return\s*\(\s*<[^>\n]*?)\bpointerEvents=(["\047])none\2/${1}pointerEvents="box-none"/s;
  ' "$f"

  # Si aucun changement réel, on remet le backup
  if cmp -s "$f" "$BAK/${f#$ROOT/}"; then
    cp -a "$BAK/${f#$ROOT/}" "$f"
    return 0
  fi

  echo "patched: ${f#$ROOT/}"
}

echo "== 1) Patch WRAPPERS (root none -> box-none) =="
patched=0
for f in "${WRAPPERS[@]}"; do
  # Heuristique: si le fichier a des enfants, root ne doit JAMAIS être "none"
  if rg -q '\bchildren\b|\{ *children *\}|PropsWithChildren' "$f"; then
    if patch_file_root_none_to_boxnone "$f"; then :; fi
  fi
done

echo
echo "== 2) Patch SCREENS (root none -> box-none) =="
for f in "${SCREENS[@]}"; do
  # Si un écran a mis pointerEvents="none" sur le root par erreur -> ça casse le scroll
  patch_file_root_none_to_boxnone "$f" || true
done

echo
echo "== CHECK: roots encore en pointerEvents=\"none\" juste après return( =="
# On liste ce qui resterait (utile pour traquer un cas tordu)
rg -n --no-heading 'return\s*\(\s*<[^>\n]*pointerEvents="none"' "$ROOT/apps" -g'*.tsx' || true

echo
echo "✅ Done. Backup: $BAK"
echo "👉 NEXT (obligatoire): redémarrer Metro en --clear + FORCER la fermeture des 3 apps iPhone, puis re-scan QR."
