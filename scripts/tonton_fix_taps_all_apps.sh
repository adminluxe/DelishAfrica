#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")

ts() { date +"%Y%m%d-%H%M%S"; }
BACKUP="$ROOT/backups/taps_fix_$(ts)"
mkdir -p "$BACKUP"

echo "============================================================"
echo "TONTON FIX TAPS — 3 APPS (CLIENT/COURIER/MERCHANT)"
echo "Backup: $BACKUP"
echo "============================================================"

backup_file() {
  local f="$1"
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$f" "$BACKUP/$rel"
}

# 1) Collect candidate files (jsx/tsx) in apps
collect_files() {
  local app="$1"
  find "$ROOT/apps/$app" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.expo/*" \
    -not -path "*/.turbo/*" \
    -not -path "*/.next/*"
}

# 2) Restore tappability if pointerEvents="none" was injected on wrappers by mistake
#    (we only flip it back when it appears on SafeAreaView / Screen / main wrapper)
fix_bad_pointerevents_on_wrappers() {
  local f="$1"
  # Only touch files that likely define layout wrappers
  if ! grep -qE "(SafeAreaView|Screen|Layout|RootLayout)" "$f"; then
    return 0
  fi

  if grep -q 'pointerEvents="none"' "$f"; then
    backup_file "$f"
    perl -0777 -pi -e '
      # If pointerEvents="none" is on SafeAreaView or Screen or main View wrapper, restore to "auto"
      s/(<SafeAreaView\b[^>]*?)\s+pointerEvents="none"/$1 pointerEvents="auto"/g;
      s/(<Screen\b[^>]*?)\s+pointerEvents="none"/$1 pointerEvents="auto"/g;
      # common root wrapper <View style={{ flex: 1 ... }} pointerEvents="none" -> auto
      s/(<View\b[^>]*?style=\{\{[^}]*\bflex:\s*1[^}]*\}\})\s+pointerEvents="none"/$1 pointerEvents="auto"/g;
    ' "$f"
  fi
}

# 3) Force decorative absolute layers to be non-interactive
#    We target JSX <View ... style={{ position: "absolute"... opacity: ... }} WITHOUT pointerEvents already
#    and we add pointerEvents="none" (or box-none would also work, but none is safest for decor layers)
fix_absolute_decor_layers() {
  local f="$1"

  # only if file contains absolute positioning
  if ! grep -qE "position:\s*['\"]absolute['\"]|absoluteFill|absoluteFillObject" "$f"; then
    return 0
  fi

  # only if file contains visual hints (opacity/background/blur/gradient)
  if ! grep -qE "opacity|backgroundColor|blur|LinearGradient|Snow|Glow|Bubble" "$f"; then
    return 0
  fi

  # If already has pointerEvents props in absolute Views, still ok; we add only where missing.
  backup_file "$f"

  perl -0777 -pi -e '
    # Case A: <View style={{ position: "absolute"... opacity: ... }} ...>  (single line or multi)
    # Add pointerEvents="none" if not already present in the opening tag.
    $s = $_;

    # helper: inject pointerEvents="none" right after <View
    sub inject_pe {
      my ($tag) = @_;
      return $tag if $tag =~ /pointerEvents=/;
      $tag =~ s/<View\b/<View pointerEvents="none"/;
      return $tag;
    }

    # Replace opening tags that contain "position: ...absolute" and "opacity" or "backgroundColor"
    $s =~ s{(<View\b(?![^>]*pointerEvents=)[^>]*style=\{\{[^}]*position:\s*['\"]absolute['\"][^}]*\}\}[^>]*>)}{ inject_pe($1) }gse;
    $s =~ s{(<View\b(?![^>]*pointerEvents=)[^>]*style=\{[^}]*absoluteFillObject[^}]*\}[^>]*>)}{ inject_pe($1) }gse;
    $s =~ s{(<View\b(?![^>]*pointerEvents=)[^>]*style=\{[^}]*StyleSheet\.absoluteFillObject[^}]*\}[^>]*>)}{ inject_pe($1) }gse;
    $s =~ s{(<View\b(?![^>]*pointerEvents=)[^>]*style=\{[^}]*StyleSheet\.absoluteFill[^}]*\}[^>]*>)}{ inject_pe($1) }gse;

    $_ = $s;
  ' "$f" || true
}

# 4) Apply for each app
for app in "${APPS[@]}"; do
  echo "------------------------------------------------------------"
  echo "==> Scanning app: $app"
  while IFS= read -r f; do
    # skip backups themselves
    [[ "$f" == *"/backups/"* ]] && continue
    fix_bad_pointerevents_on_wrappers "$f"
    fix_absolute_decor_layers "$f"
  done < <(collect_files "$app")
done

echo "------------------------------------------------------------"
echo "✅ Patch applied. Backups saved to: $BACKUP"
echo ""
echo "NEXT (IMPORTANT): hard clear + restart metros + iPhone force close."
echo "Run:"
echo "  rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true"
echo "  pkill -f \"expo start\" 2>/dev/null || true"
echo ""
echo "Then in tmux:"
echo "  cd $ROOT/apps/client  && pnpm dev -- --tunnel --port 8081 --clear"
echo "  cd $ROOT/apps/courier && pnpm dev -- --tunnel --port 8082 --clear"
echo "  cd $ROOT/apps/merchant&& pnpm dev -- --tunnel --port 8083 --clear"
echo ""
echo "iPhone: FORCE CLOSE Expo Go completely -> re-scan each QR."
echo "============================================================"
