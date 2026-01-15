#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backups/ui_orders_demo_ids_$TS"
mkdir -p "$BK"

backup() {
  local f="$1"
  [ -f "$f" ] || return 0
  cp -a "$f" "$BK/$(echo "$f" | sed 's#/#__#g')"
}

patch_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  backup "$f"

  python3 - <<'PY'
import re
from pathlib import Path

f = Path(r"""'"$f"'""")
s = f.read_text(encoding="utf-8", errors="replace")
orig = s

# 1) map((o) => ...) -> map((o, idx) => ...) (une seule fois)
s = re.sub(r'orders\.map\(\(\s*o\s*\)\s*=>\s*\{', 'orders.map((o, idx) => {', s, count=1)

# 2) Remplacer const niceId = o.orderId.replace(...) par une version safe + rawId
# (on supporte orderId / id / order.id)
s = re.sub(
  r'const\s+niceId\s*=\s*o\.orderId\.replace\(([^;]+)\);\s*',
  r'const rawId = (o.orderId ?? o.id ?? o.order?.id ?? "");\n      const niceId = String(rawId).replace(\1);\n',
  s,
  count=1
)

# 3) key={o.orderId} -> key={String(rawId || idx)} (évite warning key + crash)
s = s.replace("key={o.orderId}", "key={String(rawId || idx)}")

# 4) IMPORTANT : on envoie rawId à l’API (niceId = affichage uniquement)
s = s.replace("orderId: niceId", "orderId: rawId")

if s != orig:
    f.write_text(s, encoding="utf-8")
    print(f"patched: {f}")
else:
    print(f"no-change: {f}")
PY
}

# On patch les 3 apps si le fichier existe
for app in client courier merchant; do
  patch_file "$ROOT/apps/$app/app/orders-demo.tsx"
done

echo "✅ Backup: $BK"
echo "✅ Hotfix terminé (orders-demo.tsx). Relance Expo ensuite."
