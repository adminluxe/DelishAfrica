#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backups/ui_headers_keys_$TS"
mkdir -p "$BK"
echo "Backup dir: $BK"

apps=(client courier merchant)

patch_layout () {
  local app="$1"
  local f="$ROOT/apps/$app/app/_layout.tsx"
  [ -f "$f" ] || { echo "skip (no layout): $f"; return 0; }

  cp "$f" "$BK/${app}__layout.tsx.bak"

  python3 - "$f" "$app" <<'PY'
import re, sys
from pathlib import Path

f = Path(sys.argv[1])
app = sys.argv[2]
s = f.read_text(encoding="utf-8", errors="replace")

# 1) Inject screenOptions (headerBackTitleVisible + headerTitle) on <Stack ...>
if "headerBackTitleVisible" not in s or 'headerTitle: "DelishAfrica"' not in s:
    # Case A: Stack has screenOptions={{ ... }}
    m = re.search(r"<Stack\b[^>]*\bscreenOptions=\{\{(.*?)\}\}[^>]*>", s, flags=re.S)
    if m:
        inner = m.group(1)
        def ensure(inner, needle, add):
            return inner if needle in inner else (add + "\n" + inner)
        inner2 = inner
        inner2 = ensure(inner2, "headerBackTitleVisible", "headerBackTitleVisible: false,")
        inner2 = ensure(inner2, 'headerTitle: "DelishAfrica"', 'headerTitle: "DelishAfrica",')
        if inner2 != inner:
            s = s[:m.start(1)] + inner2 + s[m.end(1):]
    else:
        # Case B: Stack has no screenOptions -> add it
        m2 = re.search(r"<Stack\b([^>]*)>", s)
        if m2 and "/>" not in m2.group(0):
            attrs = m2.group(1)
            if "screenOptions=" not in attrs:
                injected = f'<Stack{attrs} screenOptions={{ {{ headerBackTitleVisible: false, headerTitle: "DelishAfrica" }} }}>'
                s = s[:m2.start()] + injected + s[m2.end():]

# 2) Add per-screen titles (hide "index", "orders-demo" etc.) if Stack is not self-closing
title_orders = {"client":"Commande", "merchant":"Commandes", "courier":"Missions"}.get(app, "DelishAfrica")
title_index  = "DelishAfrica"

# Insert right after the first "<Stack ...>" opening tag end (">") if not already there
if "<Stack.Screen" in s:
    # already has some screens; we'll just ensure our specific ones exist
    pass

def has_screen(name: str) -> bool:
    return re.search(rf'<Stack\.Screen\s+name=["\']{re.escape(name)}["\']', s) is not None

# Find first opening Stack tag boundary
m3 = re.search(r"(<Stack\b[^>]*>)", s)
if m3 and "/>" not in m3.group(1):
    insert_lines = []
    if not has_screen("index"):
        insert_lines.append(f'      <Stack.Screen name="index" options={{ {{ title: "{title_index}" }} }} />')
    if not has_screen("orders-demo"):
        insert_lines.append(f'      <Stack.Screen name="orders-demo" options={{ {{ title: "{title_orders}" }} }} />')

    if insert_lines:
        ins = "\n" + "\n".join(insert_lines) + "\n"
        s = s[:m3.end()] + ins + s[m3.end():]

f.write_text(s, encoding="utf-8")
print(f"patched layout: {f}")
PY
}

patch_orders_demo () {
  local app="$1"
  local f="$ROOT/apps/$app/app/orders-demo.tsx"
  [ -f "$f" ] || { echo "skip (no orders-demo): $f"; return 0; }

  cp "$f" "$BK/${app}__orders-demo.tsx.bak"

  python3 - "$f" <<'PY'
import re, sys
from pathlib import Path

f = Path(sys.argv[1])
s = f.read_text(encoding="utf-8", errors="replace")
orig = s

# Fix: key warning/crash when o.orderId is undefined
# - replaces key={o.orderId} -> key={String(o.orderId ?? o.id ?? idx)}
s = re.sub(r'key=\{o\.orderId\}', r'key={String(o.orderId ?? (o as any).id ?? idx)}', s)

# Fix: niceId generation safety (avoid .replace on undefined)
# - replaces: const niceId = o.orderId.replace(...)
# - into:     const niceId = String(o.orderId ?? (o as any).id ?? "").replace(...)
s = re.sub(
    r'const\s+niceId\s*=\s*o\.orderId\.replace\(',
    'const niceId = String(o.orderId ?? (o as any).id ?? "").replace(',
    s
)

# Optional: if someone used o.orderId.replace(...) inline
s = re.sub(r'o\.orderId\.replace\(', r'String(o.orderId ?? (o as any).id ?? "").replace(', s)

if s != orig:
    f.write_text(s, encoding="utf-8")
    print(f"patched orders-demo: {f}")
else:
    print(f"no-change orders-demo: {f}")
PY
}

for a in "${apps[@]}"; do
  patch_layout "$a"
  patch_orders_demo "$a"
done

echo "✅ Done. Backups in: $BK"
