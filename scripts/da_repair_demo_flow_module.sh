#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
SERV="$ROOT/services"
ts="$(date +%Y%m%d_%H%M%S)"

# 1) Trouver le orders.module.ts exact qui contient la référence en erreur
MOD="$(rg -n "OrdersDemoFlowApiController" "$SERV" -S --files-with-matches | head -n 1 || true)"
if [[ -z "${MOD:-}" ]]; then
  echo "❌ Je ne trouve pas OrdersDemoFlowApiController dans services/"
  echo "   Lance: rg -n \"OrdersDemoFlow\" $SERV -S"
  exit 1
fi

DIR="$(dirname "$MOD")"
CTRL="$DIR/orders.demo.flow.controller.ts"

echo "✅ OrdersModule: $MOD"
echo "✅ Dir       : $DIR"
echo "✅ Controller: $CTRL"

test -f "$CTRL" || { echo "❌ Missing controller: $CTRL"; exit 1; }

cp -a "$MOD" "$MOD.bak.$ts"

python3 - <<PY
import re, pathlib

mod = pathlib.Path("$MOD")
ctrl = pathlib.Path("$CTRL")

ms = mod.read_text(encoding="utf-8")
cs = ctrl.read_text(encoding="utf-8")

# classes exported in controller
exports = re.findall(r"export\\s+class\\s+(\\w+)", cs)
need = [c for c in exports if c.startswith("OrdersDemoFlow")]
if not need:
    raise SystemExit(f"No OrdersDemoFlow* exports found in {ctrl}")

# ensure import exists and matches exactly the exports we need
import_line = f'import {{ {", ".join(need)} }} from "./orders.demo.flow.controller";\\n'

if "orders.demo.flow.controller" in ms:
    ms = re.sub(
        r'import\\s*\\{[^}]*\\}\\s*from\\s*["\\\']\\./orders\\.demo\\.flow\\.controller["\\\'];\\s*\\n',
        import_line,
        ms,
        flags=re.M,
    )
else:
    imports = list(re.finditer(r"^import .*?;\\s*$", ms, flags=re.M))
    if not imports:
        raise SystemExit("No import section found to inject controller import.")
    i = imports[-1].end()
    ms = ms[:i] + "\\n" + import_line + ms[i:]

# patch controllers array: keep existing + ensure need classes are present
m = re.search(r"(controllers\\s*:\\s*\\[)([\\s\\S]*?)(\\])", ms)
if not m:
    raise SystemExit("Could not find controllers: [...] in OrdersModule")

before, inside, after = m.group(1), m.group(2), m.group(3)

# normalize inside list
inside_clean = inside.strip()
# build set of existing identifiers
existing = [x.strip() for x in re.split(r",", inside_clean) if x.strip()]
existing_set = set(existing)

for n in need:
    if n not in existing_set:
        existing.append(n)

new_inside = ", ".join(existing) if existing else ", ".join(need)

ms = ms[:m.start()] + before + new_inside + after + ms[m.end():]

mod.write_text(ms, encoding="utf-8")

print("✅ Exported flow controllers:", need)
print("✅ Patched:", mod)
PY

echo
echo "✅ Réparé. Le watch doit recompiler tout seul. Sinon restart api-rest."
