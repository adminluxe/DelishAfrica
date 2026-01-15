#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/unblock_scroll_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/unblock_scroll_$NOW.log"

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

log "🧷 Unblock scroll: Keyboard.dismiss wrappers + responder capture"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

# Quick evidence in report
if command -v rg >/dev/null 2>&1; then
  log "🔎 Evidence scan (rg)"
  rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' \
    "Keyboard\.dismiss|TouchableWithoutFeedback|onMoveShouldSetResponder|onStartShouldSetResponder|PanResponder|GestureDetector" \
    "$ROOT/apps" | tee -a "$REPORT" || true
else
  log "🔎 Evidence scan (grep)"
  grep -RIn --exclude-dir node_modules --exclude-dir .git \
    "Keyboard\.dismiss\|TouchableWithoutFeedback\|onMoveShouldSetResponder\|onStartShouldSetResponder\|PanResponder\|GestureDetector" \
    "$ROOT/apps" | tee -a "$REPORT" || true
fi

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib, os

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

apps = ["client","merchant","courier"]
scan_dirs = ("app","src","ui","components")

# wrappers that often swallow gestures
WRAP = r'(Pressable|TouchableWithoutFeedback|TouchableOpacity|TouchableHighlight|TouchableNativeFeedback|View|Animated\.View)'
open_tag = re.compile(rf'<(?P<name>{WRAP})\b(?P<attrs>[^>]*)>', re.MULTILINE)

kbd = re.compile(r'Keyboard\.dismiss', re.MULTILINE)
has_pointer = re.compile(r'pointerEvents\s*=')

# responder capture patterns that kill scroll
resp_patterns = [
    (re.compile(r'onMoveShouldSetResponderCapture\s*=\s*\{\s*\(\s*\)\s*=>\s*true\s*\}', re.MULTILINE),
     'onMoveShouldSetResponderCapture={() => false}'),
    (re.compile(r'onStartShouldSetResponderCapture\s*=\s*\{\s*\(\s*\)\s*=>\s*true\s*\}', re.MULTILINE),
     'onStartShouldSetResponderCapture={() => false}'),
    (re.compile(r'onMoveShouldSetResponder\s*=\s*\{\s*\(\s*\)\s*=>\s*true\s*\}', re.MULTILINE),
     'onMoveShouldSetResponder={() => false}'),
    (re.compile(r'onStartShouldSetResponder\s*=\s*\{\s*\(\s*\)\s*=>\s*true\s*\}', re.MULTILINE),
     'onStartShouldSetResponder={() => false}'),
]

def backup(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

changed = []

for app in apps:
    base = root/"apps"/app
    if not base.exists():
        continue

    bases = [base/d for d in scan_dirs if (base/d).exists()]
    for d in bases:
        for p in d.rglob("*"):
            if not p.is_file() or p.suffix not in (".ts",".tsx"):
                continue
            sp = str(p)
            if "/node_modules/" in sp or "/.git/" in sp:
                continue

            before = p.read_text(encoding="utf-8", errors="ignore")
            s = before

            # 1) neutralize responder capture => false
            for pat, repl in resp_patterns:
                s = pat.sub(repl, s)

            # 2) If a wrapper tag contains Keyboard.dismiss, inject pointerEvents="box-none" if absent
            def repl_open(m: re.Match):
                tag = m.group(0)
                attrs = m.group("attrs") or ""
                if not kbd.search(attrs):
                    return tag
                if has_pointer.search(tag):
                    return tag
                # inject pointerEvents in opening tag
                return tag[:-1] + ' pointerEvents="box-none">'

            s2 = open_tag.sub(repl_open, s)

            if s2 != before:
                backup(p, before)
                p.write_text(s2, encoding="utf-8", errors="ignore")
                changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[unblock-scroll] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[unblock-scroll] total: {len(changed)}\n")
PY

log "✅ Done."
log "🧯 Rollback (1-liner): rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""
