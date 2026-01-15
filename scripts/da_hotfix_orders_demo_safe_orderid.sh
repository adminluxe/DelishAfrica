#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backups/ui_safe_orderid_$TS"
mkdir -p "$BK"

FILES=(
  "$ROOT/apps/merchant/app/orders-demo.tsx"
  "$ROOT/apps/courier/app/orders-demo.tsx"
  "$ROOT/apps/client/app/orders-demo.tsx"
)

patched=0

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  cp -a "$f" "$BK/$(echo "$f" | sed 's#/#_#g').bak"

  python3 - <<PY
from pathlib import Path
p = Path("$f")
s = p.read_text(encoding="utf-8", errors="replace")
orig = s

needle = "o.orderId.replace("
if needle in s:
    s = s.replace(
        needle,
        'String((o as any)?.orderId ?? (o as any)?.id ?? (o as any)?.order?.id ?? "").replace('
    )

if s != orig:
    p.write_text(s, encoding="utf-8")
    print("PATCHED")
else:
    print("SKIP")
PY
  if [ "$(tail -n 1 <<<"$(python3 - <<'PY'
print("OK")
PY
)")" = "OK" ]; then :; fi

  # re-run a quick check by grep
  if grep -q 'String((o as any)?.orderId' "$f" 2>/dev/null; then
    echo "✅ patched: $f"
    patched=$((patched+1))
  else
    echo "… no patch needed: $f"
  fi
done

echo "Backup dir: $BK"
echo "Patched files: $patched"
