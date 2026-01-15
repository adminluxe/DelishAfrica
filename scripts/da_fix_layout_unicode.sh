#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
BK="$ROOT/backups/layout_unicode_fix_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK"

for app in client courier merchant; do
  f="$ROOT/apps/$app/app/_layout.tsx"
  if [[ -f "$f" ]]; then
    mkdir -p "$BK/apps/$app/app"
    cp -f "$f" "$BK/apps/$app/app/_layout.tsx"

    python3 - "$f" <<'PY'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1])
s = p.read_text(encoding="utf-8", errors="replace")

# 1) Enlève les séquences illégales en TSX : \' et \"
s2 = s.replace("\\'", "'").replace('\\"', '"')

# 2) Normalise title/headerTitle vers des doubles quotes (ultra safe en TSX)
def norm_prop(txt, prop):
    # prop: title/headerTitle
    pat = rf'({prop}\s*:\s*)(?:\'([^\']*)\'|"([^"]*)"|\\\\\'([^\']*)\\\\\')'
    def repl(m):
        val = m.group(2) or m.group(3) or m.group(4) or ""
        return m.group(1) + '"' + val.replace('"','\\"') + '"'
    return re.sub(pat, repl, txt)

for prop in ["title", "headerTitle"]:
    s2 = norm_prop(s2, prop)

# 3) Supprime les doublons consécutifs de <Stack.Screen .../>
lines = s2.splitlines()
out, prev = [], None
for ln in lines:
    k = ln.strip()
    if prev is not None and k and k == prev and "<Stack.Screen" in k:
        continue
    out.append(ln)
    prev = k
s2 = "\n".join(out) + ("\n" if not s2.endswith("\n") else "")

if s2 != s:
    p.write_text(s2, encoding="utf-8")
    print("PATCHED", p)
else:
    print("NOCHANGE", p)
PY

  fi
done

echo "✅ Backup: $BK"
echo "✅ Fix layout unicode/quotes terminé."
