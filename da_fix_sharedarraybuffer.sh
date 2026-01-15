#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
LOG="$ROOT/da_fix_sharedarraybuffer.log"

exec > >(tee -a "$LOG") 2>&1
echo "=== [DA] Fix SharedArrayBuffer polyfill - $(date) ==="

cd "$ROOT"

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ python3 introuvable. Installe python3 ou dis-moi et je te fais une version pure bash/sed."
  exit 1
fi

APPS=("apps/client" "apps/courier" "apps/merchant")

for APP in "${APPS[@]}"; do
  if [ ! -d "$APP" ]; then
    echo "⚠️ Skip: $APP n'existe pas"
    continue
  fi

  echo ""
  echo ">>> App: $APP"

  POLY="$ROOT/$APP/polyfills.js"

  if [ ! -f "$POLY" ]; then
    cat > "$POLY" << 'POLYEOF'
// polyfills.js
// Polyfills globaux pour React Native / Hermes

// Hermes n'expose pas SharedArrayBuffer. Certaines libs crashent si la propriété n'existe pas.
// Pour éviter le crash au démarrage, on fournit un stub basique.
if (typeof global.SharedArrayBuffer === 'undefined') {
  global.SharedArrayBuffer = global.ArrayBuffer;
}
POLYEOF
    echo "✅ Créé: $POLY"
  else
    echo "ℹ️ Déjà présent: $POLY"
  fi

  # Cherche le fichier entrypoint (index.*) qui contient expo-router/entry
  ENTRY=""
  for CAND in "$APP/index.ts" "$APP/index.tsx" "$APP/index.js"; do
    if [ -f "$CAND" ]; then
      if grep -q "expo-router/entry" "$CAND" 2>/dev/null; then
        ENTRY="$CAND"
        break
      fi
    fi
  done

  # Si pas trouvé, on scanne un peu plus large dans le dossier (maxdepth 2)
  if [ -z "$ENTRY" ]; then
    ENTRY="$(find "$APP" -maxdepth 2 -type f \( -name "index.js" -o -name "index.ts" -o -name "index.tsx" \) -print0 \
      | xargs -0 -r grep -l "expo-router/entry" 2>/dev/null \
      | head -n 1 || true)"
  fi

  if [ -z "$ENTRY" ]; then
    echo "⚠️ Impossible de trouver un entrypoint (index.*) contenant expo-router/entry dans $APP"
    echo "   -> On n'a rien patché pour cette app."
    continue
  fi

  echo "✅ Entrypoint détecté: $ENTRY"

  # Backup
  TS="$(date +%Y%m%d_%H%M%S)"
  cp "$ENTRY" "$ENTRY.bak.$TS"
  echo "🧷 Backup: $ENTRY.bak.$TS"

  # Patch via python pour être idempotent et propre
  python3 - << PY
from pathlib import Path
import re

p = Path("$ENTRY")
txt = p.read_text(encoding="utf-8")

# Déjà patché ?
if re.search(r'["\\\']\\./polyfills["\\\']', txt) or re.search(r'["\\\']\\./polyfills\\.js["\\\']', txt):
    print("ℹ️ polyfills déjà importé dans", p)
    raise SystemExit(0)

# Détecte si l'entrypoint est en require() ou import
use_require = bool(re.search(r"require\\(\\s*['\\\"]expo-router/entry['\\\"]\\s*\\)", txt))
if use_require:
    insert_line = "require('./polyfills');\\n"
else:
    insert_line = "import './polyfills';\\n"

# Insère avant la première occurrence expo-router/entry
m = re.search(r"^(.*expo-router/entry.*)$", txt, flags=re.M)
if not m:
    # fallback: on met en tout début
    txt = insert_line + txt
else:
    line = m.group(1)
    txt = txt.replace(line, insert_line + line, 1)

p.write_text(txt, encoding="utf-8")
print("✅ Patch appliqué:", p)
PY

done

echo ""
echo "=== OK. Prochaine étape ==="
echo "1) Redémarre Metro (client) : cd /opt/delishafrica/monorepo && pnpm client:dev"
echo "2) Sur iPhone : force-quit l'app Client puis relance."
echo "Logs: $LOG"
