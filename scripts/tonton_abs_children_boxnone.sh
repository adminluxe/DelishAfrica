#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/abs_children_boxnone_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/abs_children_boxnone_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

log "🛡️ Patch wrappers absoluteFill contenant {children} => pointerEvents=\"box-none\""
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib, os

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

apps = [root/"apps"/a for a in ("client","merchant","courier")]
scan_dirs = ("app","src","ui","components")

# components we patch (safe): View-like overlays that should not block touches to children
COMP = r'(Animated\.)?(View|LinearGradient|BlurView|ImageBackground)'
OPEN_TAG = re.compile(rf'<(?P<name>{COMP})\b(?P<attrs>[\s\S]*?)>', re.MULTILINE)

ABS_HINT = re.compile(
    r'absoluteFillObject|absoluteFill\b|StyleSheet\.absoluteFillObject|StyleSheet\.absoluteFill\b|position\s*:\s*[\'"]absolute[\'"]',
    re.MULTILINE
)
HAS_POINTER = re.compile(r'pointerEvents\s*=')

def backup(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

def is_self_closing(tag_text: str) -> bool:
    return tag_text.rstrip().endswith("/>")

changed = []

for app in apps:
    if not app.exists():
        continue
    bases = [app/d for d in scan_dirs if (app/d).exists()]
    for base in bases:
        for p in base.rglob("*"):
            if not p.is_file() or p.suffix not in (".ts",".tsx"):
                continue
            sp = str(p)
            if "/node_modules/" in sp or "/.git/" in sp:
                continue

            before = p.read_text(encoding="utf-8", errors="ignore")
            s = before
            out = []
            last = 0

            for m in OPEN_TAG.finditer(s):
                tag_full = m.group(0)
                name = m.group("name")

                # quick skip: self-closing
                if is_self_closing(tag_full):
                    continue

                # must look like absolute overlay
                if not ABS_HINT.search(tag_full):
                    continue

                # skip if already has pointerEvents
                if HAS_POINTER.search(tag_full):
                    continue

                # find closing tag of the *base* component (View, LinearGradient, etc.)
                base_name = name.split(".")[-1]  # View from Animated.View
                close_pat = re.compile(rf'</{re.escape(base_name)}\s*>', re.MULTILINE)
                close_m = close_pat.search(s, m.end(), m.end() + 6000)  # heuristic window
                if not close_m:
                    continue

                # inside must contain {children}
                inner = s[m.end():close_m.start()]
                if "{children}" not in inner:
                    continue

                # Patch: inject pointerEvents="box-none" into opening tag
                patched = tag_full[:-1] + ' pointerEvents="box-none">'
                out.append(s[last:m.start()])
                out.append(patched)
                last = m.end()

            if last == 0:
                continue

            out.append(s[last:])
            after = "".join(out)

            if after != before:
                backup(p, before)
                p.write_text(after, encoding="utf-8", errors="ignore")
                changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[abs-children-boxnone] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[abs-children-boxnone] total: {len(changed)}\n")
PY

log "✅ Done."
log "🧯 Rollback: rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""
