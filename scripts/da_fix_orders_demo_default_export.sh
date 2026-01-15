#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS_DIR="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backups/da_fix_orders_demo_default_export_$TS"
DRY_RUN="${DRY_RUN:-0}" # DRY_RUN=1 => no write

log()  { printf "\n\033[1;32m[da-orders-demo]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[da-orders-demo]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[da-orders-demo]\033[0m %s\n" "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Missing dependency: $1"; exit 1; }; }

backup_file() {
  local f="$1"
  mkdir -p "$BACKUP_DIR"
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
}

need python3
[ -d "$APPS_DIR" ] || { err "Apps dir not found: $APPS_DIR"; exit 1; }
mkdir -p "$ROOT/.backups"

log "Mode: $([ "$DRY_RUN" = "1" ] && echo 'DRY_RUN (no writes)' || echo 'APPLY (writes + backups)')"
log "Searching orders-demo routes under: $APPS_DIR/*/app/**"

python3 - <<'PY' "$APPS_DIR" "$ROOT" "$BACKUP_DIR" "$DRY_RUN"
import os, re, sys

APPS_DIR, ROOT, BACKUP_DIR, DRY_RUN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"

TARGET_APPS = ("client", "courier", "merchant")
PLACEHOLDER = """
export default function OrdersDemoRoute() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>Orders Demo</Text>
      <Text style={{ marginTop: 8, textAlign: "center" }}>
        Route placeholder (default export enforced)
      </Text>
    </View>
  );
}
""".strip() + "\n"

def should_consider(path: str) -> bool:
  p = path.replace("\\", "/")
  return any(f"/apps/{a}/" in p for a in TARGET_APPS) and "/app/" in p and (p.endswith("orders-demo.tsx") or p.endswith("orders_demo.tsx"))

def ensure_import(s: str, import_line: str) -> str:
  if import_line in s:
    return s
  # insert after first import line, else prepend
  lines = s.splitlines(True)
  for i, line in enumerate(lines):
    if line.lstrip().startswith("import "):
      lines.insert(i+1, import_line + "\n")
      return "".join(lines)
  return import_line + "\n" + s

def has_default_export(s: str) -> bool:
  return re.search(r"^\s*export\s+default\s+", s, flags=re.M) is not None

def default_is_function_component(s: str) -> bool:
  # strong signal for Expo Router: export default function / export default ( arrow ) / export default memo(...)
  if re.search(r"^\s*export\s+default\s+function\s+\w+\s*\(", s, flags=re.M): return True
  if re.search(r"^\s*export\s+default\s*\(", s, flags=re.M): return True
  if re.search(r"^\s*export\s+default\s+\w+\s*;", s, flags=re.M):
    # try to see if identifier is declared as function/const component in file
    m = re.search(r"^\s*export\s+default\s+(\w+)\s*;", s, flags=re.M)
    if m:
      name = m.group(1)
      if re.search(rf"^\s*function\s+{re.escape(name)}\s*\(", s, flags=re.M): return True
      if re.search(rf"^\s*const\s+{re.escape(name)}\s*=\s*\(", s, flags=re.M): return True
      if re.search(rf"^\s*const\s+{re.escape(name)}\s*:\s*React\.", s, flags=re.M): return True
  return False

def comment_out_first_default_line(s: str) -> str:
  lines = s.splitlines(True)
  for i, line in enumerate(lines):
    if re.match(r"^\s*export\s+default\s+", line):
      lines[i] = re.sub(r"^(\s*)export\s+default", r"\1// DA_PATCH_DISABLED_DEFAULT export default", line)
      break
  return "".join(lines)

patched = []
skipped = []
candidates = []

for root, dirs, files in os.walk(APPS_DIR):
  if "node_modules" in root.split(os.sep):
    continue
  for fn in files:
    if fn in ("orders-demo.tsx", "orders_demo.tsx"):
      path = os.path.join(root, fn)
      if should_consider(path):
        candidates.append(path)

print(f"\n[da-orders-demo] Found {len(candidates)} candidates")
for p in candidates:
  print(f"  - {p}")

for path in candidates:
  try:
    s = open(path, "r", encoding="utf-8").read()
  except Exception as e:
    skipped.append((path, f"READ_FAIL: {e}"))
    continue

  if default_is_function_component(s):
    skipped.append((path, "OK: already has default function/arrow component"))
    continue

  if has_default_export(s) and default_is_function_component(s) == False:
    # likely default exists but not a component -> disable it safely, add placeholder default component
    s2 = comment_out_first_default_line(s)
  else:
    s2 = s

  # ensure imports needed for placeholder
  if 'from "react"' not in s2 and "from 'react'" not in s2:
    s2 = ensure_import(s2, 'import React from "react";')
  if 'from "react-native"' not in s2 and "from 'react-native'" not in s2:
    s2 = ensure_import(s2, 'import { View, Text } from "react-native";')
  else:
    # if react-native import exists but doesn't include View/Text, add separate import (safe)
    if not re.search(r"\bView\b", s2) or not re.search(r"\bText\b", s2):
      # only add if View/Text not already imported somewhere
      if 'import { View, Text } from "react-native";' not in s2 and "import { View, Text } from 'react-native';" not in s2:
        s2 = ensure_import(s2, 'import { View, Text } from "react-native";')

  # ensure there is a real default export component at the end
  if not re.search(r"^\s*export\s+default\s+function\s+OrdersDemoRoute\s*\(", s2, flags=re.M):
    s2 = s2.rstrip() + "\n\n" + PLACEHOLDER

  if s2 == s:
    skipped.append((path, "SKIP: no change needed"))
    continue

  # backup + write
  if not DRY_RUN:
    rel = path[len(ROOT)+1:] if path.startswith(ROOT + "/") else path.lstrip("/")
    dest = os.path.join(BACKUP_DIR, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(path, "rb") as rf, open(dest, "wb") as wf:
      wf.write(rf.read())
    with open(path, "w", encoding="utf-8") as f:
      f.write(s2)

  patched.append(path)

print("\n[da-orders-demo] Summary")
print(f"- Patched: {len(patched)}")
for p in patched:
  print(f"  PATCHED: {p}")

print(f"\n- Skipped: {len(skipped)}")
for p, r in skipped[:120]:
  print(f"  {r} :: {p}")
if len(skipped) > 120:
  print("  ... (more skips not shown)")

print(f"\n[da-orders-demo] Backups dir: {BACKUP_DIR}")
if DRY_RUN:
  print("[da-orders-demo] DRY_RUN=1 => no files written, no backups created.")
PY

log "Done."
echo "Backups (if applied) in: $BACKUP_DIR"
echo
echo "Next: restart metro with --clear for the app(s) impacted."
