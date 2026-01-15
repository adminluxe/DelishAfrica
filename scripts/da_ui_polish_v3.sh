#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-/opt/delishafrica/monorepo}"
BRAND_TITLE="${BRAND_TITLE:-DelishAfrica}"
BRAND_COLOR="${BRAND_COLOR:-#D4AF37}"   # or par défaut (gold)
BK="$ROOT/backups/ui_polish_v3_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BK"

export ROOT BK BRAND_TITLE BRAND_COLOR

python3 - <<'PY'
import os, re, shutil
from pathlib import Path

ROOT = Path(os.environ["ROOT"])
BK = Path(os.environ["BK"])
TITLE = os.environ["BRAND_TITLE"]
COLOR = os.environ["BRAND_COLOR"]

apps = ["client", "courier", "merchant"]
patched = []

def backup(p: Path):
    dest = BK / p.relative_to(ROOT)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)

def write_if_changed(p: Path, new_text: str) -> bool:
    old = p.read_text(encoding="utf-8", errors="replace")
    if old == new_text:
        return False
    backup(p)
    p.write_text(new_text, encoding="utf-8")
    return True

def ensure_prop(body: str, key: str, value_js: str) -> str:
    val = value_js.rstrip().rstrip(",")
    if re.search(rf'(^|\n)\s*{re.escape(key)}\s*:', body):
        body = re.sub(
            rf'(^|\n)(\s*){re.escape(key)}\s*:\s*.*?(,)?(\n)',
            lambda m: f"{m.group(1)}{m.group(2)}{key}: {val},\n",
            body, count=1, flags=re.S
        )
    else:
        if not body.endswith("\n"):
            body += "\n"
        body += f"    {key}: {val},\n"
    return body

def patch_layout_file(p: Path) -> bool:
    txt = p.read_text(encoding="utf-8", errors="replace")

    # contentStyle: garde DA.bg si présent (sinon on n’injecte rien)
    bg_expr = "DA.bg" if re.search(r"\bDA\.bg\b", txt) else None

    m = re.search(r"screenOptions\s*=\s*\{\{([\s\S]*?)\}\}", txt)
    if m:
        body = m.group(1)
        body = ensure_prop(body, "headerBackTitleVisible", "false")
        body = ensure_prop(body, "headerTitle", repr(TITLE))
        body = ensure_prop(body, "headerTitleAlign", repr("center"))
        body = ensure_prop(body, "headerTintColor", repr(COLOR))
        body = ensure_prop(body, "headerTitleStyle", f"{{ fontWeight: '900', letterSpacing: 0.6, color: {repr(COLOR)} }}")
        if bg_expr:
            body = ensure_prop(body, "contentStyle", f"{{ backgroundColor: {bg_expr} }}")

        new_txt = txt[:m.start(1)] + body + txt[m.end(1):]
        return write_if_changed(p, new_txt)

    # Fallback: injecte screenOptions sur le premier <Stack ...>
    sm = re.search(r"<Stack(\s[^>]*)?>", txt)
    if not sm:
        return False

    opts = [
        "screenOptions={{",
        "    headerBackTitleVisible: false,",
        f"    headerTitle: {repr(TITLE)},",
        '    headerTitleAlign: "center",',
        f"    headerTintColor: {repr(COLOR)},",
        f"    headerTitleStyle: {{ fontWeight: '900', letterSpacing: 0.6, color: {repr(COLOR)} }},",
    ]
    if bg_expr:
        opts.append(f"    contentStyle: {{ backgroundColor: {bg_expr} }},")
    opts.append("  }}")

    insert = "<Stack " + "\n  ".join(opts) + ">"
    new_txt = txt[:sm.start()] + insert + txt[sm.end():]
    return write_if_changed(p, new_txt)

