#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/gesture_root_all_$TS"
LOG="$BK/run.log"

mkdir -p "$BK/files"
exec > >(tee -a "$LOG") 2>&1

echo "=== TONTON FIX: Gesture root for ALL apps (client/merchant/courier) ==="
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

apps = ["client","merchant","courier"]
marker = "TONTON_SCROLL_HOTFIX: gesture root (gestureHandlerRootHOC)"

exts = {".js",".jsx",".ts",".tsx"}
skip_dirs = {"node_modules",".git",".expo",".tonton_backups","ios","android","dist","build","coverage","Pods","DerivedData"}

def should_skip_dir(d: str) -> bool:
    return d in skip_dirs or d.startswith(".")

def read(p: str) -> str:
    return open(p, "r", encoding="utf-8").read()

def write(p: str, txt: str):
    open(p, "w", encoding="utf-8").write(txt)

def backup(path: str):
    rel = os.path.relpath(path, root)
    dst = os.path.join(bk, "files", rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(path, dst)

def ensure_import_hoc(txt: str) -> str:
    if "gestureHandlerRootHOC" in txt:
        return txt
    # Insert after react-native-gesture-handler side-effect import if present, else after initial imports block.
    lines = txt.splitlines(True)
    insert_at = 0

    # Shebang
    if lines and lines[0].startswith("#!"):
        insert_at = 1

    # Find last consecutive import line at top
    i = insert_at
    last_import = insert_at
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("import "):
            last_import = i + 1
            i += 1
            continue
        # allow blank lines between imports
        if line.strip() == "":
            i += 1
            continue
        break

    insert_at = last_import
    inject = "import { gestureHandlerRootHOC } from 'react-native-gesture-handler';\n"
    return "".join(lines[:insert_at] + [inject] + lines[insert_at:])

rx_register = re.compile(r"registerRootComponent\s*\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)\s*;?", re.M)
rx_appreg = re.compile(
    r"AppRegistry\.registerComponent\s*\(\s*([^,]+)\s*,\s*\(\s*\)\s*=>\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)\s*;?",
    re.M,
)

def patch_registration_file(txt: str) -> str:
    if marker in txt:
        return txt
    out = txt

    # registerRootComponent(App) -> registerRootComponent(gestureHandlerRootHOC(App))
    if rx_register.search(out):
        out = ensure_import_hoc(out)
        out = rx_register.sub(r"registerRootComponent(gestureHandlerRootHOC(\1)); // " + marker, out, count=1)
        return out

    # AppRegistry.registerComponent(appName, () => App) -> ...(() => gestureHandlerRootHOC(App))
    if rx_appreg.search(out):
        out = ensure_import_hoc(out)
        out = rx_appreg.sub(r"AppRegistry.registerComponent(\1, () => gestureHandlerRootHOC(\2)); // " + marker, out, count=1)
        return out

    return txt

def patch_default_export_to_hoc(txt: str) -> str:
    if marker in txt:
        return txt
    if "gestureHandlerRootHOC(" in txt:
        return txt

    out = txt
    out = ensure_import_hoc(out)

    # 1) export default function Name(...) { ... }
    m = re.search(r"\bexport\s+default\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(", out)
    if m:
        name = m.group(1)
        out = re.sub(r"\bexport\s+default\s+function\s+" + re.escape(name) + r"\s*\(",
                     r"function " + name + "(", out, count=1)
        out = out.rstrip() + f"\n\n// {marker}\nexport default gestureHandlerRootHOC({name});\n"
        return out

    # 2) export default function(...) { ... } (no name)
    m = re.search(r"\bexport\s+default\s+function\s*\(", out)
    if m:
        name = "TONTON_DefaultExport"
        out = re.sub(r"\bexport\s+default\s+function\s*\(",
                     r"function " + name + "(", out, count=1)
        out = out.rstrip() + f"\n\n// {marker}\nexport default gestureHandlerRootHOC({name});\n"
        return out

    # 3) export default Identifier;
    m = re.search(r"\bexport\s+default\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*;\s*$", out, re.M)
    if m:
        name = m.group(1)
        out = re.sub(r"\bexport\s+default\s+" + re.escape(name) + r"\s*;\s*$",
                     f"export default gestureHandlerRootHOC({name}); // {marker}", out, flags=re.M)
        return out

    # 4) export default () => ...
    m = re.search(r"\bexport\s+default\s*\(\s*\)\s*=>", out)
    if m:
        name = "TONTON_DefaultExport"
        out = re.sub(r"\bexport\s+default\s*\(\s*\)\s*=>", f"const {name} = () =>", out, count=1)
        out = out.rstrip() + f"\n\n// {marker}\nexport default gestureHandlerRootHOC({name});\n"
        return out

    return txt

def find_first_existing(paths):
    for p in paths:
        if os.path.isfile(p):
            return p
    return None

def scan_router_entry(app_dir: str) -> bool:
    candidates = []
    # likely entrypoints
    for fn in ("index.js","index.ts","index.tsx","entry.js","entry.ts","entry.tsx","entry.sharedarraybuffer.js","entry.sharedarraybuffer.ts"):
        p = os.path.join(app_dir, fn)
        if os.path.isfile(p):
            candidates.append(p)
    # also any entry*.*
    for fn in os.listdir(app_dir):
        if fn.startswith("entry") and os.path.splitext(fn)[1].lower() in exts:
            candidates.append(os.path.join(app_dir, fn))
    for p in candidates:
        try:
            if "expo-router/entry" in read(p):
                return True
        except Exception:
            pass
    return False

def iter_code_files(app_dir: str):
    for dirpath, dirnames, filenames in os.walk(app_dir):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() in exts:
                yield os.path.join(dirpath, fn)

patched = []

for app in apps:
    app_dir = os.path.join(root, "apps", app)
    if not os.path.isdir(app_dir):
        print(f"⚠️ {app}: missing dir {app_dir}")
        continue

    uses_router = scan_router_entry(app_dir)

    print(f"\n== {app.upper()} == uses_router={uses_router}")

    target_files = []

    if uses_router:
        # expo-router: patch layout
        layout_candidates = [
            os.path.join(app_dir, "app", "_layout.tsx"),
            os.path.join(app_dir, "app", "_layout.js"),
            os.path.join(app_dir, "app", "_layout.jsx"),
            os.path.join(app_dir, "src", "app", "_layout.tsx"),
            os.path.join(app_dir, "src", "app", "_layout.js"),
            os.path.join(app_dir, "src", "app", "_layout.jsx"),
        ]
        lf = find_first_existing(layout_candidates)
        if lf:
            target_files.append(("layout", lf))
        else:
            print("⚠️ layout _layout.* introuvable (router) -> fallback App.*")
            # fallback App.*
            app_candidates = [
                os.path.join(app_dir, "App.tsx"),
                os.path.join(app_dir, "App.js"),
                os.path.join(app_dir, "src", "App.tsx"),
                os.path.join(app_dir, "src", "App.js"),
            ]
            af = find_first_existing(app_candidates)
            if af:
                target_files.append(("app", af))
    else:
        # non-router: patch registration (registerRootComponent/AppRegistry)
        reg = None
        for p in iter_code_files(app_dir):
            try:
                t = read(p)
            except Exception:
                continue
            if "registerRootComponent" in t or "AppRegistry.registerComponent" in t:
                reg = p
                break
        if reg:
            target_files.append(("registration", reg))
        else:
            # fallback App.*
            app_candidates = [
                os.path.join(app_dir, "App.tsx"),
                os.path.join(app_dir, "App.js"),
                os.path.join(app_dir, "src", "App.tsx"),
                os.path.join(app_dir, "src", "App.js"),
                os.path.join(app_dir, "index.js"),
                os.path.join(app_dir, "index.ts"),
                os.path.join(app_dir, "index.tsx"),
            ]
            af = find_first_existing(app_candidates)
            if af:
                target_files.append(("default_export", af))

    if not target_files:
        print("❌ Aucun fichier root détecté à patcher.")
        continue

    for kind, path in target_files:
        rel = os.path.relpath(path, root)
        try:
            txt = read(path)
        except Exception as e:
            print(f"❌ Cannot read {rel}: {e}")
            continue

        if marker in txt:
            print(f"✅ Already patched: {rel}")
            continue

        new = txt
        if kind == "registration":
            new = patch_registration_file(txt)
            if new == txt:
                # maybe this file doesn't match patterns; try default export patch
                new = patch_default_export_to_hoc(txt)
        else:
            new = patch_default_export_to_hoc(txt)

        if new != txt:
            backup(path)
            write(path, new)
            patched.append(rel)
            print(f"✅ Patched: {rel}")
        else:
            print(f"⚠️ No change: {rel} (pattern non reconnu / déjà OK)")

print("\n=== SUMMARY ===")
print("Patched files:", len(patched))
for p in patched:
    print(" -", p)

print("\nRestore command (if needed):")
print(f"  cp -a '{bk}/files/.' '{root}/'")
PY

echo
echo "✅ Done. Backup saved in: $BK"
echo "➡️ Reload apps (tmux 5/6/7): press 'r'"
