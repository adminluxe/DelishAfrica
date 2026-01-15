#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/scroll_rescue_stage2_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/scroll_rescue_stage2_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

log "🧬 Scroll Rescue Stage2 (SAFE replacements only)"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

# Evidence before
if command -v rg >/dev/null 2>&1; then
  log "🔎 Evidence (before): scrollEnabled/disableScrollViewPanResponder/contentContainerStyle flex:1"
  rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' \
    "scrollEnabled\s*=\s*\{\s*false\s*\}|disableScrollViewPanResponder\s*=\s*\{\s*true\s*\}|contentContainerStyle\s*=\s*\{\{[^}]*flex\s*:\s*1|contentContainerStyle\s*=\s*\{\[[^\]]*\{[^}]*flex\s*:\s*1" \
    "$ROOT/apps" | tee -a "$REPORT" || true
fi

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib, os

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

apps = ["client", "merchant", "courier"]
scan_dirs = ("app","src","ui","components")

def backup(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

changed = []

# 1) Hard killers: scrollEnabled false, disableScrollViewPanResponder true
re_scroll_false = re.compile(r'scrollEnabled\s*=\s*\{\s*false\s*\}')
re_disable_pan_true = re.compile(r'disableScrollViewPanResponder\s*=\s*\{\s*true\s*\}')

# 2) contentContainerStyle: flex:1 -> flexGrow:1 (object syntax)
# contentContainerStyle={{ ... flex: 1 ... }}
re_ccs_obj = re.compile(r'(contentContainerStyle\s*=\s*\{\{\s*)([\s\S]*?)(\s*\}\})', re.MULTILINE)

# contentContainerStyle={[ ... { flex: 1, ... } ... ]}
re_ccs_arr = re.compile(r'(contentContainerStyle\s*=\s*\{\[\s*)([\s\S]*?)(\s*\]\})', re.MULTILINE)

def fix_flex_to_flexgrow(s: str) -> str:
    # replace only flex: 1 (not flex: 0, not flex: somethingElse)
    return re.sub(r'\bflex\s*:\s*1\b', 'flexGrow: 1', s)

for app in apps:
    base = root / "apps" / app
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
            after = before

            # Killers
            after = re_scroll_false.sub('scrollEnabled={true}', after)
            after = re_disable_pan_true.sub('disableScrollViewPanResponder={false}', after)

            # contentContainerStyle objects
            def repl_obj(m):
                head, body, tail = m.group(1), m.group(2), m.group(3)
                body2 = fix_flex_to_flexgrow(body)
                return head + body2 + tail

            after = re_ccs_obj.sub(repl_obj, after)

            # contentContainerStyle arrays
            def repl_arr(m):
                head, body, tail = m.group(1), m.group(2), m.group(3)
                body2 = fix_flex_to_flexgrow(body)
                return head + body2 + tail

            after = re_ccs_arr.sub(repl_arr, after)

            if after != before:
                backup(p, before)
                p.write_text(after, encoding="utf-8", errors="ignore")
                changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[stage2-safe] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[stage2-safe] total: {len(changed)}\n")
PY

log "✅ Done."
log "🧯 Rollback (1-liner): rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""
