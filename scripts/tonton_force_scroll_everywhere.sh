#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/force_scroll_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/force_scroll_$NOW.log"

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

log "🧨 FORCE SCROLL (3 apps) + proof logs"
log "Root=$ROOT"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib, os

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

apps_root = root / "apps"
apps = ["client", "merchant", "courier"]

# Targets: ScrollView, Animated.ScrollView, FlatList, SectionList
open_tag = re.compile(r'<(?P<anim>Animated\.)?(?P<name>ScrollView|FlatList|SectionList)\b(?P<attrs>[^>]*)>', re.MULTILINE)

def backup(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

def patch_tag(tag: str, app: str) -> str:
    # remove pointerEvents="none" on scrollables
    tag2 = re.sub(r'\s+pointerEvents\s*=\s*["\']none["\']', '', tag)

    # force scrollEnabled true (covers {false}, false, {0}, 0)
    tag2 = re.sub(r'scrollEnabled\s*=\s*\{\s*false\s*\}', 'scrollEnabled={true}', tag2)
    tag2 = re.sub(r'scrollEnabled\s*=\s*false', 'scrollEnabled={true}', tag2)
    tag2 = re.sub(r'scrollEnabled\s*=\s*\{\s*0\s*\}', 'scrollEnabled={true}', tag2)
    tag2 = re.sub(r'scrollEnabled\s*=\s*0', 'scrollEnabled={true}', tag2)

    # if no scrollEnabled prop, inject it
    if "scrollEnabled" not in tag2:
        tag2 = tag2[:-1] + ' scrollEnabled={true}>'

    # ensure scrollEventThrottle for better logs (harmless)
    if "scrollEventThrottle" not in tag2 and ("ScrollView" in tag2 or "FlatList" in tag2 or "SectionList" in tag2):
        tag2 = tag2[:-1] + ' scrollEventThrottle={16}>'

    # add onScrollBeginDrag proof log if absent
    if "onScrollBeginDrag" not in tag2:
        tag2 = tag2[:-1] + f' onScrollBeginDrag={{() => console.log("[SCROLLBEGIN] {app}")}}>'

    return tag2

changed = []

for app in apps:
    base = apps_root / app
    if not base.exists():
        continue

    # only scan likely code folders to avoid vendored copies
    scan_dirs = [base / "app", base / "src", base / "ui", base / "components"]
    scan_dirs = [d for d in scan_dirs if d.exists()]

    for d in scan_dirs:
        for p in d.rglob("*"):
            if not p.is_file() or p.suffix not in (".ts", ".tsx"):
                continue
            sp = str(p)
            if "/node_modules/" in sp or "/.git/" in sp:
                continue

            before = p.read_text(encoding="utf-8", errors="ignore")
            after = before

            def repl(m: re.Match):
                full = m.group(0)
                return patch_tag(full, app)

            after = open_tag.sub(repl, after)

            # also: if we find pointerEvents="none" on wrapper lines that contain {children} soon after => box-none
            lines = after.splitlines(True)
            for i, line in enumerate(lines):
                if 'pointerEvents' in line and '"none"' in line:
                    window = ''.join(lines[i:i+8])
                    if "{children}" in window:
                        lines[i] = re.sub(r'pointerEvents\s*=\s*["\']none["\']', 'pointerEvents="box-none"', lines[i])
            after = ''.join(lines)

            if after != before:
                backup(p, before)
                p.write_text(after, encoding="utf-8", errors="ignore")
                changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[force-scroll] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[force-scroll] total: {len(changed)}\n")
PY

log "✅ Done."
log "📄 Report: $REPORT"
log "🧯 Rollback: restore from $BACKUP_DIR (or git checkout -- .)"
