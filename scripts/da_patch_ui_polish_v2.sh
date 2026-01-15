#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BRAND_TITLE="${BRAND_TITLE:-DelishAfrica}"
# Gold par défaut, tu peux mettre Purple: #7B2EFF
BRAND_COLOR="${BRAND_COLOR:-#D4AF37}"

BK="$ROOT/backups/ui_polish_v2_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK"
echo "Backup dir: $BK"

python3 - <<PY
import re, shutil
from pathlib import Path

ROOT = Path("$ROOT")
BK = Path("$BK")
TITLE = "$BRAND_TITLE"
COLOR = "$BRAND_COLOR"
apps = ["client","courier","merchant"]

def backup(p: Path):
    dst = BK / p.relative_to(ROOT)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dst)

def write(p: Path, s: str):
    backup(p)
    p.write_text(s, encoding="utf-8")

def ensure_stack_screenoptions(txt: str) -> str:
    # On injecte/force des options de header SANS casser votre layout existant
    # (si headerShown est déjà à false chez vous, ça ne gêne pas, mais ça ne s’affichera pas non plus)
    gold_shadow = "rgba(0,0,0,0.45)"
    opts = (
        "headerBackTitleVisible: false,\\n"
        "      headerBackTitle: \\\"\\\",\\n"
        f"      headerTitle: \\\"{TITLE}\\\",\\n"
        "      headerTitleAlign: \\\"center\\\",\\n"
        f"      headerTintColor: \\\"{COLOR}\\\",\\n"
        "      headerTitleStyle: {\\n"
        "        fontWeight: \\\"900\\\",\\n"
        "        letterSpacing: 0.8,\\n"
        f"        color: \\\"{COLOR}\\\",\\n"
        f"        textShadowColor: \\\"{gold_shadow}\\\",\\n"
        "        textShadowOffset: { width: 0, height: 1 },\\n"
        "        textShadowRadius: 2,\\n"
        "      },\\n"
    )

    # Cas 1: Stack a déjà screenOptions={...}
    m = re.search(r"(<Stack\\b[^>]*\\bscreenOptions=\\{\\{)([\\s\\S]*?)(\\}\\}[^>]*>)", txt)
    if m:
        body = m.group(2)

        def upsert(prop, value_block):
            nonlocal body
            # remplace si existe
            if re.search(rf"\\b{re.escape(prop)}\\s*:", body):
                body = re.sub(rf"\\b{re.escape(prop)}\\s*:[^,]*,?", "", body)
            body = body.rstrip() + "\\n      " + value_block

        # On nettoie d’abord, puis on remet les valeurs
        # (on évite les doublons)
        body = re.sub(r"\\bheaderBackTitleVisible\\s*:[\\s\\S]*?,\\s*", "", body)
        body = re.sub(r"\\bheaderBackTitle\\s*:[\\s\\S]*?,\\s*", "", body)
        body = re.sub(r"\\bheaderTitle\\s*:[\\s\\S]*?,\\s*", "", body)
        body = re.sub(r"\\bheaderTitleAlign\\s*:[\\s\\S]*?,\\s*", "", body)
        body = re.sub(r"\\bheaderTintColor\\s*:[\\s\\S]*?,\\s*", "", body)
        body = re.sub(r"\\bheaderTitleStyle\\s*:[\\s\\S]*?\\}\\s*,\\s*", "", body)

        body = body.rstrip() + "\\n      " + opts
        return txt[:m.start()] + m.group(1) + body + m.group(3) + txt[m.end():]

    # Cas 2: Stack sans screenOptions -> on injecte screenOptions={{...}}
    return re.sub(
        r"<Stack(\\b[^>]*)>",
        lambda mm: f"<Stack{mm.group(1)}\\n    screenOptions={{\\n      {opts}    }}\\n  >",
        txt,
        count=1,
    )

def patch_layout(p: Path) -> bool:
    if not p.exists():
        return False
    orig = p.read_text(encoding="utf-8", errors="replace")
    txt = ensure_stack_screenoptions(orig)
    if txt != orig:
        write(p, txt)
        return True
    return False

def patch_orders_demo(p: Path) -> bool:
    if not p.exists():
        return False
    orig = p.read_text(encoding="utf-8", errors="replace")
    txt = orig

    # 1) sécurise rawId + niceId (évite .replace sur undefined)
    # cible le pattern classique: const niceId = o.orderId.replace(...)
    if re.search(r"const\\s+niceId\\s*=\\s*o\\.orderId\\.replace\\(", txt):
        txt = re.sub(
            r"const\\s+niceId\\s*=\\s*o\\.orderId\\.replace\\(([^\\)]*)\\);",
            "const rawId = (o as any).orderId ?? (o as any).id ?? (o as any).order?.id ?? '';\n"
            "  const niceId = String(rawId).replace(\\1);",
            txt,
            count=1,
        )

    # 2) key unique (évite warning React keys)
    # key={o.orderId} -> key={String(rawId || idx)} / ou fallback direct si rawId non défini
    txt = re.sub(
        r"key=\\{\\s*o\\.orderId\\s*\\}",
        "key={String(((o as any).orderId ?? (o as any).id ?? idx))}",
        txt,
    )

    # 3) nettoyage visuel de labels “orders-demo” s’ils sont rendus en texte quelque part
    txt = txt.replace("orders-demo", "Commandes")

    if txt != orig:
        write(p, txt)
        return True
    return False

patched = []
for a in apps:
    layout = ROOT / f"apps/{a}/app/_layout.tsx"
    if patch_layout(layout):
        patched.append(str(layout))

for a in apps:
    od = ROOT / f"apps/{a}/app/orders-demo.tsx"
    if patch_orders_demo(od):
        patched.append(str(od))

print("PATCHED:")
for p in patched:
    print(" -", p)

# On ne touche pas automatiquement aux “pills index” ici (c’est du custom)
# mais on liste les fichiers candidats pour le patch B.
candidates = []
for a in apps:
    base = ROOT / f"apps/{a}"
    for f in base.rglob("*.tsx"):
        t = f.read_text(encoding="utf-8", errors="ignore")
        if "useSegments" in t or "usePathname" in t:
            if "index" in t:
                candidates.append(str(f))
print("\\nCANDIDATES (pills/index):")
for c in candidates[:40]:
    print(" -", c)
PY

echo
echo "✅ Patch v2 appliqué. Backup: $BK"
echo "👉 Relance Expo (ton script clean), puis re-scan les 3 QR."
