#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/backups/ui_polish_v3_${TS}"

TITLE="${BRAND_TITLE:-DelishAfrica}"
COLOR="${BRAND_COLOR:-#D4AF37}"     # or "gold" default
# Purple Holding example: #7B2EFF

mkdir -p "$BK"

python3 - <<PY
import re, shutil
from pathlib import Path

ROOT = Path("$ROOT")
BK   = Path("$BK")
TITLE = "$TITLE"
COLOR = "$COLOR"

def backup(p: Path):
    dst = BK / p.relative_to(ROOT)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dst)

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")

def write(p: Path, s: str):
    p.write_text(s, encoding="utf-8")

SCREEN_OPTS = f'''const SCREEN_OPTS = {{
  headerBackTitleVisible: false,
  headerTitle: "{TITLE}",
  headerTitleAlign: "center",
  headerTintColor: "{COLOR}",
  headerTitleStyle: {{
    fontWeight: "900",
    letterSpacing: 0.6,
    color: "{COLOR}",
    textShadowColor: "rgba(0,0,0,0.70)",
    textShadowOffset: {{ width: 0, height: 1 }},
    textShadowRadius: 2,
  }},
}};\n\n'''

def inject_screen_opts_const(txt: str) -> str:
    if "const SCREEN_OPTS" in txt:
        # refresh values (simple replace of the block)
        txt = re.sub(r"const SCREEN_OPTS\s*=\s*\{[\s\S]*?\};\s*",
                     SCREEN_OPTS.strip() + "\n\n", txt, count=1)
        return txt

    # insert after imports (or top of file)
    m = re.search(r"^(?:import[^\n]*\n)+", txt, flags=re.M)
    if m:
        return txt[:m.end()] + "\n" + SCREEN_OPTS + txt[m.end():]
    return SCREEN_OPTS + txt

def replace_screenOptions_expr(txt: str) -> str:
    # Replace any `screenOptions={...}` expression with `screenOptions={SCREEN_OPTS}`
    # in a simple JS brace scanner (handles nested objects + strings).
    out = []
    i = 0
    while True:
        j = txt.find("screenOptions=", i)
        if j == -1:
            out.append(txt[i:])
            break
        out.append(txt[i:j])
        k = j + len("screenOptions=")
        if k >= len(txt) or txt[k] != "{":
            # weird case, just keep
            out.append(txt[j:k])
            i = k
            continue

        # scan balanced braces
        depth = 0
        in_str = None
        esc = False
        end = None
        t = txt
        for idx in range(k, len(t)):
            ch = t[idx]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == in_str:
                    in_str = None
            else:
                if ch in ("'", '"'):
                    in_str = ch
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = idx + 1
                        break
        if end is None:
            # failed scan, keep original chunk
            out.append(txt[j:])
            break

        out.append("screenOptions={SCREEN_OPTS}")
        i = end
    return "".join(out)

def add_screenOptions_if_missing(txt: str) -> str:
    if "screenOptions=" in txt:
        return txt
    # add to first <Stack ...>
    return re.sub(r"<Stack(\s)",
                  r"<Stack screenOptions={SCREEN_OPTS}\1",
                  txt, count=1)

def patch_layout_file(p: Path) -> bool:
    orig = read(p)
    txt = orig

    # 1) ensure SCREEN_OPTS exists
    txt = inject_screen_opts_const(txt)

    # 2) enforce Stack uses it
    if "screenOptions=" in txt:
        txt = replace_screenOptions_expr(txt)
    else:
        txt = add_screenOptions_if_missing(txt)

    if txt != orig:
        backup(p)
        write(p, txt)
        return True
    return False

def patch_orders_demo(p: Path) -> bool:
    orig = read(p)
    txt = orig

    # Fix crash: o.orderId.replace(...) when undefined
    # and fix warning key unique.
    if "o.orderId.replace" in txt:
        txt = re.sub(
            r"const\s+niceId\s*=\s*o\.orderId\.replace\(([^)]*)\)\s*;",
            r'const rawId = o.orderId ?? o.id ?? o.order?.id ?? "";\n  const niceId = String(rawId).replace(\1);',
            txt,
            count=1
        )

    # If niceId already exists, still ensure rawId exists for key
    if "const rawId =" not in txt and "const niceId =" in txt:
        txt = txt.replace("const niceId =", 'const rawId = o.orderId ?? o.id ?? o.order?.id ?? "";\n  const niceId =')

    # key={o.orderId} -> key={String(rawId || idx)}
    # (works even if rawId injected above)
    txt = re.sub(r"key=\{o\.orderId\}", r"key={String((rawId || idx))}", txt)

    # If it still uses o.orderId elsewhere as key, harden:
    txt = re.sub(r"key=\{String\(o\.orderId\)\}", r"key={String((rawId || idx))}", txt)

    if txt != orig:
        backup(p)
        write(p, txt)
        return True
    return False

def patch_snow_overlay(p: Path) -> bool:
    orig = read(p)
    txt = orig

    # Target: duration: rand(a,b)  => duration: rand(a*1.7, b*1.7)
    def scale_rand(m):
        a = int(m.group(2))
        b = int(m.group(3))
        a2 = max(a+1, int(a*1.7))
        b2 = max(b+1, int(b*1.7))
        return f"{m.group(1)}{a2}{m.group(4)}{b2}{m.group(5)}"

    txt2 = re.sub(r"(duration\s*:\s*rand\()(\d+)(\s*,\s*)(\d+)(\))", scale_rand, txt)
    txt = txt2

    # If no rand(), try simple numeric duration: 180 -> 320 (only small durations)
    def scale_num(m):
        n = int(m.group(1))
        if n < 260:  # typical snow durations
            return f"duration: {max(n+1, int(n*1.7))}"
        return m.group(0)

    txt = re.sub(r"duration\s*:\s*(\d+)", lambda m: scale_num(m), txt)

    if txt != orig:
        backup(p)
        write(p, txt)
        return True
    return False

patched = []

# 1) Patch ALL layouts under app/**/_layout.tsx (root + nested)
for app in ("client", "courier", "merchant"):
    base = ROOT / "apps" / app
    for p in base.glob("app/**/_layout.tsx"):
        if patch_layout_file(p):
            patched.append(str(p))

# 2) Patch orders-demo.tsx (Merchant/Client/Courier) if exists
for app in ("client", "courier", "merchant"):
    p = ROOT / "apps" / app / "app" / "orders-demo.tsx"
    if p.exists():
        if patch_orders_demo(p):
            patched.append(str(p))

# 3) Flocons plus longs: any SnowOverlay.tsx under apps/*
for p in ROOT.glob("apps/*/src/**/SnowOverlay.tsx"):
    if patch_snow_overlay(p):
        patched.append(str(p))

print("PATCHED:")
for p in patched:
    print(" -", p)
print("Backup:", BK)
PY

echo
echo "✅ Patch UI polish v3 appliqué."
echo "📦 Backup: $BK"
echo "➡️ Relance Expo (ton script clean) puis re-scan les QR:"
echo "   bash /opt/delishafrica/monorepo/scripts/da_restart_expo_3apps.sh"
