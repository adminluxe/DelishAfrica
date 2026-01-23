#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/force_scroll_enabled_$TS"
LOG="$BK/run.log"

mkdir -p "$BK/files"
exec > >(tee -a "$LOG") 2>&1

echo "=== TONTON force scroll enabled ==="
echo "ROOT=$ROOT"
echo "BACKUP=$BK"
echo "LOG=$LOG"
echo

if [[ ! -d "$ROOT" ]]; then
  echo "❌ Repo introuvable: $ROOT"
  exit 1
fi

if command -v rg >/dev/null 2>&1; then
  echo "== PREVIEW (si tu veux voir les suspects) =="
  (cd "$ROOT" && rg -n --glob='**/*.{ts,tsx,js,jsx}' \
    'scrollEnabled\s*=\s*\{|scrollEnabled\s*:|disableScrollViewPanResponder' apps packages 2>/dev/null | head -n 80 || true)
  echo
fi

python3 - <<'PY' "$ROOT" "$BK"
import os, re, sys, shutil

root = sys.argv[1]
bk = sys.argv[2]

marker = "TONTON_SCROLL_HOTFIX: force scroll enabled"

include_dirs = [os.path.join(root, "apps"), os.path.join(root, "packages")]
exts = {".ts", ".tsx", ".js", ".jsx"}
skip_dirs = {
    "node_modules", ".git", ".expo", ".tonton_backups", "dist", "build", "coverage",
    "Pods", "DerivedData", "android", "ios"
}

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
                        if os.path.getsize(p) > 2_000_000:
                            continue
                    except OSError:
                        continue
                    yield p

# Explicit false -> true
rx_jsx_scroll_false = re.compile(r"\bscrollEnabled\s*=\s*\{\s*false\s*\}")
rx_obj_scroll_false = re.compile(r"\bscrollEnabled\s*:\s*false\b")

# iOS-disable patterns -> true (common ones)
rx_jsx_scroll_ios_neq = re.compile(r"\bscrollEnabled\s*=\s*\{\s*Platform\.OS\s*!==\s*['\"]ios['\"]\s*\}")
rx_jsx_scroll_android_eq = re.compile(r"\bscrollEnabled\s*=\s*\{\s*Platform\.OS\s*===\s*['\"]android['\"]\s*\}")
rx_jsx_scroll_not_isios = re.compile(r"\bscrollEnabled\s*=\s*\{\s*!\s*(?:isIOS|IS_IOS|ios)\s*\}")

# disableScrollViewPanResponder true -> false
rx_jsx_disable_pan_true = re.compile(r"\bdisableScrollViewPanResponder\s*=\s*\{\s*true\s*\}")
rx_obj_disable_pan_true = re.compile(r"\bdisableScrollViewPanResponder\s*:\s*true\b")

# Also catch numeric 0 in JSX (rare)
rx_jsx_scroll_zero = re.compile(r"\bscrollEnabled\s*=\s*\{\s*0\s*\}")

changed = []
total_repl = 0

for path in iter_files():
    try:
        txt = open(path, "r", encoding="utf-8").read()
    except Exception:
        continue

    new = txt
    repl_here = 0

    # scrollEnabled={false} -> {true}
    new2, n = rx_jsx_scroll_false.subn(f"scrollEnabled={{true /* {marker} */}}", new)
    repl_here += n; new = new2

    # scrollEnabled={0} -> {true}
    new2, n = rx_jsx_scroll_zero.subn(f"scrollEnabled={{true /* {marker} */}}", new)
    repl_here += n; new = new2

    # scrollEnabled: false -> true
    new2, n = rx_obj_scroll_false.subn(f"scrollEnabled: true /* {marker} */", new)
    repl_here += n; new = new2

    # iOS-disabling patterns -> true
    new2, n = rx_jsx_scroll_ios_neq.subn(f"scrollEnabled={{true /* {marker} (was Platform.OS !== 'ios') */}}", new)
    repl_here += n; new = new2

    new2, n = rx_jsx_scroll_android_eq.subn(f"scrollEnabled={{true /* {marker} (was Platform.OS === 'android') */}}", new)
    repl_here += n; new = new2

    new2, n = rx_jsx_scroll_not_isios.subn(f"scrollEnabled={{true /* {marker} (was !isIOS) */}}", new)
    repl_here += n; new = new2

    # disableScrollViewPanResponder={true} -> {false}
    new2, n = rx_jsx_disable_pan_true.subn(f"disableScrollViewPanResponder={{false /* {marker} */}}", new)
    repl_here += n; new = new2

    # disableScrollViewPanResponder: true -> false
    new2, n = rx_obj_disable_pan_true.subn(f"disableScrollViewPanResponder: false /* {marker} */", new)
    repl_here += n; new = new2

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
for rel, n in changed[:80]:
    print(f" - {rel} (repl={n})")
if len(changed) > 80:
    print(f" ... +{len(changed)-80} more")

print("\nRestore command (if needed):")
print(f"  cp -a '{bk}/files/.' '{root}/'")
PY

echo
echo "✅ Done. Backup: $BK"
echo "➡️ Reload apps: tmux window 5/6/7 -> touche 'r'"
