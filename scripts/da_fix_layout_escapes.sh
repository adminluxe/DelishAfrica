#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/layout_escapes_fix_$TS"

mkdir -p "$BK"
echo "📦 Backup => $BK"

python3 - <<'PY'
from pathlib import Path
import re, shutil

ROOT = Path("/opt/delishafrica/monorepo")
BK   = Path(str(ROOT / "backups")).glob("layout_escapes_fix_*")  # unused, just for clarity

targets = [
  ROOT / "apps/client/app/_layout.tsx",
  ROOT / "apps/courier/app/_layout.tsx",
  ROOT / "apps/merchant/app/_layout.tsx",
]

backup_dir = ROOT / "backups" / f"layout_escapes_fix_{__import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')}"
for p in targets:
  if not p.exists():
    continue
  dest = backup_dir / "apps" / p.parts[-3] / "app" / "_layout.tsx"  # apps/<app>/app/_layout.tsx
  dest.parent.mkdir(parents=True, exist_ok=True)
  shutil.copy2(p, dest)

  s = p.read_text(encoding="utf-8", errors="replace")
  s2 = s

  # 1) JSX attr : name=\"index\"  -> name="index"
  s2 = re.sub(r'name=\\"([^"]+)\\"', r'name="\1"', s2)

  # 2) Object literal : title: \'DelishAfrica\' -> title: 'DelishAfrica'
  s2 = re.sub(r"title\s*:\s*\\'([^']*)\\'", r"title: '\1'", s2)

  # 3) Par sécurité : headerTitle: \"DelishAfrica\" -> headerTitle: "DelishAfrica"
  s2 = re.sub(r'headerTitle\s*:\s*\\"([^"]*)\\"', r'headerTitle: "\1"', s2)

  if s2 != s:
    p.write_text(s2, encoding="utf-8")
    print("PATCHED", p)
  else:
    print("NOCHANGE", p)

print("BACKUP_DIR", backup_dir)
PY

echo "✅ Fix terminé. Tu peux relancer expo."
