#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/scroll_flexgrow_$NOW"
LOG="$BKP/patch.log"
mkdir -p "$BKP"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

cd "$ROOT"

log "Scan + patch: contentContainerStyle={{ flex: 1 }} -> flexGrow: 1"

files="$(git ls-files 2>/dev/null | grep -E '\.(ts|tsx)$' || true)"
if [[ -z "${files:-}" ]]; then
  files="$(find "$ROOT/apps" "$ROOT/packages" -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null || true)"
fi

changed=0
while IFS= read -r f; do
  [[ -f "$f" ]] || continue
  # skip node_modules
  [[ "$f" == *"/node_modules/"* ]] && continue

  if grep -Eq 'contentContainerStyle\s*=\s*\{\{\s*flex\s*:\s*1\s*\}\}' "$f"; then
    mkdir -p "$BKP/$(dirname "$f")"
    cp -a "$f" "$BKP/$f"
    perl -pi -e 's/contentContainerStyle\s*=\s*\{\{\s*flex\s*:\s*1\s*\}\}/contentContainerStyle={{ flexGrow: 1 }}/g' "$f"
    changed=$((changed+1))
    log "patched: $f"
  fi
done <<< "$files"

log "DONE. changed_files=$changed"
log "Backups: $BKP"
log "Log: $LOG"
