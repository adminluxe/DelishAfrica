#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/scroll_radical_${TS}"
RP="$ROOT/.tonton_reports/scroll_radical_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🧨 TONTON SCROLL RADICAL FIX"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo

if [[ ! -d "$ROOT/apps" ]]; then
  echo "❌ Repo introuvable: $ROOT"
  exit 1
fi

cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "⚠️ ripgrep (rg) manquant. Installation..."
  apt-get update -y
  apt-get install -y ripgrep
fi

echo "============================================================"
echo "1) Neutraliser TouchTrace (NOOP) — suspect #1"
echo "============================================================"

mapfile -t TRACE_FILES < <(
  find "$ROOT/apps" -type f \( \
    -iname "*touch*trace*.ts" -o -iname "*touch*trace*.tsx" -o \
    -iname "*touchtrace*.ts"   -o -iname "*touchtrace*.tsx" \
  \) 2>/dev/null | sort -u
)

if ((${#TRACE_FILES[@]}==0)); then
  echo "ℹ️ Aucun fichier touchtrace par nom. Scan par symbole TouchTrace..."
  mapfile -t TRACE_FILES < <(
    rg -l --glob='**/*.{ts,tsx,js,jsx}' \
      "function\\s+TouchTrace|const\\s+TouchTrace\\b|export\\s+(default\\s+)?function\\s+TouchTrace" \
      "$ROOT/apps" || true
  )
fi

echo "TouchTrace candidates: ${#TRACE_FILES[@]}"
printf '%s\n' "${TRACE_FILES[@]}" || true
echo

for f in "${TRACE_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  echo "➡️ Patch TouchTrace -> NOOP : $f"

  mkdir -p "$BK$(dirname "${f#$ROOT}")"
  cp -a "$f" "$BK${f#$ROOT}"

  cat > "$f" <<'EOF'
import React from "react";
import { View } from "react-native";

/**
 * TouchTrace (NOOP)
 * ----------------
 * Un traceur de touch global peut voler le responder et tuer ScrollView/FlatList.
 * On garde l'API mais on rend le composant totalement transparent.
 *
 * Réactivation future (si besoin) : créer un TouchTraceDebug séparé
 * qui NE capture PAS le responder (pas de PanResponder "true", pas de GestureDetector global).
 */
export type TouchTraceProps = { children?: React.ReactNode };

export default function TouchTrace({ children }: TouchTraceProps) {
  return (
    <View style={{ flex: 1 }} pointerEvents="box-none">
      {children}
    </View>
  );
}
EOF
done

echo
echo "============================================================"
echo "2) Désactiver les 'responder blockers' globaux (=> false)"
echo "   (hors whitelist: Signature/Map/Camera/Scanner)"
echo "============================================================"

SKIP_RE='SignaturePad|signature|Map|map|Camera|camera|Scanner|scanner|QRCode|qrcode|BarCode|barcode'

mapfile -t BLOCK_FILES < <(
  rg -l --glob='**/*.{ts,tsx,js,jsx}' \
    "on(Start|Move)ShouldSet(Pan)?Responder(Capture)?\\s*(?::|=)\\s*\\([^)]*\\)\\s*=>\\s*true" \
    "$ROOT/apps" || true
)

echo "Responder-blocker files: ${#BLOCK_FILES[@]}"
printf '%s\n' "${BLOCK_FILES[@]}" || true
echo

for f in "${BLOCK_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  if [[ "$f" =~ $SKIP_RE ]]; then
    echo "⏭️ SKIP (whitelist) : $f"
    continue
  fi

  echo "➡️ Patch blockers => false : $f"
  mkdir -p "$BK$(dirname "${f#$ROOT}")"
  cp -a "$f" "$BK${f#$ROOT}" 2>/dev/null || true

  # remplace "=> true" par "=> false" sur ces handlers
  perl -0777 -pi -e \
    's/(on(?:Start|Move)ShouldSet(?:Pan)?Responder(?:Capture)?\s*(?::|=)\s*\([^)]*\)\s*=>)\s*true/\1 false/gms' \
    "$f"
done

echo
echo "============================================================"
echo "3) Patch classique RN: contentContainerStyle flex:1 -> flexGrow:1"
echo "============================================================"

mapfile -t FLEX1_FILES < <(
  rg -l --glob='**/*.{ts,tsx,js,jsx}' \
    "contentContainerStyle\\s*=\\s*\\{\\{[^}]*\\bflex\\s*:\\s*1\\b" \
    "$ROOT/apps" || true
)

echo "flex->flexGrow files: ${#FLEX1_FILES[@]}"
printf '%s\n' "${FLEX1_FILES[@]}" || true
echo

for f in "${FLEX1_FILES[@]}"; do
  [[ -f "$f" ]] || continue
  echo "➡️ Patch flex => flexGrow : $f"
  mkdir -p "$BK$(dirname "${f#$ROOT}")"
  cp -a "$f" "$BK${f#$ROOT}" 2>/dev/null || true

  perl -0777 -pi -e \
    's/(contentContainerStyle\s*=\s*\{\{[^}]*?)\bflex\s*:\s*1\b/\1flexGrow: 1/gms' \
    "$f"
done

echo
echo "✅ DONE"
echo "Backup: $BK"
echo "Report: $RP"
echo
echo "NEXT:"
echo "  1) Redémarre les metros CLEAN (voir commandes ci-dessous)"
echo "  2) Sur iPhone: swipe-close COMPLET des 3 apps puis re-scan QR"
