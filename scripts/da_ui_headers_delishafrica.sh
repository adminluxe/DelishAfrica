#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backups/ui_headers_${TS}"
mkdir -p "$BK"

python3 - <<PY
import shutil, re, glob, os
ROOT="${ROOT}"
BK="${BK}"

apps = ["client","courier","merchant"]
files = []
for a in apps:
    files += glob.glob(f"{ROOT}/apps/{a}/app/**/_layout.tsx", recursive=True)

patched = []
skipped = []

def patch_file(path: str):
    s0 = open(path, "r", encoding="utf-8", errors="replace").read()

    # Ne patch pas si déjà présent
    if "headerTitle" in s0 and "headerBackTitleVisible" in s0:
        skipped.append((path, "déjà patché"))
        return

    # Cherche screenOptions={{ ... }}
    m = re.search(r"(screenOptions=\{\{)(.*?)(\}\})", s0, flags=re.DOTALL)
    if not m:
        skipped.append((path, "pas de screenOptions={{...}} trouvé"))
        return

    inner = m.group(2)

    # Construit les champs à injecter si manquants
    inject = ""
    if "headerBackTitleVisible" not in inner:
        inject += "\n    headerBackTitleVisible: false,"
    if "headerTitle" not in inner:
        inject += "\n    headerTitle: 'DelishAfrica',"

    if not inject.strip():
        skipped.append((path, "rien à injecter"))
        return

    # Backup
    rel = path.replace(ROOT + "/", "")
    os.makedirs(os.path.join(BK, os.path.dirname(rel)), exist_ok=True)
    shutil.copy2(path, os.path.join(BK, rel))

    # Injection juste après "screenOptions={{"
    new_inner = inject + inner
    s1 = s0[:m.start(2)] + new_inner + s0[m.end(2):]

    open(path, "w", encoding="utf-8").write(s1)
    patched.append(path)

for f in sorted(set(files)):
    patch_file(f)

print("BACKUP_DIR=", BK)
print("PATCHED_COUNT=", len(patched))
for p in patched:
    print("PATCHED:", p)
print("SKIPPED_COUNT=", len(skipped))
for p, why in skipped[:40]:
    print("SKIPPED:", p, "=>", why)
if len(skipped) > 40:
    print(f"... +{len(skipped)-40} skipped")
PY
