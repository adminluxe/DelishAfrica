#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BACKUPS="$ROOT/backups"

# Couleur du titre (or par défaut). Pour Purple Holding: export BRAND_COLOR="#7B2EFF"
BRAND_COLOR="${BRAND_COLOR:-#D4AF37}"
BRAND_TITLE="${BRAND_TITLE:-DelishAfrica}"

# Allonge les flocons (1.0 = normal, 1.6 = +60%)
DURATION_MULT="${DURATION_MULT:-1.6}"

cd "$ROOT"

pick_backup() {
  local b
  for b in $(ls -1dt "$BACKUPS"/* 2>/dev/null); do
    if [[ -f "$b/apps/client/app/_layout.tsx" && -f "$b/apps/courier/app/_layout.tsx" && -f "$b/apps/merchant/app/_layout.tsx" ]]; then
      echo "$b"
      return 0
    fi
  done
  return 1
}

BK="$(pick_backup || true)"
if [[ -z "${BK:-}" ]]; then
  echo "❌ Aucun backup ne contient apps/*/app/_layout.tsx (client/courier/merchant)."
  echo "   Vérifie: ls -la $BACKUPS"
  exit 1
fi

echo "✅ Backup choisi: $BK"
echo "→ Restauration des 3 layouts..."
for app in client courier merchant; do
  cp -f "$BK/apps/$app/app/_layout.tsx" "$ROOT/apps/$app/app/_layout.tsx"
done
echo "✅ Layouts restaurés (TSX clean)."

python3 - <<PY
import re
from pathlib import Path

ROOT = Path("/opt/delishafrica/monorepo")
BRAND_TITLE = ${BRAND_TITLE!r}
BRAND_COLOR = ${BRAND_COLOR!r}
DURATION_MULT = float(${DURATION_MULT!r})

apps = ["client","courier","merchant"]

def write_if_changed(p: Path, new: str):
  old = p.read_text(encoding="utf-8", errors="replace")
  if new != old:
    p.write_text(new, encoding="utf-8")
    return True
  return False

def patch_stack_screenoptions(layout_path: Path):
  s = layout_path.read_text(encoding="utf-8", errors="replace")

  # trouve le 1er <Stack ...> (mais pas <Stack.Screen ...>)
  m = re.search(r"<Stack(?!\.)\\b[^>]*>", s)
  if not m:
    return False

  tag = m.group(0)
  if "screenOptions=" in tag:
    # On ne tente pas de reparser un objet potentiellement complexe : on laisse (restauré proprement, donc généralement absent)
    return False

  inject = (
    " screenOptions={{\\n"
    "    headerShown: true,\\n"
    "    headerBackTitleVisible: false,\\n"
    f"    headerTitle: \\"{BRAND_TITLE}\\",\\n"
    "    headerTitleAlign: \\"center\\",\\n"
    f"    headerTintColor: \\"{BRAND_COLOR}\\",\\n"
    "    headerTitleStyle: {\\n"
    "      fontWeight: \\"900\\",\\n"
    "      letterSpacing: 0.6,\\n"
    f"      color: \\"{BRAND_COLOR}\\",\\n"
    "      textShadowColor: \\"rgba(0,0,0,0.70)\\",\\n"
    "      textShadowOffset: { width: 0, height: 1 },\\n"
    "      textShadowRadius: 2,\\n"
    "    },\\n"
    "  }}"
  )

  # insère avant la fermeture > (ou />)
  if tag.endswith("/>"):
    new_tag = tag[:-2] + inject + " />"
  else:
    new_tag = tag[:-1] + inject + ">"
  s2 = s[:m.start()] + new_tag + s[m.end():]
  return write_if_changed(layout_path, s2)

def patch_orders_demo_keys(app_root: Path):
  p = app_root / "app" / "orders-demo.tsx"
  if not p.exists():
    return False
  s = p.read_text(encoding="utf-8", errors="replace")

  # Fix warning key unique: key={o.orderId} -> key={String(o.orderId ?? o.id ?? idx)}
  # (ultra safe : ne touche que ce pattern)
  s2 = re.sub(
    r"key=\\{\\s*o\\.orderId\\s*\\}",
    "key={String(o.orderId ?? (o as any).id ?? idx)}",
    s
  )
  return write_if_changed(p, s2)

def patch_route_pills_hide_index_and_demo(app_root: Path):
  patched_any = False
  # On vise les fichiers qui font du rendu de segments (pills debug)
  for p in app_root.rglob("*.tsx"):
    try:
      s = p.read_text(encoding="utf-8", errors="replace")
    except:
      continue

    if "segments.map(" in s and ("useSegments" in s or "segments =" in s):
      if "filter((s)" not in s and "!== \"index\"" not in s:
        s2 = s.replace(
          "segments.map(",
          "segments.filter((seg) => !!seg && seg !== \"index\" && seg !== \"orders-demo\" && seg !== \"demo\" && seg !== \"(tabs)\").map("
        )
        if s2 != s:
          p.write_text(s2, encoding="utf-8")
          patched_any = True

  return patched_any

def patch_snow_duration(app_root: Path):
  patched_any = False
  for p in app_root.rglob("SnowOverlay.tsx"):
    s = p.read_text(encoding="utf-8", errors="replace")
    # pattern très courant: duration: X,
    # on n'essaie pas de multiplier au runtime : on augmente quelques durées "standards" si trouvées
    s2 = s
    # Remplacements prudents (on garde la perf, juste plus long)
    s2 = re.sub(r"\\bduration:\\s*220\\b", f"duration: {int(220*DURATION_MULT)}", s2)
    s2 = re.sub(r"\\bduration:\\s*260\\b", f"duration: {int(260*DURATION_MULT)}", s2)
    s2 = re.sub(r"\\bduration:\\s*300\\b", f"duration: {int(300*DURATION_MULT)}", s2)
    if s2 != s:
      p.write_text(s2, encoding="utf-8")
      patched_any = True
  return patched_any

patched = []

for app in apps:
  app_root = ROOT / "apps" / app
  layout = app_root / "app" / "_layout.tsx"
  if layout.exists() and patch_stack_screenoptions(layout):
    patched.append(str(layout))

  if patch_orders_demo_keys(app_root):
    patched.append(str(app_root / "app" / "orders-demo.tsx"))

  if patch_route_pills_hide_index_and_demo(app_root):
    patched.append(f"{app_root}/**/* (route pills filtered)")

  if patch_snow_duration(app_root):
    patched.append(f"{app_root}/**/SnowOverlay.tsx (duration up)")

print("PATCHED:")
for x in patched:
  print(" -", x)
PY

echo "✅ v4 terminé."
echo "👉 Maintenant relance Expo (ton script clean / tmux)."
