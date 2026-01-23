#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/kill_touchtrace_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/kill_touchtrace_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

relpath(){ python3 - <<PY
import os
print(os.path.relpath("$1","$ROOT"))
PY
}

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

log "🏁 FINISHER3: remove TouchTrace wrappers + neutralize app route TouchTrace"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

APPS=(client merchant courier)

# 1) Remove TouchTrace import + wrapper in layouts
LAYOUT_FILES=()
for a in "${APPS[@]}"; do
  while IFS= read -r f; do LAYOUT_FILES+=("$f"); done < <(
    find "$ROOT/apps/$a/app" -type f -name "_layout.tsx" 2>/dev/null || true
  )
done
mapfile -t LAYOUT_FILES < <(printf "%s\n" "${LAYOUT_FILES[@]}" | awk 'NF && !seen[$0]++')

log "Layouts found: ${#LAYOUT_FILES[@]}"
printf "%s\n" "${LAYOUT_FILES[@]}" | tee -a "$REPORT" || true

for f in "${LAYOUT_FILES[@]}"; do
  backup_file "$f"

  # remove any TouchTrace imports (default or named) pointing to ui/_debug or app/_components
  perl -0777 -i -pe '
    s/^\s*import\s+TouchTrace\s+from\s+["'\''][^"'\'']*TouchTrace[^"'\'']*["'\''];\s*\n//mg;
    s/^\s*import\s+\{\s*TouchTrace\s*\}\s+from\s+["'\''][^"'\'']*TouchTrace[^"'\'']*["'\''];\s*\n//mg;
  ' "$f"

  # remove wrapper tags <TouchTrace ...> ... </TouchTrace>
  perl -0777 -i -pe '
    s/<TouchTrace\b[^>]*>\s*//mg;
    s/\s*<\/TouchTrace>\s*//mg;
    s/<TouchTrace\b[^\/]*\/>\s*//mg;
  ' "$f"
done

# 2) Neutralize the Expo Router warning source: app/_components/TouchTrace.tsx (seen by router)
# We rename to _TouchTrace.tsx (ignored by router) + leave a NOOP file if needed.
for a in "${APPS[@]}"; do
  SRC="$ROOT/apps/$a/app/_components/TouchTrace.tsx"
  if [[ -f "$SRC" ]]; then
    backup_file "$SRC"
    DST="$ROOT/apps/$a/app/_components/_TouchTrace.tsx"
    log "Rename route file: $SRC -> $DST"
    mv "$SRC" "$DST"
  fi
done

log "✅ Done."
log "🧯 Rollback (1-liner): rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""
