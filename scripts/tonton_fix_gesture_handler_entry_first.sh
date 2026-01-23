#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/gesture_handler_entry_first_$TS"
LOG="$BK/run.log"

mkdir -p "$BK/files"
exec > >(tee -a "$LOG") 2>&1

echo "=== TONTON FIX: react-native-gesture-handler first import in entry files ==="
echo "ROOT=$ROOT"
echo "BACKUP=$BK"
echo "LOG=$LOG"
echo

if [[ ! -d "$ROOT" ]]; then
  echo "❌ Repo introuvable: $ROOT"
  exit 1
fi

python3 - <<'PY' "$ROOT" "$BK"
import os, re, sys, shutil

root = sys.argv[1]
bk = sys.argv[2]

marker = "TONTON_SCROLL_HOTFIX: gesture-handler must be first import"

# We patch typical Expo entry files inside each app folder.
# Example seen in Metro: apps/client/entry.sharedarraybuffer.js
entry_name_re = re.compile(r"^entry.*\.(js|ts|tsx)$", re.I)

skip_dirs = {"node_modules", ".git", ".expo", ".tonton_backups", "ios", "android", "build", "dist", "coverage"}

def iter_entry_files():
    apps_dir = os.path.join(root, "apps")
    if not os.path.isdir(apps_dir):
        return
    for app in sorted(os.listdir(apps_dir)):
        app_dir = os.path.join(apps_dir, app)
        if not os.path.isdir(app_dir):
            continue
        for dirpath, dirnames, filenames in os.walk(app_dir):
            dirnames[:] = [d for d in dirnames if d not in skip_dirs]
            for fn in filenames:
                if entry_name_re.match(fn):
                    yield os.path.join(dirpath, fn)

def normalize(text: str):
    # remove ANY existing gesture-handler import/require line (we will re-insert at top)
    lines = text.splitlines(True)
    kept = []
    removed = 0
    for line in lines:
        if "react-native-gesture-handler" in line and ("import" in line or "require" in line):
            removed += 1
            continue
        kept.append(line)
    return "".join(kept), removed

def insert_first(text: str) -> str:
    lines = text.splitlines(True)
    out = []
    i = 0

    # Keep shebang if present
    if lines and lines[0].startswith("#!"):
        out.append(lines[0]); i = 1

    # Keep leading blank lines and comments (OK before first import)
    while i < len(lines):
        line = lines[i]
        s = line.lstrip()
        if line.strip() == "":
            out.append(line); i += 1; continue
        if s.startswith("//"):
            out.append(line); i += 1; continue
        if s.startswith("/*"):
            out.append(line); i += 1
            # consume until end of block comment
            while i < len(lines) and "*/" not in out[-1]:
                out.append(lines[i]); i += 1
            continue
        break

    out.append(f"import 'react-native-gesture-handler'; // {marker}\n")
    out.extend(lines[i:])
    return "".join(out)

changed = []
unchanged = []

for path in iter_entry_files():
    try:
        txt = open(path, "r", encoding="utf-8").read()
    except Exception:
        continue

    norm, _ = normalize(txt)
    new = insert_first(norm)

    if new != txt:
        rel = os.path.relpath(path, root)
        dst = os.path.join(bk, "files", rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)
        open(path, "w", encoding="utf-8").write(new)
        changed.append(rel)
    else:
        unchanged.append(os.path.relpath(path, root))

print("=== Summary ===")
print("Patched entry files:", len(changed))
for rel in changed:
    print(" -", rel)

print("Unchanged entry files:", len(unchanged))
for rel in unchanged[:30]:
    print(" -", rel)
if len(unchanged) > 30:
    print(f" ... +{len(unchanged)-30} more")

print("\nRestore command (if needed):")
print(f"  cp -a '{bk}/files/.' '{root}/'")
PY

echo
echo "✅ Done. Backup saved in: $BK"
echo "➡️ Now reload (tmux windows 5/6/7): press 'r'"
