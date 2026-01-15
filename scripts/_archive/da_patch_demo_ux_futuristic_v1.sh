#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
APPS=("client" "courier" "merchant")
FILES=("app/thieyp-demo.tsx" "app/orders-demo.tsx")

backup() {
  local f="$1"
  [[ -f "$f" ]] && cp -a "$f" "${f}.bak.${TS}"
}

ensure_imports() {
  local f="$1"

  # 1) DA import
  if ! grep -q 'components/da/theme' "$f"; then
    perl -0777 -i -pe 's/(import\s+[^;]+;\s*\n)/$1import { DA } from "..\/components\/da\/theme";\n/s' "$f"
  fi

  # 2) Screen import
  if ! grep -q 'components/da/Screen' "$f"; then
    perl -0777 -i -pe 's/(import\s+[^;]+;\s*\n)/$1import { Screen } from "..\/components\/da\/Screen";\n/s' "$f"
  fi

  # 3) GlassCard import
  if ! grep -q 'components/da/GlassCard' "$f"; then
    perl -0777 -i -pe 's/(import\s+[^;]+;\s*\n)/$1import { GlassCard } from "..\/components\/da\/GlassCard";\n/s' "$f"
  fi
}

patch_wrapper_optional() {
  local f="$1"

  # Si on trouve un container View simple, on le remplace par Screen (safe-area + spacing)
  # - Pattern 1: <View style={styles.container}> ... </View>
  # NB: si ça ne matche pas, aucun changement.
  perl -0777 -i -pe 's/<View\s+style=\{styles\.container\}>(\s*)/<Screen style={styles.container}>$1/s' "$f"
  perl -0777 -i -pe 's/<\/View>(\s*)$/<\/Screen>$1/sm' "$f"
}

patch_stylesheet() {
  local f="$1"

  # On remplace (si présent) certains blocs styles par des versions futuristes.
  # Si une clé n’existe pas, on ne touche pas.
  perl -0777 -i -pe '
    # container
    s/container\s*:\s*\{[^}]*\}/container: { flex: 1, backgroundColor: DA.bg }/s;

    # card / panel / box (plusieurs noms possibles)
    s/(card|panel|box|section)\s*:\s*\{[^}]*\}/$1: {
      backgroundColor: DA.card,
      borderColor: DA.stroke,
      borderWidth: 1,
      borderRadius: DA.radius.xl,
      padding: DA.space.md,
      marginBottom: DA.space.md
    }/sg;

    # title / header
    s/(title|headerTitle)\s*:\s*\{[^}]*\}/$1: { color: DA.text, fontSize: 22, fontWeight: "800", letterSpacing: 0.2 }/sg;

    # subtitle / muted
    s/(subtitle|muted|sub)\s*:\s*\{[^}]*\}/$1: { color: DA.sub, fontSize: 14, fontWeight: "600" }/sg;

    # primary button
    s/(btnPrimary|primaryButton|cta)\s*:\s*\{[^}]*\}/$1: {
      height: 54,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: DA.accent
    }/sg;

    # secondary button
    s/(btnSecondary|secondaryButton)\s*:\s*\{[^}]*\}/$1: {
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.10)",
      borderColor: DA.stroke,
      borderWidth: 1
    }/sg;

    # button text
    s/(btnText|buttonText)\s*:\s*\{[^}]*\}/$1: { color: "#07101B", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 }/sg;

  ' "$f"
}

inject_glasscard_hint() {
  local f="$1"
  # Ajoute un petit commentaire repère (si tu veux remplacer ensuite des View -> GlassCard à la main, c’est plus simple)
  if ! grep -q "DA_GLASS_HINT" "$f"; then
    echo -e "\n// DA_GLASS_HINT: Tu peux remplacer les <View style={styles.card|panel|box}> par <GlassCard style={...}> pour un rendu encore plus premium.\n" >> "$f"
  fi
}

echo "=== DA Patch Demo UX Futuristic v1 ==="
echo "TS: $TS"
echo

for app in "${APPS[@]}"; do
  BASE="$ROOT/apps/$app"
  [[ -d "$BASE" ]] || { echo "!! skip $app (missing $BASE)"; continue; }

  echo "---- APP: $app"
  for rel in "${FILES[@]}"; do
    f="$BASE/$rel"
    if [[ -f "$f" ]]; then
      echo "   -> patch $f"
      backup "$f"
      ensure_imports "$f"
      patch_wrapper_optional "$f"
      patch_stylesheet "$f"
      inject_glasscard_hint "$f"
    else
      echo "   -> skip (missing) $f"
    fi
  done
  echo
done

echo "=== OK ==="
echo "Backups: *.bak.${TS}"
