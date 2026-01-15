#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BK="$ROOT/backups/ui_patch_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK"

# Branding (tu peux switcher la couleur)
BRAND_TITLE="DelishAfrica"
GOLD="#F5C542"
PURPLE="#7B2FF7"
BRAND_COLOR="$GOLD"     # <-- mets "$PURPLE" si tu veux le clin d'oeil Holding

echo "Backup dir: $BK"
echo "Brand: $BRAND_TITLE / $BRAND_COLOR"

python3 - "$ROOT" "$BK" "$BRAND_TITLE" "$BRAND_COLOR" <<'PY'
import sys, re, shutil
from pathlib import Path

ROOT = Path(sys.argv[1])
BK   = Path(sys.argv[2])
TITLE= sys.argv[3]
COLOR= sys.argv[4]

apps = ["client","courier","merchant"]

def backup(p: Path):
    dest = BK / p.relative_to(ROOT)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, dest)

def write_if_changed(p: Path, new: str):
    old = p.read_text(encoding="utf-8", errors="replace")
    if new != old:
        backup(p)
        p.write_text(new, encoding="utf-8")
        return True
    return False

def patch_layout(layout: Path):
    txt = layout.read_text(encoding="utf-8", errors="replace")
    orig = txt

    # 1) screenOptions: injecte headerBackTitleVisible + headerTitle + style
    m = re.search(r"screenOptions\s*=\s*\{\{([\s\S]*?)\}\}", txt)
    if m:
        body = m.group(1)

        def ensure(prop, value):
            nonlocal body
            if re.search(rf"\b{re.escape(prop)}\s*:", body):
                return
            body = body.rstrip() + f",\n      {prop}: {value}\n    "

        ensure("headerBackTitleVisible", "false")
        ensure("headerTitle", f'"{TITLE}"')
        ensure("headerTitleAlign", '"center"')
        ensure("headerTintColor", f'"{COLOR}"')
        ensure("headerTitleStyle", "{ fontWeight: '900', letterSpacing: 0.6, color: '"+COLOR+"' }")

        txt = txt[:m.start()] + "screenOptions={{" + body + "}}" + txt[m.end():]
    else:
        # fallback: ajoute screenOptions au <Stack ...>
        txt = re.sub(
            r"<Stack(\s*)>",
            "<Stack\n    screenOptions={{\n"
            "      headerBackTitleVisible: false,\n"
            f"      headerTitle: \"{TITLE}\",\n"
            "      headerTitleAlign: \"center\",\n"
            f"      headerTintColor: \"{COLOR}\",\n"
            f"      headerTitleStyle: {{ fontWeight: '900', letterSpacing: 0.6, color: '{COLOR}' }},\n"
            "    }}\n  >",
            txt,
            count=1
        )

    # 2) Forcer le titre pour la route index (évite que “index” apparaisse)
    # On n'ajoute QUE si pas déjà présent.
    if re.search(r"<Stack\.Screen[^>]+name\s*=\s*['\"]index['\"]", txt) is None:
        txt = re.sub(
            r"(<Stack[^>]*>)",
            r"\1\n    <Stack.Screen name=\"index\" options={{ title: \"" + TITLE + "\" }} />",
            txt,
            count=1
        )

    return write_if_changed(layout, txt)

def normalize_orders_demo(file: Path):
    """
    Fix:
    - crash o.orderId.replace(...) quand orderId absent
    - warning key unique (utilise rawId + idx)
    - normalise status pour compter correctement
    """
    txt = file.read_text(encoding="utf-8", errors="replace")
    orig = txt

    # Inject helper normalizeStatus si absent
    if "function normalizeStatus" not in txt:
        # On l'injecte après imports (première ligne vide après imports)
        insert = """
function normalizeStatus(s: any) {
  const v = String(s ?? "").toUpperCase();
  if (["PENDING","WAITING","EN_ATTENTE","EN ATTENTE"].includes(v)) return "EN ATTENTE";
  if (["READY","PRET","PRÊT"].includes(v)) return "PRÊT";
  if (["DELIVERED","LIVREE","LIVRÉE"].includes(v)) return "LIVRÉE";
  return "INCONNU";
}

"""
        # place after last import
        parts = re.split(r"(\n\s*\n)", txt, maxsplit=1)
        if len(parts) >= 3:
            txt = parts[0] + parts[1] + insert + parts[2]
        else:
            txt = insert + txt

    # Remplace pattern dangereux: const niceId = o.orderId.replace(...)
    txt = re.sub(
        r"const\s+niceId\s*=\s*o\.orderId\.replace\([^;]*\);",
        "const rawId = (o as any)?.orderId ?? (o as any)?.id ?? (o as any)?.order_id;\n"
        "      const niceId = String(rawId ?? idx).replace(/_demo_/g, \"\");\n"
        "      const status = normalizeStatus((o as any)?.status ?? (o as any)?.state ?? (o as any)?.orderStatus);\n"
        "      const rowKey = `order_${String(rawId ?? 'na')}_${idx}`;",
        txt
    )

    # Si rawId/niceId déjà présents mais pas rowKey/status, on complète (soft)
    if "const rawId" in txt and "const rowKey" not in txt:
        txt = txt.replace(
            "const niceId =",
            "const rowKey = `order_${String(rawId ?? 'na')}_${idx}`;\n      const status = normalizeStatus((o as any)?.status ?? (o as any)?.state ?? (o as any)?.orderStatus);\n      const niceId =",
            1
        )

    # Fix key: key={o.orderId} -> key={rowKey} (et fallback si rowKey absent)
    if "rowKey" in txt:
        txt = re.sub(r"key\s*=\s*\{\s*o\.orderId\s*\}", "key={rowKey}", txt)
        txt = re.sub(r"key\s*=\s*\{\s*\(o\s+as\s+any\)\?\.orderId\s*\}", "key={rowKey}", txt)

    # BONUS: remplace affichage "status: ..." si présent (tolerant)
    # Exemple fréquent: <Text>status: {o.status}</Text> -> {status}
    txt = re.sub(r"\{\s*o\.status\s*\}", "{status}", txt)

    return write_if_changed(file, txt)

patched = []

for app in apps:
    app_root = ROOT / "apps" / app / "app"
    if not app_root.exists():
        continue

    # Patch _layout.tsx (root)
    layout = app_root / "_layout.tsx"
    if layout.exists() and patch_layout(layout):
        patched.append(str(layout))

    # Patch orders-demo.tsx (si existe)
    od = app_root / "orders-demo.tsx"
    if od.exists() and normalize_orders_demo(od):
        patched.append(str(od))

print("PATCHED:")
for p in patched:
    print(" -", p)
PY

echo
echo "✅ Patch terminé."
echo "👉 Relance Expo (ton script) puis rescan les QR."
echo "   bash /opt/delishafrica/monorepo/scripts/da_restart_expo_3apps.sh"
