#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
APPS=(client courier merchant)

DO_PATCH="${DA_PATCH:-1}"                 # 1=patch, 0=audit only
PATCH_OVERLAYS="${DA_PATCH_OVERLAYS:-1}"  # 1=try overlay pointerEvents fix
DRY_RUN="${DA_DRY_RUN:-0}"                # 1=print only

ts() { date "+%Y%m%d_%H%M%S"; }
NOW="$(ts)"

BACKUP_DIR="$ROOT/.tonton_backups/scroll_rescue_v2_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/scroll_rescue_v2_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log() { echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN ▶ $*"
    return 0
  fi
  # shellcheck disable=SC2086
  eval "$@"
}

need_dir() { [[ -d "$1" ]] || { log "❌ Dossier introuvable: $1"; exit 1; }; }

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

rg_or_grep() {
  local pattern="$1"
  local path="$2"
  if command -v rg >/dev/null 2>&1; then
    rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' "$pattern" "$path" || true
  else
    grep -RIn --exclude-dir node_modules --exclude-dir .git "$pattern" "$path" || true
  fi
}

log "🧭 Root = $ROOT"
need_dir "$ROOT"
need_dir "$ROOT/apps"
for a in "${APPS[@]}"; do need_dir "$ROOT/apps/$a"; done

log "🧾 Report: $REPORT"
log "📦 Backup dir: $BACKUP_DIR"

log "🔬 Audit: suspects scroll"
{
  echo "---- contentContainerStyle flex:1 (PIÈGE) ----"
  rg_or_grep "contentContainerStyle=\\{\\{\\s*flex\\s*:\\s*1" "$ROOT/apps" || true
  echo
  echo "---- PanResponder / GestureDetector (suspects) ----"
  rg_or_grep "PanResponder\\.create\\(|GestureDetector|Gesture\\.Pan\\(" "$ROOT/apps" || true
  echo
  echo "---- Touch wrappers plein écran (suspects) ----"
  rg_or_grep "TouchableWithoutFeedback|Keyboard\\.dismiss\\(|onStartShouldSetResponder|onMoveShouldSetResponder" "$ROOT/apps" || true
  echo
  echo "---- pointerEvents (overlays potentiels) ----"
  rg_or_grep "pointerEvents=" "$ROOT/apps" || true
} | tee -a "$REPORT"

if [[ "$DO_PATCH" != "1" ]]; then
  log "⏭️ Mode audit only (DA_PATCH=0). FIN."
  exit 0
fi

log "🩺 Patch 1/2: contentContainerStyle flex:1 → flexGrow:1 (safe)"

PY_PATCH_FLEXGROW=$(cat <<'PY'
import re, sys, pathlib

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

def patch_file(p: pathlib.Path) -> bool:
    s = p.read_text(encoding="utf-8", errors="ignore")

    before = s

    # Replace exact + variations:
    # contentContainerStyle={{ flex: 1 }}
    # contentContainerStyle={{flex:1, ...}}
    s = re.sub(
        r'contentContainerStyle=\{\{\s*flex\s*:\s*1(\s*[,\}])',
        r'contentContainerStyle={{ flexGrow: 1\1',
        s
    )

    changed = (s != before)
    if changed:
        # backup
        rel = p.relative_to(root)
        dst = backup_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(before, encoding="utf-8", errors="ignore")
        p.write_text(s, encoding="utf-8", errors="ignore")
    return changed

changed_files = []
for p in root.rglob("*"):
    if p.is_file() and p.suffix in (".ts", ".tsx") and "node_modules" not in str(p) and ".git" not in str(p):
        if patch_file(p):
            changed_files.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[patch-flexgrow] changed files:\n")
    for cf in changed_files:
        f.write(f"  - {cf}\n")
PY
)

run "python3 - <<'PY'\n$PY_PATCH_FLEXGROW\nPY\n\"$ROOT/apps\" \"$BACKUP_DIR\" \"$REPORT\""

if [[ "$PATCH_OVERLAYS" == "1" ]]; then
  log "🩹 Patch 2/2: overlays décoratifs absolute → pointerEvents=\"none\" (safe zone filenames)"

  PY_PATCH_OVERLAYS=$(cat <<'PY'
import re, sys, pathlib

apps_root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

SAFE_NAME = re.compile(r'(Background|Overlay|Snow)', re.IGNORECASE)
ABSOLUTE_HINT = re.compile(r'absoluteFill|absoluteFillObject|position\s*:\s*[\'"]absolute[\'"]', re.MULTILINE)
HAS_POINTER = re.compile(r'pointerEvents\s*=')

def inject_pointerevents(tag: str) -> str:
    # tag is like "<View ...>"
    if "pointerEvents" in tag:
        return tag
    return tag[:-1] + ' pointerEvents="none">'

def patch_file(p: pathlib.Path, root: pathlib.Path) -> bool:
    s = p.read_text(encoding="utf-8", errors="ignore")
    before = s

    if not SAFE_NAME.search(p.name):
        return False
    if not ABSOLUTE_HINT.search(s):
        return False
    if HAS_POINTER.search(s):
        return False

    # Inject on first <View ...> or <Animated.View ...>
    m = re.search(r'<(Animated\.)?View\b[^>]*>', s)
    if not m:
        return False

    new_tag = inject_pointerevents(m.group(0))
    s = s[:m.start()] + new_tag + s[m.end():]

    if s != before:
        rel = p.relative_to(root)
        dst = backup_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(before, encoding="utf-8", errors="ignore")
        p.write_text(s, encoding="utf-8", errors="ignore")
        return True
    return False

changed = []
for p in apps_root.rglob("*"):
    if p.is_file() and p.suffix in (".ts", ".tsx") and "node_modules" not in str(p) and ".git" not in str(p):
        if patch_file(p, apps_root):
            changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[patch-overlays] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
PY
)
  run "python3 - <<'PY'\n$PY_PATCH_OVERLAYS\nPY\n\"$ROOT/apps\" \"$BACKUP_DIR\" \"$REPORT\""
else
  log "⏭️ Overlay patch désactivé (DA_PATCH_OVERLAYS=0)"
fi

log "✅ Patch terminé."
log "📄 Rapport: $REPORT"
log "🧯 Rollback: restore depuis $BACKUP_DIR (ou git checkout .)"
