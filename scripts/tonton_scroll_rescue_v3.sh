#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
DO_PATCH="${DA_PATCH:-1}"
PATCH_OVERLAYS="${DA_PATCH_OVERLAYS:-1}"
DRY_RUN="${DA_DRY_RUN:-0}"

ts(){ date "+%Y%m%d_%H%M%S"; }
NOW="$(ts)"

BACKUP_DIR="$ROOT/.tonton_backups/scroll_rescue_v3_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/scroll_rescue_v3_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }
need_dir(){ [[ -d "$1" ]] || { log "ERROR: missing dir $1"; exit 1; }; }

rg_or_grep() {
  local pattern="$1"
  local path="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' "$pattern" "$path" || true
  else
    grep -RIn --exclude-dir node_modules --exclude-dir .git "$pattern" "$path" || true
  fi
}

log "Root=$ROOT"
need_dir "$ROOT"
need_dir "$ROOT/apps"

log "Report=$REPORT"
log "Backup=$BACKUP_DIR"

log "AUDIT suspects scroll"
{
  echo "---- contentContainerStyle flex:1 ----"
  rg_or_grep "contentContainerStyle=\\{\\{\\s*flex\\s*:\\s*1" "$ROOT/apps" || true
  echo
  echo "---- PanResponder / GestureDetector ----"
  rg_or_grep "PanResponder\\.create\\(|GestureDetector|Gesture\\.Pan\\(" "$ROOT/apps" || true
  echo
  echo "---- Fullscreen touch wrappers ----"
  rg_or_grep "TouchableWithoutFeedback|Keyboard\\.dismiss\\(|onStartShouldSetResponder|onMoveShouldSetResponder" "$ROOT/apps" || true
  echo
  echo "---- pointerEvents ----"
  rg_or_grep "pointerEvents=" "$ROOT/apps" || true
} | tee -a "$REPORT"

if [[ "$DO_PATCH" != "1" ]]; then
  log "AUDIT ONLY (DA_PATCH=0). Done."
  exit 0
fi

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN=1. Done."
  exit 0
fi

log "PATCH 1/2: contentContainerStyle flex:1 -> flexGrow:1"

python3 - "$ROOT" "$ROOT/apps" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib

base = pathlib.Path(sys.argv[1])
apps_root = pathlib.Path(sys.argv[2])
backup_root = pathlib.Path(sys.argv[3])
report = pathlib.Path(sys.argv[4])

pattern = re.compile(r'contentContainerStyle=\{\{\s*flex\s*:\s*1(\s*[,\}])')
changed_files = []

def backup_and_write(p: pathlib.Path, before: str, after: str):
    rel = p.relative_to(base)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")
    p.write_text(after, encoding="utf-8", errors="ignore")

for p in apps_root.rglob("*"):
    if not p.is_file():
        continue
    if p.suffix not in (".ts", ".tsx"):
        continue
    sp = str(p)
    if "/node_modules/" in sp or "/.git/" in sp:
        continue

    before = p.read_text(encoding="utf-8", errors="ignore")
    after = pattern.sub(r'contentContainerStyle={{ flexGrow: 1\1', before)

    if after != before:
        backup_and_write(p, before, after)
        changed_files.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[patch-flexgrow] changed files:\n")
    for cf in changed_files:
        f.write(f"  - {cf}\n")
    f.write(f"[patch-flexgrow] total: {len(changed_files)}\n")
PY

if [[ "$PATCH_OVERLAYS" == "1" ]]; then
  log "PATCH 2/2: decorative overlays -> pointerEvents=\"none\" (Background/Overlay/Snow only)"

  python3 - "$ROOT" "$ROOT/apps" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib

base = pathlib.Path(sys.argv[1])
apps_root = pathlib.Path(sys.argv[2])
backup_root = pathlib.Path(sys.argv[3])
report = pathlib.Path(sys.argv[4])

SAFE_NAME = re.compile(r'(Background|Overlay|Snow)', re.IGNORECASE)
ABS_HINT = re.compile(r'absoluteFill|absoluteFillObject|position\s*:\s*[\'"]absolute[\'"]', re.MULTILINE)
HAS_POINTER = re.compile(r'pointerEvents\s*=')
tag_view = re.compile(r'<(Animated\.)?View\b[^>]*>')

changed = []

def backup_and_write(p: pathlib.Path, before: str, after: str):
    rel = p.relative_to(base)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")
    p.write_text(after, encoding="utf-8", errors="ignore")

def inject_pointer(tag: str) -> str:
    if "pointerEvents" in tag:
        return tag
    return tag[:-1] + ' pointerEvents="none">'

for p in apps_root.rglob("*"):
    if not p.is_file():
        continue
    if p.suffix not in (".ts", ".tsx"):
        continue
    sp = str(p)
    if "/node_modules/" in sp or "/.git/" in sp:
        continue
    if not SAFE_NAME.search(p.name):
        continue

    before = p.read_text(encoding="utf-8", errors="ignore")
    if not ABS_HINT.search(before):
        continue
    if HAS_POINTER.search(before):
        continue

    m = tag_view.search(before)
    if not m:
        continue

    after = before[:m.start()] + inject_pointer(m.group(0)) + before[m.end():]
    if after != before:
        backup_and_write(p, before, after)
        changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[patch-overlays] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[patch-overlays] total: {len(changed)}\n")
PY
else
  log "Overlay patch disabled (DA_PATCH_OVERLAYS=0)"
fi

log "Done."
log "Report: $REPORT"
log "Rollback from: $BACKUP_DIR"
