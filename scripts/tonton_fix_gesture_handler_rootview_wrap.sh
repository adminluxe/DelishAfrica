#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/gesture_rootview_wrap_$TS"
LOG="$BK/run.log"

mkdir -p "$BK/files"
exec > >(tee -a "$LOG") 2>&1

echo "=== TONTON FIX #2: Wrap root with GestureHandlerRootView ==="
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

marker = "TONTON_SCROLL_HOTFIX: wrap root with GestureHandlerRootView"
apps_dir = os.path.join(root, "apps")
targets = ["client", "merchant", "courier"]

exts = {".js", ".ts", ".tsx", ".jsx"}
skip_dirs = {"node_modules", ".git", ".expo", ".tonton_backups", "ios", "android", "dist", "build", "coverage", "Pods", "DerivedData"}

def should_skip_dir(d: str) -> bool:
    return d in skip_dirs or d.startswith(".")

def iter_files(app_path: str):
    for dirpath, dirnames, filenames in os.walk(app_path):
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

# Helpers to insert imports safely
def ensure_imports(txt: str) -> str:
    if marker in txt:
        return txt

    lines = txt.splitlines(True)

    # Find the line with: import 'react-native-gesture-handler'
    gh_idx = None
    for i, line in enumerate(lines):
        if re.search(r"^\s*import\s+['\"]react-native-gesture-handler['\"]\s*;", line):
            gh_idx = i
            break

    insert_at = 0
    if gh_idx is not None:
        insert_at = gh_idx + 1
    else:
        # If somehow missing, we still don't want to insert above shebang/comments too aggressively.
        # Insert after header comments & blank lines.
        j = 0
        while j < len(lines):
            s = lines[j].lstrip()
            if lines[j].strip() == "" or s.startswith("//") or s.startswith("/*"):
                j += 1
                continue
            break
        insert_at = j

    # Ensure React import (for React.createElement). Use namespace import to avoid default interop issues.
    has_react = re.search(r"from\s+['\"]react['\"]", txt) is not None
    has_ghroot_import = re.search(r"GestureHandlerRootView", txt) is not None and re.search(r"from\s+['\"]react-native-gesture-handler['\"]", txt) is not None

    inject = []
    if not has_react:
        inject.append("import * as React from 'react';\n")
    if not has_ghroot_import:
        inject.append("import { GestureHandlerRootView } from 'react-native-gesture-handler';\n")

    if not inject:
        return txt

    return "".join(lines[:insert_at] + inject + lines[insert_at:])

# Patch registerRootComponent(App)
rx_register = re.compile(r"registerRootComponent\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)\s*;?", re.M)

# Patch AppRegistry.registerComponent(appName, () => App)
rx_appregistry = re.compile(
    r"AppRegistry\.registerComponent\s*\(\s*([^,]+)\s*,\s*\(\s*\)\s*=>\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)\s*;?",
    re.M,
)

def wrap_component_call(component_name: str) -> str:
    # no JSX => safe even in .ts
    return (
        f"const TONTON_GestureRoot = () => React.createElement(\n"
        f"  GestureHandlerRootView,\n"
        f"  {{ style: {{ flex: 1 }} }},\n"
        f"  React.createElement({component_name}, null)\n"
        f");\n"
        f"// {marker}\n"
    )

patched = []
skipped = []
changed_count = 0

for app in targets:
    app_path = os.path.join(apps_dir, app)
    if not os.path.isdir(app_path):
        skipped.append((app, "missing app dir"))
        continue

    # Only patch files that actually contain registerRootComponent/AppRegistry.registerComponent
    for path in iter_files(app_path):
        try:
            txt = open(path, "r", encoding="utf-8").read()
        except Exception:
            continue

        if marker in txt:
            continue

        if ("registerRootComponent" not in txt) and ("AppRegistry.registerComponent" not in txt):
            continue

        orig = txt
        txt = ensure_imports(txt)

        did = False

        m = rx_register.search(txt)
        if m:
            comp = m.group(1)

            # Build replacement
            wrapper = wrap_component_call(comp)
            replacement = wrapper + "registerRootComponent(TONTON_GestureRoot);\n"

            txt2 = rx_register.sub(replacement, txt, count=1)
            if txt2 != txt:
                txt = txt2
                did = True

        else:
            m2 = rx_appregistry.search(txt)
            if m2:
                appname_expr = m2.group(1).strip()
                comp = m2.group(2)

                wrapper = wrap_component_call(comp)
                replacement = (
                    wrapper +
                    f"AppRegistry.registerComponent({appname_expr}, () => TONTON_GestureRoot);\n"
                )
                txt2 = rx_appregistry.sub(replacement, txt, count=1)
                if txt2 != txt:
                    txt = txt2
                    did = True

        if did and txt != orig:
            rel = os.path.relpath(path, root)
            dst = os.path.join(bk, "files", rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(path, dst)
            open(path, "w", encoding="utf-8").write(txt)
            patched.append(rel)
            changed_count += 1

print("=== Summary ===")
print("Patched files:", changed_count)
for rel in patched:
    print(" -", rel)

if not patched:
    print("\n⚠️ Aucun fichier de registration trouvé/patche dans apps/{client,merchant,courier}.")
    print("   (Cas possible si expo-router/entry ou registration ailleurs.)")

print("\nRestore command (if needed):")
print(f"  cp -a '{bk}/files/.' '{root}/'")
PY

echo
echo "✅ Done. Backup saved in: $BK"
echo "➡️ Reload: dans tmux windows 5/6/7 -> touche 'r'"
