#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS_DIR="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backups/da_fix_warnings_and_routes_$TS"

log()  { printf "\n\033[1;32m[da-fix]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[da-fix]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[da-fix]\033[0m %s\n" "$*"; }

need() {
  command -v "$1" >/dev/null 2>&1 || { err "Missing dependency: $1"; exit 1; }
}

backup_file() {
  local f="$1"
  mkdir -p "$BACKUP_DIR"
  # preserve relative path
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
}

python_patch_logbox() {
  local file="$1"
  python3 - <<'PY' "$file"
import re, sys
p = sys.argv[1]
s = open(p, "r", encoding="utf-8").read()

if "LogBox.ignoreLogs(" in s:
    print(f"SKIP LogBox already present: {p}")
    sys.exit(0)

# Ensure LogBox import
# Case 1: existing react-native named import -> add LogBox
m = re.search(r'^(import\s*\{\s*)([^}]*)(\s*\}\s*from\s*[\'"]react-native[\'"]\s*;)\s*$', s, flags=re.M)
if m:
    names = m.group(2).strip()
    if "LogBox" not in names.split(","):
        # add LogBox cleanly
        new_names = (names + ", LogBox").strip().strip(",")
        s = s[:m.start()] + m.group(1) + new_names + m.group(3) + s[m.end():]
else:
    # Case 2: no named import, add a new import after first import line
    lines = s.splitlines(True)
    inserted = False
    for i, line in enumerate(lines):
        if line.lstrip().startswith("import "):
            # insert after this first import line
            lines.insert(i+1, 'import { LogBox } from "react-native";\n')
            inserted = True
            break
    if not inserted:
        # no imports at all; prepend
        lines.insert(0, 'import { LogBox } from "react-native";\n')
    s = "".join(lines)

# Insert LogBox.ignoreLogs after top import block
m2 = re.match(r'^(?:\s*import[^\n]*\n)+', s)
ins = '\nLogBox.ignoreLogs([\n  "useEffect must not return anything besides a function",\n]);\n'
if m2:
    pos = m2.end()
    s = s[:pos] + ins + s[pos:]
else:
    s = ins + s

open(p, "w", encoding="utf-8").write(s)
print(f"PATCHED LogBox ignore: {p}")
PY
}

python_fix_default_export_orders_demo() {
  local file="$1"
  python3 - <<'PY' "$file"
import re, sys
p = sys.argv[1]
s = open(p, "r", encoding="utf-8").read()

if re.search(r'^\s*export\s+default\s+', s, flags=re.M):
    print(f"SKIP default export already exists: {p}")
    sys.exit(0)

# Try to detect an existing exported component name
name = None

m = re.search(r'^\s*export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(', s, flags=re.M)
if m:
    name = m.group(1)

if not name:
    m = re.search(r'^\s*export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=', s, flags=re.M)
    if m:
        name = m.group(1)

# Add default export
if name:
    s = s.rstrip() + f"\n\nexport default {name};\n"
    open(p, "w", encoding="utf-8").write(s)
    print(f"PATCHED add 'export default {name};' -> {p}")
    sys.exit(0)

# Fallback: append a safe placeholder route to satisfy Expo Router
# Ensure React Native imports exist for placeholder
placeholder = """
import React from "react";
import { View, Text } from "react-native";

export default function OrdersDemo() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>Orders Demo</Text>
      <Text style={{ marginTop: 8, textAlign: "center" }}>Route placeholder (default export added by script)</Text>
    </View>
  );
}
""".strip() + "\n"

# If file already has react-native import, avoid duplicating placeholder imports: just append default component without imports
has_rn = re.search(r'from\s+[\'"]react-native[\'"]', s) is not None
has_react = re.search(r'from\s+[\'"]react[\'"]', s) is not None

if has_rn or has_react:
    # Append component without re-importing if possible
    s = s.rstrip() + "\n\n" + "\n".join([l for l in placeholder.splitlines() if not l.startswith("import ")]) + "\n"
else:
    s = placeholder + "\n" + s.lstrip()

open(p, "w", encoding="utf-8").write(s)
print(f"PATCHED add placeholder default export route -> {p}")
PY
}

log "Sanity checks"
need bash
need python3
mkdir -p "$ROOT/scripts"
mkdir -p "$ROOT/.backups"

[ -d "$APPS_DIR" ] || { err "Apps dir not found: $APPS_DIR"; exit 1; }

log "1) Add LogBox ignore warning in the 3 apps entry layouts"
# We target app/_layout.tsx primarily
LAYOUT_FILES=()
while IFS= read -r -d '' f; do LAYOUT_FILES+=("$f"); done < <(find "$APPS_DIR" -maxdepth 4 -type f -name "_layout.tsx" -path "*/app/_layout.tsx" -print0)

if [ "${#LAYOUT_FILES[@]}" -eq 0 ]; then
  warn "No app/_layout.tsx found. I will try broader search for _layout.tsx."
  while IFS= read -r -d '' f; do LAYOUT_FILES+=("$f"); done < <(find "$APPS_DIR" -type f -name "_layout.tsx" -print0)
fi

for f in "${LAYOUT_FILES[@]}"; do
  case "$f" in
    */apps/client/*|*/apps/courier/*|*/apps/merchant/*)
      backup_file "$f"
      python_patch_logbox "$f"
      ;;
  esac
done

log "2) Fix missing default export for orders-demo routes (safe targeted fix)"
ROUTE_FILES=()
while IFS= read -r -d '' f; do ROUTE_FILES+=("$f"); done < <(
  find "$APPS_DIR" -type f \( -name "orders-demo.tsx" -o -name "orders_demo.tsx" \) -path "*/app/*" -print0
)

if [ "${#ROUTE_FILES[@]}" -eq 0 ]; then
  warn "No orders-demo.tsx / orders_demo.tsx route found under apps/*/app/"
else
  for f in "${ROUTE_FILES[@]}"; do
    backup_file "$f"
    python_fix_default_export_orders_demo "$f"
  done
fi

log "3) Report suspects: useEffect(async ...) (no auto-modification)"
if command -v rg >/dev/null 2>&1; then
  rg -n "useEffect\(\s*async\s*\(" "$APPS_DIR" || true
else
  warn "ripgrep (rg) not found; using grep fallback (less accurate)."
  grep -RIn -- "useEffect(async" "$APPS_DIR" || true
fi

log "4) Done. Backups saved in:"
echo "    $BACKUP_DIR"

log "Next recommended commands (manual): restart dev servers if needed"
cat <<'NEXT'
- If you run via tmux, restart the 3 metro processes (client/courier/merchant).
- Otherwise, quick restart commands:

  cd /opt/delishafrica/monorepo/apps/client   && pnpm dev -- --tunnel --port 8081 --clear
  cd /opt/delishafrica/monorepo/apps/courier  && pnpm dev -- --tunnel --port 8082 --clear
  cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear
NEXT
