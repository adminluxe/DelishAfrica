#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/_backup_ui_safe_padding_$TS"
mkdir -p "$BACKUP"

log(){ echo "[$(date +%H:%M:%S)] $*"; }

patch_one() {
  local APP="$1"
  local F="$ROOT/apps/$APP/ui/ui.tsx"

  if [ ! -f "$F" ]; then
    log "WARN: missing $F (skip)"
    return 0
  fi

  mkdir -p "$BACKUP/apps/$APP/ui"
  cp -a "$F" "$BACKUP/apps/$APP/ui/ui.tsx"

  # 1) Ensure useSafeAreaInsets import exists if Screen uses it
  # (Only add if we detect useSafeAreaInsets usage but no import)
  if grep -q "useSafeAreaInsets" "$F" && ! grep -q "from 'react-native-safe-area-context'" "$F"; then
    # Insert after first React import (common pattern)
    perl -0777 -i -pe "s/(import\\s+React[^;]*;\\s*)/\\1import { useSafeAreaInsets } from 'react-native-safe-area-context';\\n/s" "$F" || true
  fi

  # 2) Add paddingTop/paddingBottom inside first style={{ ... }} AFTER const insets = useSafeAreaInsets()
  # Only if not already present.
  perl -0777 -i -pe '
    my $txt = $_;

    # If already padded, keep.
    if ($txt =~ /paddingTop\s*:\s*insets\.top/ && $txt =~ /paddingBottom\s*:\s*insets\.bottom/) {
      $_ = $txt; next;
    }

    # We patch only if Screen has insets.
    if ($txt !~ /const\s+insets\s*=\s*useSafeAreaInsets\(\)\s*;/) {
      $_ = $txt; next;
    }

    # Find first JSX style={{ ... }} after insets declaration and inject padding.
    # Very conservative: inject only if there is a style={{ ... }} object.
    $txt =~ s/(const\s+insets\s*=\s*useSafeAreaInsets\(\)\s*;.*?style=\{\{\s*)/$1paddingTop: insets.top + 12,\n      paddingBottom: insets.bottom + 12,\n      /s;

    $_ = $txt;
  ' "$F"

  # 3) If we still did not inject (no style={{...}} found), try adding style prop to the first root container:
  # We only do this if file still lacks paddingTop but has Screen+insets.
  if grep -q "const insets = useSafeAreaInsets()" "$F" && ! grep -q "paddingTop: insets.top" "$F"; then
    perl -0777 -i -pe '
      my $txt = $_;

      # Target the first opening tag after return (e.g., <SafeAreaView ...> or <View ...>)
      # Add style prop only if none exists on that first tag.
      if ($txt =~ /(return\s*\(\s*<)([A-Za-z0-9_]+)([^>]*?)(>)/s) {
        my ($a,$tag,$attrs,$b) = ($1,$2,$3,$4);
        if ($attrs !~ /\sstyle=\{/s) {
          my $style = " style={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}";
          $txt =~ s/(return\s*\(\s*<)([A-Za-z0-9_]+)([^>]*?)(>)/$1.$2.$3.$style.$4/sex;
        }
      }

      $_ = $txt;
    ' "$F"
  fi

  log "OK: patched safe padding -> $F"
}

log "== DelishAfrica | Safe padding Screen (all apps) =="
log "Backup: $BACKUP"

patch_one "client"
patch_one "merchant"
patch_one "courier"

log "DONE."
