#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/finisher2_responder_killers_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/finisher2_responder_killers_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

log "🏁 FINISHER2: Disable responder killers (simple => true -> => false)"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

log "🔎 Evidence BEFORE (rg): responder + panResponder patterns"
if command -v rg >/dev/null 2>&1; then
  rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' --glob '!**/.tonton_backups/**' \
    "on(Start|Move)ShouldSetResponder(Capture)?\\s*=\\s*\\{\\s*\\([^)]*\\)\\s*=>\\s*true\\s*\\}" \
    "$ROOT/apps" | tee -a "$REPORT" || true

  rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' --glob '!**/.tonton_backups/**' \
    "on(Start|Move)ShouldSetPanResponder(Capture)?\\s*:\\s*\\([^)]*\\)\\s*=>\\s*true" \
    "$ROOT/apps" | tee -a "$REPORT" || true
fi

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" <<'PY'
import re, sys, pathlib

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])

apps = ["client", "merchant", "courier"]

# --- regex (SAFE: only arrow functions directly returning true) ---
# JSX props: onMoveShouldSetResponder={() => true}
re_jsx_true = re.compile(
    r'(on(?:Start|Move)ShouldSetResponder(?:Capture)?\s*=\s*\{\s*\([^)]*\)\s*=>\s*)true(\s*\})'
)

# PanResponder config: onMoveShouldSetPanResponder: () => true
re_pan_true = re.compile(
    r'(on(?:Start|Move)ShouldSetPanResponder(?:Capture)?\s*:\s*\([^)]*\)\s*=>\s*)true(\b)'
)

def backup(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

changed = []

for app in apps:
    base = root / "apps" / app
    if not base.exists():
        continue

    for p in base.rglob("*"):
        if not p.is_file() or p.suffix not in (".ts", ".tsx"):
            continue
        sp = str(p)
        if "/node_modules/" in sp or "/.git/" in sp or "/.tonton_backups/" in sp:
            continue

        before = p.read_text(encoding="utf-8", errors="ignore")
        after = before

        after = re_jsx_true.sub(r"\1false\2", after)
        after = re_pan_true.sub(r"\1false\2", after)

        if after != before:
            backup(p, before)
            p.write_text(after, encoding="utf-8", errors="ignore")
            changed.append(str(p))

with report.open("a", encoding="utf-8") as f:
    f.write("\n[finisher2] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[finisher2] total: {len(changed)}\n")
PY

log "✅ Done."
log "🧯 Rollback (1-liner): rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""

log "🔎 Evidence AFTER (rg): should now be empty or reduced"
if command -v rg >/dev/null 2>&1; then
  rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' --glob '!**/.tonton_backups/**' \
    "on(Start|Move)ShouldSetResponder(Capture)?\\s*=\\s*\\{\\s*\\([^)]*\\)\\s*=>\\s*true\\s*\\}" \
    "$ROOT/apps" | tee -a "$REPORT" || true
fi
