#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/abs_overlays_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/abs_overlays_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

log "🧯 Disable ABS overlays (decorative) => pointerEvents=\"none\""
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

apps = [root/"apps"/a for a in ("client","merchant","courier")]

TAGS = r'(Animated\.)?(View|Pressable|LinearGradient|BlurView|Svg|Image|ImageBackground)'
ABS_HINT = re.compile(r'StyleSheet\.absoluteFillObject|StyleSheet\.absoluteFill\b|absoluteFillObject|absoluteFill\b|position\s*:\s*[\'"]absolute[\'"]', re.MULTILINE)
HAS_POINTER = re.compile(r'pointerEvents\s*=')

# self-closing tag: <View ... />
SELF = re.compile(rf'<{TAGS}\b[^>]*\/>', re.MULTILINE)
# empty pair: <View ...></View> with only whitespace inside
EMPTY_PAIR = re.compile(rf'(<{TAGS}\b[^>]*>)(\s*)(<\/{TAGS}\s*>)', re.MULTILINE)

def backup(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

def add_pointer_none(tag: str) -> str:
    if HAS_POINTER.search(tag):
        return tag
    # insert before "/>" or ">"
    if tag.rstrip().endswith("/>"):
        return tag[:-2] + ' pointerEvents="none" />'
    if tag.rstrip().endswith(">"):
        return tag[:-1] + ' pointerEvents="none">'
    return tag

changed = []

for app in apps:
    if not app.exists():
        continue

    # scan likely places
    scan_dirs = [app/"app", app/"src", app/"ui", app/"components"]
    scan_dirs = [d for d in scan_dirs if d.exists()]

    for d in scan_dirs:
        for p in d.rglob("*"):
            if not p.is_file() or p.suffix not in (".ts",".tsx"):
                continue
            sp = str(p)
            if "/node_modules/" in sp or "/.git/" in sp:
                continue

            before = p.read_text(encoding="utf-8", errors="ignore")
            after = before

            # Patch ONLY overlays that look absolute and are self-closing OR empty (decorative)
            def repl_self(m: re.Match):
                tag = m.group(0)
                if not ABS_HINT.search(tag):
                    return tag
                return add_pointer_none(tag)

            after = SELF.sub(repl_self, after)

            def repl_empty(m: re.Match):
                open_tag, mid, close_tag = m.group(1), m.group(2), m.group(3)
                if not ABS_HINT.search(open_tag):
                    return m.group(0)
                open_tag2 = add_pointer_none(open_tag)
                return open_tag2 + mid + close_tag

            after = EMPTY_PAIR.sub(repl_empty, after)

            if after != before:
                backup(p, before)
                p.write_text(after, encoding="utf-8", errors="ignore")
                changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[abs-overlays] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[abs-overlays] total: {len(changed)}\n")
PY

log "✅ Done."

log "🧯 Rollback (1-liner): rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""
