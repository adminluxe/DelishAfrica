#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/scroll_surgeon_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/scroll_surgeon_$NOW.log"

mkdir -p "$BK" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

cd "$ROOT"

log "== TONTON SCROLL SURGEON v1 =="
log "Backup: $BK"
log "Report: $REPORT"

# 1) Patch ScrollView contentContainerStyle flex:1 -> flexGrow:1
log "== Patch contentContainerStyle flex:1 -> flexGrow:1 =="
FILES=$(rg -n --hidden --glob '!**/node_modules/**' 'contentContainerStyle=\{\{[^}]*flex:\s*1' apps || true)
if [[ -n "${FILES:-}" ]]; then
  log "Found candidates:"
  echo "$FILES" | tee -a "$REPORT" >/dev/null
fi

# apply safe substitutions
rg -l --hidden --glob '!**/node_modules/**' 'contentContainerStyle=\{\{[^}]*flex:\s*1' apps \
| while read -r f; do
    cp -a "$f" "$BK/$(echo "$f" | sed 's#/#__#g')" || true
    perl -0777 -pi -e 's/contentContainerStyle=\{\{([^}]*)flex:\s*1\s*,/contentContainerStyle={{$1flexGrow: 1,/g;
                        s/contentContainerStyle=\{\{([^}]*)flex:\s*1\s*\}\}/contentContainerStyle={{$1flexGrow: 1}}/g;' "$f"
  done

log "✅ contentContainerStyle patched (si présent)"

# 2) Pointer events: uniquement sur backgrounds connus
log "== Force pointerEvents=\"none\" on known background components =="
mapfile -t bg_files < <(ls -1 \
  "$ROOT"/apps/*/components/AppBackground.tsx \
  "$ROOT"/apps/*/components/BrandBackground.tsx \
  "$ROOT"/apps/*/ui/SnowOverlay.tsx \
  2>/dev/null || true)

for f in "${bg_files[@]:-}"; do
  [[ -f "$f" ]] || continue
  cp -a "$f" "$BK/$(echo "$f" | sed 's#/#__#g')" || true
  # only change box-none -> none (backgrounds should not catch touches)
  perl -pi -e 's/pointerEvents="box-none"/pointerEvents="none"/g' "$f"
  perl -pi -e "s/pointerEvents='box-none'/pointerEvents='none'/g" "$f"
  log "patched pointerEvents in: $f"
done

log "✅ background overlays patched (si trouvés)"

log "== NEXT =="
log "1) Redémarre metros (script rescue) ou Ctrl+C puis relance expo start."
log "2) Test scroll sur iPhone."
