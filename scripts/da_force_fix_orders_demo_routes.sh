#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS_DIR="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backups/da_force_fix_orders_demo_routes_$TS"
DRY_RUN="${DRY_RUN:-0}"  # DRY_RUN=1 => no write

log()  { printf "\n\033[1;32m[da-force-orders]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[da-force-orders]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[da-force-orders]\033[0m %s\n" "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Missing dependency: $1"; exit 1; }; }

backup_file() {
  local f="$1"
  mkdir -p "$BACKUP_DIR"
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
}

need bash
need python3
need sha256sum || true

[ -d "$APPS_DIR" ] || { err "Apps dir not found: $APPS_DIR"; exit 1; }
mkdir -p "$ROOT/.backups"

log "Mode: $([ "$DRY_RUN" = "1" ] && echo 'DRY_RUN (no writes)' || echo 'APPLY (writes + backups)')"
log "Searching for ANY orders-demo*.tsx under apps/{client,courier,merchant}/app/**"

python3 - <<'PY' "$APPS_DIR" "$ROOT" "$BACKUP_DIR" "$DRY_RUN"
import os, re, sys

APPS_DIR, ROOT, BACKUP_DIR, DRY_RUN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"
TARGET_APPS = ("client", "courier", "merchant")
TARGET_NAMES = ("orders-demo.tsx", "orders_demo.tsx")

PLACEHOLDER = """\
import React from "react";
import { View, Text } from "react-native";

export default function OrdersDemoRoute() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: "600", textAlign: "center" }}>Orders Demo</Text>
      <Text style={{ marginTop: 8, textAlign: "center" }}>
        Route placeholder (forced default export)
      </Text>
    </View>
  );
}
"""

def should_consider(path: str) -> bool:
  p = path.replace("\\", "/")
  return any(f"/apps/{a}/" in p for a in TARGET_APPS) and "/app/" in p and p.endswith(TARGET_NAMES)

def find_candidates():
  out = []
  for root, dirs, files in os.walk(APPS_DIR):
    if "node_modules" in root.split(os.sep):
      continue
    for fn in files:
      if fn in TARGET_NAMES:
        path = os.path.join(root, fn)
        if should_consider(path):
          out.append(path)
  return sorted(out)

def read(path):
  return open(path, "r", encoding="utf-8").read()

def diag(path, s):
  has_default = bool(re.search(r"^\s*export\s+default\s+", s, flags=re.M))
  has_default_fn = bool(re.search(r"^\s*export\s+default\s+function\s+\w+\s*\(", s, flags=re.M))
  return has_default, has_default_fn

cands = find_candidates()
print(f"\n[da-force-orders] Found {len(cands)} candidate route files")
for p in cands:
  print(f"  - {p}")

if not cands:
  print("\n[da-force-orders] No candidates found. (Nothing to do)")
  sys.exit(0)

print("\n[da-force-orders] Diagnostics (before)")
for p in cands:
  s = read(p)
  has_default, has_default_fn = diag(p, s)
  print(f"\n--- {p}")
  print(f"has_default_export={has_default} | has_default_function={has_default_fn} | bytes={len(s.encode('utf-8'))}")
  # show first/last lines to catch weird re-exports
  head = "\n".join(s.splitlines()[:18])
  tail = "\n".join(s.splitlines()[-12:])
  print("\n[head]\n" + head)
  print("\n[tail]\n" + tail)

print("\n[da-force-orders] Action: FORCE overwrite all candidates with a known-good default export component.")
if DRY_RUN:
  print("[da-force-orders] DRY_RUN=1 => no files written, no backups created.")
  sys.exit(0)

for p in cands:
  # backup
  rel = p[len(ROOT)+1:] if p.startswith(ROOT + "/") else p.lstrip("/")
  dest = os.path.join(BACKUP_DIR, rel)
  os.makedirs(os.path.dirname(dest), exist_ok=True)
  with open(p, "rb") as rf, open(dest, "wb") as wf:
    wf.write(rf.read())
  # overwrite
  with open(p, "w", encoding="utf-8") as f:
    f.write(PLACEHOLDER)
  print(f"OVERWRITTEN: {p}")

print(f"\n[da-force-orders] Backups dir: {BACKUP_DIR}")
PY

log "Done."
echo "Backups (if applied) in: $BACKUP_DIR"

cat <<'NEXT'

NEXT STEPS (IMPORTANT):
1) Restart metro for each app with --clear:
   cd /opt/delishafrica/monorepo/apps/client   && pnpm dev -- --tunnel --port 8081 --clear
   cd /opt/delishafrica/monorepo/apps/courier  && pnpm dev -- --tunnel --port 8082 --clear
   cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear

2) On iPhone: swipe-close the 3 apps completely, then rescan QR.

If you need to restore:
- backups are in the folder printed above (copy back the original file).
NEXT
