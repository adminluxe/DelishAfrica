#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS=$(date +%Y%m%d_%H%M%S)
BK="$ROOT/backups/ui_migrate_$TS"
mkdir -p "$BK"
echo "Backup -> $BK"

for a in "${APPS[@]}"; do
  echo "== $a =="
  APP_ROOT="$ROOT/apps/$a"
  APP_DIR="$APP_ROOT/app"
  SRC_UI="$APP_DIR/_ui"
  DST_UI="$APP_ROOT/ui"

  mkdir -p "$BK/$a"

  # Backup app/index.tsx (souvent l'origine du rouge)
  [ -f "$APP_DIR/index.tsx" ] && cp -a "$APP_DIR/index.tsx" "$BK/$a/index.tsx.bak" || true

  # Déplace _ui -> ui (hors app/)
  if [ -d "$SRC_UI" ]; then
    cp -a "$SRC_UI" "$BK/$a/_ui"
    if [ -d "$DST_UI" ]; then
      cp -a "$SRC_UI"/. "$DST_UI"/
      rm -rf "$SRC_UI"
    else
      mv "$SRC_UI" "$DST_UI"
    fi
  fi

  # Nettoyage caches app
  rm -rf "$APP_ROOT/.expo" "$APP_ROOT/.expo-shared" "$APP_ROOT/node_modules/.cache" \
         "$APP_ROOT/.metro" "$APP_ROOT/.turbo" 2>/dev/null || true

  # Rewrite imports dans app/** vers ../ui/** (calculé selon profondeur)
  python3 - <<PY
import re, pathlib

app_root = pathlib.Path("$APP_ROOT")
app_dir  = app_root / "app"
ui_dir   = app_root / "ui"

if not app_dir.exists() or not ui_dir.exists():
    raise SystemExit(0)

# capte les module-spec dans from '...'/from "..."
spec_re = re.compile(r'(from\s+)(["\'])([^"\']+)(["\'])')

def fix_spec(file_path: pathlib.Path, spec: str) -> str:
    # On ne touche qu'aux imports relatifs qui pointent vers _ui ou +ui
    if not spec.startswith('.'):
        return spec
    if ('/_ui/' not in spec) and ('/+ui/' not in spec) and (not spec.startswith('./_ui/')) and (not spec.startswith('./+ui/')) and (not spec.startswith('../_ui/')) and (not spec.startswith('../+ui/')):
        return spec

    # profondeur depuis app/
    rel_dir = file_path.parent.relative_to(app_dir)
    depth = 0 if str(rel_dir) == '.' else len(rel_dir.parts)

    prefix = '../' * (depth + 1) + 'ui/'

    # récupère ce qu'il y a après _ui/ ou +ui/
    m = re.split(r'/(?:_ui|\+ui)/', spec, maxsplit=1)
    if len(m) != 2:
        return spec
    tail = m[1]
    return prefix + tail

for p in app_dir.rglob('*'):
    if p.suffix.lower() not in ('.ts', '.tsx', '.js', '.jsx'):
        continue
    try:
        txt = p.read_text(encoding='utf-8')
    except Exception:
        continue

    def sub(m):
        before, q1, spec, q2 = m.group(1), m.group(2), m.group(3), m.group(4)
        new_spec = fix_spec(p, spec)
        return f"{before}{q1}{new_spec}{q2}"

    new = spec_re.sub(sub, txt)
    if new != txt:
        p.write_text(new, encoding='utf-8')

PY

  echo "-- Verify: plus aucun import vers _ui/+ui dans app/ (doit être vide)"
  rg -n --hidden --no-ignore -S 'from\s+["'\'']\.\.?/.*(\+ui|_ui)/' "$APP_DIR" || true
done

rm -rf /tmp/metro-* /tmp/haste-map-* 2>/dev/null || true
echo "OK. UI est hors app/. Prochaine étape: restart Expo --clear."
