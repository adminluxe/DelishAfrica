#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/disable_touchtrace_$TS"
LOG="$BK/run.log"

mkdir -p "$BK/files"
exec > >(tee -a "$LOG") 2>&1

echo "=== TONTON disable TouchTrace (scroll hotfix) ==="
echo "ROOT=$ROOT"
echo "BACKUP=$BK"
echo "LOG=$LOG"
echo

if [[ ! -d "$ROOT" ]]; then
  echo "❌ Repo introuvable: $ROOT"
  exit 1
fi

# Finder
find_files() {
  if command -v rg >/dev/null 2>&1; then
    (cd "$ROOT" && rg -l --glob='**/*.{ts,tsx,js,jsx}' '<TouchTrace\b' apps packages 2>/dev/null || true)
  else
    (cd "$ROOT" && grep -RIl --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' '<TouchTrace' apps packages 2>/dev/null || true)
  fi
}

mapfile -t FILES < <(find_files)

echo "Found ${#FILES[@]} file(s) with <TouchTrace .../>"
if [[ "${#FILES[@]}" -eq 0 ]]; then
  echo "✅ Rien à faire (aucun <TouchTrace trouvé)."
  exit 0
fi

python3 - <<'PY' "$ROOT" "$BK" "${FILES[@]}"
import os, re, sys, shutil

root = sys.argv[1]
bk   = sys.argv[2]
files = sys.argv[3:]

marker = "TONTON_SCROLL_HOTFIX: TouchTrace disabled (was blocking scroll)"
# Match self-closing <TouchTrace ... />
pat_self = re.compile(r"<TouchTrace\b[^>]*/\s*>", re.M)
# Match block <TouchTrace ...>...</TouchTrace>
pat_block = re.compile(r"<TouchTrace\b[^>]*>.*?</TouchTrace\s*>", re.S)

changed = []
total_repl = 0

for rel in files:
    src = os.path.join(root, rel)
    if not os.path.isfile(src):
        continue

    txt = open(src, "r", encoding="utf-8").read()
    if marker in txt:
        # already patched (idempotent)
        continue

    new = txt

    # Replace self-closing tags first
    def repl_self(m):
        return "{null /* " + marker + " */}"
    new2, n1 = pat_self.subn(repl_self, new)

    # Replace block tags (rare)
    def repl_block(m):
        return "{null /* " + marker + " */}"
    new3, n2 = pat_block.subn(repl_block, new2)

    if (n1 + n2) > 0 and new3 != txt:
        # Backup original
        dst = os.path.join(bk, "files", rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)

        open(src, "w", encoding="utf-8").write(new3)
        changed.append((rel, n1 + n2))
        total_repl += (n1 + n2)

print("\n=== Patch summary ===")
print("Changed files:", len(changed))
print("Replacements:", total_repl)
for rel, n in changed[:40]:
    print(f" - {rel}  (repl={n})")
if len(changed) > 40:
    print(f" ... +{len(changed)-40} more")

print("\nRestore command (if needed):")
print(f"  cp -a '{bk}/files/.' '{root}/'")
PY

echo
echo "✅ Done. Backup saved in: $BK"
