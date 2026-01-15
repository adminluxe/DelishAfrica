#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/opt/delishafrica/monorepo}"
APPS="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/fix_list_imports_${TS}"
LOG="$BACKUP/patch.log"
mkdir -p "$BACKUP"

echo "[DA] ROOT   : $ROOT" | tee -a "$LOG"
echo "[DA] BACKUP : $BACKUP" | tee -a "$LOG"
echo "" | tee -a "$LOG"

python3 - <<'PY' "$APPS" "$BACKUP" "$LOG"
import os, re, sys, shutil

apps, backup, log = sys.argv[1], sys.argv[2], sys.argv[3]
targets = {"ScrollView","FlatList","SectionList"}

# match: import { A, B } from 'react-native-gesture-handler';
IMP_RE = re.compile(r"^(\s*import\s*{\s*)([^}]+)(\s*}\s*from\s*['\"]react-native-gesture-handler['\"]\s*;\s*)$", re.M)

def backup_file(path):
    rel = path.lstrip(os.sep)
    dst = os.path.join(backup, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(path, dst)

def already_imports_from_react_native(code, name):
    # naive but effective: import { ...name... } from 'react-native';
    rn_imp = re.search(rf"import\s*{{[^}}]*\b{name}\b[^}}]*}}\s*from\s*['\"]react-native['\"]", code)
    return bool(rn_imp)

patched = 0
scanned = 0

for root, dirs, files in os.walk(apps):
    # skip junk
    dirs[:] = [d for d in dirs if d not in ("node_modules",".git",".expo",".expo-shared",".tonton_backups",".backups",".backup","dist","build")]
    for fn in files:
        if not fn.endswith((".ts",".tsx",".js",".jsx")):
            continue
        path = os.path.join(root, fn)
        scanned += 1
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()

        m = IMP_RE.search(code)
        if not m:
            continue

        spec = m.group(2)
        names = [x.strip() for x in spec.split(",") if x.strip()]
        move = [n for n in names if n in targets]
        keep = [n for n in names if n not in targets]

        if not move:
            continue

        new_code = code

        # backup once
        backup_file(path)

        # rewrite the gesture-handler import
        if keep:
            new_imp = f"{m.group(1)}{', '.join(keep)}{m.group(3)}"
        else:
            # only list components were imported -> swap module to react-native
            new_imp = f"{m.group(1)}{', '.join(move)}" + m.group(3).replace("react-native-gesture-handler","react-native")
            move = []  # already moved by swap

        new_code = IMP_RE.sub(new_imp, new_code, count=1)

        # add react-native import for moved names (if any remain to be moved)
        add = [n for n in move if not already_imports_from_react_native(new_code, n)]
        if add:
            # insert after first import line if possible, else at top
            insert_line = f"import {{ {', '.join(add)} }} from 'react-native';\n"
            if re.search(r"^\s*import\s", new_code, re.M):
                new_code = re.sub(r"^(\s*import[^\n]*\n)", r"\1"+insert_line, new_code, count=1, flags=re.M)
            else:
                new_code = insert_line + new_code

        with open(path, "w", encoding="utf-8") as f:
            f.write(new_code)

        patched += 1
        with open(log, "a", encoding="utf-8") as lf:
            lf.write(f"[PATCHED] {path}\n")

print(f"[DA] scanned={scanned} patched={patched}")
print(f"[DA] backup={backup}")
PY

echo ""
echo "[DA] Rollback (si besoin) :"
echo "  rsync -a \"$BACKUP/opt/delishafrica/monorepo/\" \"/opt/delishafrica/monorepo/\""
