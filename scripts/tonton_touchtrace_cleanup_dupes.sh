#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/touchtrace_cleanup_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/touchtrace_cleanup_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

log "🧹 TouchTrace cleanup dupes"
log "Root=$ROOT"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

for app in client courier merchant; do
  APPROOT="$ROOT/apps/$app"

  log "→ app=$app"

  # 1) Remove ANY TouchTrace file living under app/ (expo-router route danger)
  while IFS= read -r f; do
    log "  - remove route file: $f"
    backup_file "$f"
    rm -f "$f"
  done < <(find "$APPROOT/app" -type f -name "TouchTrace.tsx" 2>/dev/null || true)

  # 2) Clean imports in ALL _layout.tsx under app/
  while IFS= read -r layout; do
    backup_file "$layout"

    python3 - "$layout" "$REPORT" <<'PY'
import sys, re, pathlib

p = pathlib.Path(sys.argv[1])
report = pathlib.Path(sys.argv[2])

s = p.read_text(encoding="utf-8", errors="ignore")
before = s

lines = s.splitlines(True)
out = []

for line in lines:
    # Remove legacy imports that cause duplicate declaration:
    # import { TouchTrace } from "../_components/TouchTrace";
    # import TouchTrace from "../_components/TouchTrace";
    # import { TouchTrace } from "../components/TouchTrace";
    if re.search(r'^\s*import\s+(\{[^}]*\bTouchTrace\b[^}]*\}|TouchTrace)\s+from\s+["\'].*(\/|\\)_components\/TouchTrace["\']\s*;?\s*$', line):
        continue
    if re.search(r'^\s*import\s+(\{[^}]*\bTouchTrace\b[^}]*\}|TouchTrace)\s+from\s+["\'].*(\/|\\)components\/TouchTrace["\']\s*;?\s*$', line):
        continue
    out.append(line)

s2 = "".join(out)

if s2 != before:
    p.write_text(s2, encoding="utf-8", errors="ignore")
    with report.open("a", encoding="utf-8") as f:
        f.write(f"\n[cleaned-imports] {p}\n")
PY

  done < <(find "$APPROOT/app" -type f -name "_layout.tsx" 2>/dev/null || true)

done

log "✅ Done."
log "📄 Report: $REPORT"
log "🧯 Rollback: restore from $BACKUP_DIR (or git checkout -- .)"
