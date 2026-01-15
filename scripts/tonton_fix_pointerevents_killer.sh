#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="${DA_ROOT:-/opt/delishafrica/monorepo}"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/pointerevents_fix_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/pointerevents_fix_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

log "Root=$ROOT"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" <<'PY'
import sys, re, pathlib

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

apps_root = root / "apps"
targets = [apps_root / "client", apps_root / "merchant", apps_root / "courier"]

# 1) Remove pointerEvents="none" on ScrollView / Animated.ScrollView opening tags
scroll_tag = re.compile(r'<(Animated\.)?(ScrollView)\b[^>]*>', re.MULTILINE)
pe_none_attr = re.compile(r'\s+pointerEvents\s*=\s*["\']none["\']')

# 2) If a wrapper opening tag has pointerEvents="none" and within next 6 lines we see {children},
#    change none -> box-none (so children can receive touches).
pe_none_in_open = re.compile(r'pointerEvents\s*=\s*["\']none["\']')

def backup_file(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

changed = []

for app in targets:
    if not app.exists():
        continue
    for p in app.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix not in (".ts", ".tsx"):
            continue
        sp = str(p)
        if "/node_modules/" in sp or "/.git/" in sp:
            continue

        before = p.read_text(encoding="utf-8", errors="ignore")
        after = before

        # --- Patch A: ScrollView pointerEvents="none" => remove attribute
        def fix_scroll_tag(m: re.Match):
            tag = m.group(0)
            tag2 = pe_none_attr.sub("", tag)
            return tag2

        after = scroll_tag.sub(fix_scroll_tag, after)

        # --- Patch B: wrappers with pointerEvents="none" that contain {children} soon after => box-none
        lines = after.splitlines(True)
        for i, line in enumerate(lines):
            if 'pointerEvents' in line and 'none' in line and '<' in line:
                # look ahead a few lines for children
                window = ''.join(lines[i:i+7])
                if "{children}" in window:
                    lines[i] = pe_none_in_open.sub('pointerEvents="box-none"', lines[i])
        after2 = ''.join(lines)
        after = after2

        if after != before:
            backup_file(p, before)
            p.write_text(after, encoding="utf-8", errors="ignore")
            changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[RESULT] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[RESULT] total: {len(changed)}\n")
PY

log "✅ Done. Changed files list in: $REPORT"
log "🧯 Rollback: restore from $BACKUP_DIR (or git checkout -- .)"