def patch_orders_demo(root_app: Path) -> None:
    # Fix key warning + safety id usage (merchant & courier surtout)
    for p in root_app.rglob("orders-demo.tsx"):
        if any(x in p.parts for x in ("node_modules", ".expo", "dist", "build")):
            continue
        t = p.read_text(encoding="utf-8", errors="replace")
        original = t

        # 1) safe replace on id
        t = re.sub(r"(\b[oO]\.\s*orderId\s*)\.replace\(", r"String(\1 ?? o?.id ?? '').replace(", t)

        # 2) map(o => ...) -> map((o, idx) => ...) si on voit key={o.orderId} ou key={o.id}
        if "key={o.orderId}" in t or "key={o.id}" in t:
            t = re.sub(r"\.map\(\s*\(\s*o\s*\)\s*=>", ".map((o, idx) =>", t)

        # 3) key unique
        t = t.replace("key={o.orderId}", "key={String(o?.orderId ?? o?.id ?? idx)}")
        t = t.replace("key={o.id}", "key={String(o?.id ?? o?.orderId ?? idx)}")

        if t != original:
            write_if_changed(p, t)

def patch_route_pills(root_app: Path) -> None:
    # Cache les “pills” custom quand label == index / orders-demo
    for p in root_app.rglob("*.tsx"):
        if any(x in p.parts for x in ("node_modules", ".expo", "dist", "build")):
            continue
        t = p.read_text(encoding="utf-8", errors="replace")

        if "_daLabel" in t:
            continue

        if ("segments" in t or "useSegments" in t) and ("index" in t) and ("Pill" in t or "Badge" in t):
            nt = t

            # cas: const seg = segments?.[segments.length - 1] ?? ""
            if re.search(r"const\s+seg\s*=\s*segments", nt):
                nt = re.sub(
                    r"(const\s+seg\s*=\s*segments[^\n]*\n)",
                    r'\1const _daLabel = (seg === "index" || seg === "orders-demo") ? "" : seg;\n',
                    nt, count=1
                )
                nt = re.sub(
                    r"<(\w*Pill\w*)[^>]*>\s*\{\s*seg\s*\}\s*</\1>",
                    r"{_daLabel ? <\1>{_daLabel}</\1> : null}",
                    nt, count=1
                )

            # cas: const label = ...
            elif re.search(r"const\s+label\s*=", nt):
                nt = re.sub(
                    r"(const\s+label\s*=\s*[^\n;]+;?)\n",
                    r'\1\nconst _daLabel = (label === "index" || label === "orders-demo") ? "" : label;\n',
                    nt, count=1
                )
                nt = re.sub(
                    r"<(\w*Pill\w*)[^>]*>\s*\{\s*label\s*\}\s*</\1>",
                    r"{_daLabel ? <\1>{_daLabel}</\1> : null}",
                    nt, count=1
                )

            if nt != t:
                write_if_changed(p, nt)

def patch_snow_overlay(root_client: Path) -> None:
    # Allonge les durées de flocons (sans augmenter la densité)
    for p in root_client.rglob("*Snow*Overlay*.tsx"):
        if any(x in p.parts for x in ("node_modules", ".expo", "dist", "build")):
            continue
        t = p.read_text(encoding="utf-8", errors="replace")
        if "flake" not in t.lower() and "snow" not in t.lower():
            continue

        original = t
        # duration: 200  =>  duration: 320 (x1.6) uniquement si la ligne contient "duration:"
        def bump_duration(m):
            v = int(m.group(1))
            return f"duration: {int(v*1.6)}"

        t = re.sub(r"duration\s*:\s*(\d+)", lambda m: bump_duration(m), t)

        # randomInt(180, 220) => randomInt(288, 352) quand utilisé pour duration/delay (approx)
        def bump_rand(m):
            a, b = int(m.group(1)), int(m.group(2))
            return f"randomInt({int(a*1.6)}, {int(b*1.6)})"
        t = re.sub(r"randomInt\(\s*(\d+)\s*,\s*(\d+)\s*\)", lambda m: bump_rand(m), t)

        if t != original:
            write_if_changed(p, t)

# ---- run ----
for app in apps:
    layout = ROOT / "apps" / app / "app" / "_layout.tsx"
    if layout.exists() and patch_layout_file(layout):
        patched.append(str(layout))

    root_app = ROOT / "apps" / app
    if root_app.exists():
        patch_orders_demo(root_app)
        patch_route_pills(root_app)

# flocons: principalement client
patch_snow_overlay(ROOT / "apps" / "client")

print("PATCHED:")
for p in patched:
    print("-", p)
print("Backup:", BK)
PY

echo "✅ da_ui_polish_v3 OK"
echo "Backup: $BK"
