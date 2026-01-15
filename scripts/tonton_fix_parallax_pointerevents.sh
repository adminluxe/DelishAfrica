#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/parallax_pointerevents_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/parallax_pointerevents_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"
log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

log "🧩 Fix ParallaxScrollView pointerEvents (none -> box-none/auto)"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

# 1) Find candidate files
FILES=()
if command -v rg >/dev/null 2>&1; then
  while IFS= read -r f; do FILES+=("$f"); done < <(
    rg -l --hidden --glob '!**/node_modules/**' --glob '!**/.git/**' \
      "parallax|ParallaxScrollView|parallax-scroll-view|pointerEvents=\"none\"|pointerEvents=\\{\"none\"\\}" \
      "$ROOT/apps" || true
  )
else
  while IFS= read -r f; do FILES+=("$f"); done < <(
    find "$ROOT/apps" -type f \( -name "*parallax*scroll*.ts" -o -name "*parallax*scroll*.tsx" \) 2>/dev/null || true
  )
fi

# keep only ts/tsx
CAND=()
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  [[ "$f" == *.ts || "$f" == *.tsx ]] || continue
  # focus: parallax files OR ones containing ParallaxScrollView
  if [[ "$f" == *parallax* ]] || grep -q "ParallaxScrollView" "$f" 2>/dev/null; then
    CAND+=("$f")
  fi
done

# dedupe
mapfile -t CAND < <(printf "%s\n" "${CAND[@]}" | awk '!seen[$0]++')

log "📄 Candidates: ${#CAND[@]}"
printf "%s\n" "${CAND[@]}" | tee -a "$REPORT" || true

python3 - "$ROOT" "$BACKUP_DIR" "$REPORT" "${CAND[@]}" <<'PY'
import re, sys, pathlib

root = pathlib.Path(sys.argv[1])
backup_root = pathlib.Path(sys.argv[2])
report = pathlib.Path(sys.argv[3])
files = [pathlib.Path(p) for p in sys.argv[4:]]

def backup(p: pathlib.Path, before: str):
    rel = p.relative_to(root)
    dst = backup_root / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(before, encoding="utf-8", errors="ignore")

def sub_tag_pointer(s: str, tag_regex: re.Pattern, target: str):
    # replace pointerEvents="none" or pointerEvents={"none"} inside specific tags
    def repl(m: re.Match):
        tag = m.group(0)
        tag = re.sub(r'pointerEvents\s*=\s*"none"', f'pointerEvents="{target}"', tag)
        tag = re.sub(r'pointerEvents\s*=\s*\{\s*"none"\s*\}', f'pointerEvents="{target}"', tag)
        tag = re.sub(r"pointerEvents\s*=\s*\{\s*'none'\s*\}", f'pointerEvents="{target}"', tag)
        return tag
    return tag_regex.sub(repl, s)

changed = []

# Tag patterns (opening tags only)
re_view = re.compile(r'<(?:Animated\.)?View\b[^>]*pointerEvents\s*=\s*(?:"none"|\{\s*[\'"]none[\'"]\s*\})[^>]*>', re.MULTILINE)
re_scroll = re.compile(r'<(?:Animated\.)?(?:ScrollView|FlatList|SectionList)\b[^>]*pointerEvents\s*=\s*(?:"none"|\{\s*[\'"]none[\'"]\s*\})[^>]*>', re.MULTILINE)

for p in files:
    if not p.exists():
        continue

    before = p.read_text(encoding="utf-8", errors="ignore")
    after = before

    # 1) If a View-like wrapper is pointerEvents none => box-none (so children can still receive)
    after = sub_tag_pointer(after, re_view, "box-none")

    # 2) If a scrollable is pointerEvents none => auto (so it can receive pan)
    after = sub_tag_pointer(after, re_scroll, "auto")

    if after != before:
        backup(p, before)
        p.write_text(after, encoding="utf-8", errors="ignore")
        changed.append(str(p))

with open(report, "a", encoding="utf-8") as f:
    f.write("\n[parallax-pointerevents] changed files:\n")
    for cf in changed:
        f.write(f"  - {cf}\n")
    f.write(f"[parallax-pointerevents] total: {len(changed)}\n")
PY

log "✅ Done."
log "🧯 Rollback (1-liner): rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""
