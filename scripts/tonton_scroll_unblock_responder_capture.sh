#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/scroll_unblock_capture_$TS"
LOG="$BK/run.log"

mkdir -p "$BK/files"
exec > >(tee -a "$LOG") 2>&1

echo "=== TONTON scroll unblock: responder/panResponder capture ==="
echo "ROOT=$ROOT"
echo "BACKUP=$BK"
echo "LOG=$LOG"
echo

if [[ ! -d "$ROOT" ]]; then
  echo "❌ Repo introuvable: $ROOT"
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  echo "== Quick scan (top suspects, aperçu) =="
  (cd "$ROOT" && rg -n --glob='**/*.{ts,tsx,js,jsx}' \
    'on(Start|Move)ShouldSetResponder(Capture)?\s*=|on(Start|Move)ShouldSetPanResponder(Capture)?\s*:|PanResponder\.create\(|absoluteFillObject|pointerEvents|TouchTrace' \
    apps packages 2>/dev/null | head -n 40 || true)
  echo
fi

python3 - <<'PY' "$ROOT" "$BK"
import os, re, sys, shutil

root = sys.argv[1]
bk = sys.argv[2]

marker = "TONTON_SCROLL_HOTFIX: unblock responder capture"

include_dirs = [os.path.join(root, "apps"), os.path.join(root, "packages")]
exts = {".ts", ".tsx", ".js", ".jsx"}
skip_dirs = {
    "node_modules", ".git", ".expo", ".tonton_backups", "dist", "build", "coverage",
    "Pods", "DerivedData", "android", "ios"
}

props = [
    "onStartShouldSetResponderCapture",
    "onMoveShouldSetResponderCapture",
    "onStartShouldSetResponder",
    "onMoveShouldSetResponder",
    "onStartShouldSetPanResponderCapture",
    "onMoveShouldSetPanResponderCapture",
    "onStartShouldSetPanResponder",
    "onMoveShouldSetPanResponder",
]

compiled = []
for p in props:
    # JSX attribute: p={ ... => true }
    compiled.append(re.compile(rf"(\\b{re.escape(p)}\\s*=\\s*\\{{[\\s\\S]*?=>\\s*)true\\b"))
    # JSX attribute: p={ ... return true ... }
    compiled.append(re.compile(rf"(\\b{re.escape(p)}\\s*=\\s*\\{{[\\s\\S]*?\\breturn\\s*)true\\b"))
    # Object property: p: ... => true
    compiled.append(re.compile(rf"(\\b{re.escape(p)}\\s*:\\s*[\\s\\S]*?=>\\s*)true\\b"))
    # Object property: p: ... return true
    compiled.append(re.compile(rf"(\\b{re.escape(p)}\\s*:\\s*[\\s\\S]*?\\breturn\\s*)true\\b"))

def should_skip_dir(name: str) -> bool:
    if name in skip_dirs:
        return True
    if name.startswith("."):
        return True
    return False

def iter_files():
    for base in include_dirs:
        if not os.path.isdir(base):
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
            for fn in filenames:
                ext = os.path.splitext(fn)[1].lower()
                if ext in exts:
                    p = os.path.join(dirpath, fn)
                    try:
                        if os.path.getsize(p) > 1_500_000:
                            continue
                    except OSError:
                        continue
                    yield p

changed = []
total_repl = 0

for path in iter_files():
    try:
        txt = open(path, "r", encoding="utf-8").read()
    except Exception:
        continue

    new = txt
    repl_here = 0

    for pat in compiled:
        new2, n = pat.subn(r"\\1false /* " + marker + " */", new)
        if n:
            repl_here += n
            new = new2

    if repl_here and new != txt:
        rel = os.path.relpath(path, root)
        dst = os.path.join(bk, "files", rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(path, dst)
        open(path, "w", encoding="utf-8").write(new)
        changed.append((rel, repl_here))
        total_repl += repl_here

print("=== Patch summary ===")
print("Changed files:", len(changed))
print("Replacements:", total_repl)
for rel, n in changed[:60]:
    print(f" - {rel} (repl={n})")
if len(changed) > 60:
    print(f" ... +{len(changed)-60} more")

print("\\nRestore command (if needed):")
print(f"  cp -a '{bk}/files/.' '{root}/'")
PY

echo
echo "✅ Done. Backup saved in: $BK"
echo "➡️ Reload: dans tmux (client/merchant/courier) appuie sur 'r'."
