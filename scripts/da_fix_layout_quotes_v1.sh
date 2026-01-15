#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TITLE="${BRAND_TITLE:-DelishAfrica}"

for app in client courier merchant; do
  f="$ROOT/apps/$app/app/_layout.tsx"
  [ -f "$f" ] || continue

  python3 - <<'PY' "$f" "$TITLE"
import sys,re
p=sys.argv[1]; title=sys.argv[2]
s=open(p,'r',encoding='utf-8',errors='replace').read()

# 1) Corrige le poison principal: \'  -> '
s2 = s.replace("\\'", "'")

# 2) Si un headerTitle vide traîne, on force un titre sain (double quotes)
s2 = re.sub(r'headerTitle\s*:\s*\'\'\s*,', f'headerTitle: "{title}",', s2)
s2 = re.sub(r'headerTitle\s*:\s*""\s*,', f'headerTitle: "{title}",', s2)

# 3) Normalise les options title dans les Stack.Screen
# options={{ title: 'X' }} => options={{ title: "X" }}
s2 = re.sub(r'options=\{\{\s*title:\s*\'([^\']*)\'\s*\}\}', r'options={{ title: "\1" }}', s2)

# 4) Dédoublonne les lignes Stack.Screen identiques collées 2x
lines=s2.splitlines()
out=[]
for line in lines:
    if out and out[-1].strip()==line.strip() and "Stack.Screen" in line:
        continue
    out.append(line)
s2="\n".join(out) + "\n"

if s2 != s:
  open(p,'w',encoding='utf-8').write(s2)
  print("PATCHED", p)
else:
  print("NOCHANGE", p)
PY
done
