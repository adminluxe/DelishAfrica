#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
APPS="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/.tonton_backups/fix_rngh_root_SAFE_${TS}"
LOG="$BACKUP/patch.log"
mkdir -p "$BACKUP"

backup_file() {
  local f="$1"
  local rel="${f#/}"
  local dst="$BACKUP/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

python3 - <<'PY' "$APPS" "$BACKUP" "$LOG"
import os, re, sys, shutil

apps, backup, log = sys.argv[1], sys.argv[2], sys.argv[3]

def backup_file(path):
    rel = path.lstrip(os.sep)
    dst = os.path.join(backup, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(path, dst)

def add_import(code: str) -> str:
    if "GestureHandlerRootView" in code:
        return code
    imp = "import { GestureHandlerRootView } from 'react-native-gesture-handler';\n"
    # insert after first import line if exists else at top
    m = re.search(r"^import[^\n]*\n", code, re.M)
    if m:
        return code[:m.end()] + imp + code[m.end():]
    return imp + code

def wrap_return(code: str) -> str:
    if "GestureHandlerRootView" in code:
        return code

    # find a return statement (first one)
    m = re.search(r"\breturn\b", code)
    if not m:
        return code

    i = m.end()
    # skip whitespace
    while i < len(code) and code[i].isspace():
        i += 1

    # Determine expression type
    if i >= len(code):
        return code

    # Case A: return ( ... );
    if code[i] == '(':
        start = i
        depth = 0
        j = i
        in_str = None
        esc = False
        while j < len(code):
            ch = code[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == in_str:
                    in_str = None
            else:
                if ch in ("'", '"', "`"):
                    in_str = ch
                elif ch == '(':
                    depth += 1
                elif ch == ')':
                    depth -= 1
                    if depth == 0:
                        end = j
                        break
            j += 1
        else:
            return code  # unbalanced

        inner = code[start+1:end].strip()
        wrapped = f"(\n    <GestureHandlerRootView style={{ flex: 1 }}>\n{inner}\n    </GestureHandlerRootView>\n  )"
        return code[:start] + wrapped + code[end+1:]

    # Case B: return <JSX ... />;
    if code[i] == '<':
        # find the semicolon ending the statement
        semi = code.find(';', i)
        if semi == -1:
            return code
        expr = code[i:semi].strip()
        wrapped = "(\n    <GestureHandlerRootView style={{ flex: 1 }}>\n      " + expr + "\n    </GestureHandlerRootView>\n  )"
        return code[:i] + wrapped + code[semi:]

    return code

patched = 0
for root, dirs, files in os.walk(apps):
    dirs[:] = [d for d in dirs if d not in ("node_modules",".git",".expo",".expo-shared",".tonton_backups",".backups",".backup","dist","build")]
    for fn in files:
        if fn != "_layout.tsx":
            continue
        path = os.path.join(root, fn)
        # IMPORTANT: patch only app/_layout.tsx (not app/(tabs)/_layout.tsx)
        if not re.search(r"/app/_layout\.tsx$", path):
            continue

        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            code = f.read()

        new = add_import(code)
        new2 = wrap_return(new)

        if new2 != code:
            backup_file(path)
            with open(path, "w", encoding="utf-8") as f:
                f.write(new2)
            patched += 1
            with open(log, "a", encoding="utf-8") as lf:
                lf.write(f"[PATCHED] {path}\n")

print(f"[DA] patched={patched}")
print(f"[DA] backup={backup}")
PY

echo "[DA] Done. Backup: $BACKUP"
echo "[DA] Rollback:"
echo "  rsync -a \"$BACKUP/opt/delishafrica/monorepo/\" \"/opt/delishafrica/monorepo/\""
