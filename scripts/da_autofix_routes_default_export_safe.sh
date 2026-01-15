#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backups/da_autofix_routes_default_export_safe_$TS"
DRY_RUN="${DRY_RUN:-0}" # DRY_RUN=1 => no write

log()  { printf "\n\033[1;32m[da-routes]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[da-routes]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[da-routes]\033[0m %s\n" "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Missing dependency: $1"; exit 1; }; }

backup_file() {
  local f="$1"
  [ -e "$f" ] || return 0
  mkdir -p "$BACKUP_DIR"
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
}

need bash
need python3
mkdir -p "$ROOT/.backups"

log "Mode: $([ "$DRY_RUN" = "1" ] && echo 'DRY_RUN (no writes)' || echo 'APPLY (writes + backups)')"
log "Backup dir (if apply): $BACKUP_DIR"

python3 - <<'PY' "$ROOT" "$DRY_RUN" "$BACKUP_DIR"
import os, re, sys

ROOT = sys.argv[1]
DRY = sys.argv[2] == "1"
BACKUP_DIR = sys.argv[3]

APPS = ("client","courier","merchant")

PLACEHOLDER_TSX = """\
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

def backup(path: str):
  if DRY: 
    return
  if not os.path.exists(path):
    return
  rel = path[len(ROOT)+1:] if path.startswith(ROOT + "/") else path.lstrip("/")
  dest = os.path.join(BACKUP_DIR, rel)
  os.makedirs(os.path.dirname(dest), exist_ok=True)
  with open(path, "rb") as rf, open(dest, "wb") as wf:
    wf.write(rf.read())

def is_in_target_apps(path: str) -> bool:
  p = path.replace("\\","/")
  return any(f"/apps/{a}/" in p for a in APPS)

def is_route_file(path: str):
  p = path.replace("\\","/")
  return "/app/" in p and (p.endswith(".tsx") or p.endswith(".ts")) and not p.endswith(".d.ts")

def list_route_files(appdir: str):
  out = []
  for root, dirs, files in os.walk(os.path.join(appdir, "app")):
    if "node_modules" in root.split(os.sep):
      continue
    for fn in files:
      if fn.endswith(".tsx") or fn.endswith(".ts"):
        if fn.endswith(".d.ts"): 
          continue
        out.append(os.path.join(root, fn))
  return sorted(out)

def has_default_export(s: str) -> bool:
  return re.search(r"^\s*export\s+default\s+", s, flags=re.M) is not None

def has_jsx(s: str) -> bool:
  # strong-ish signal; avoid false positives by requiring "<X" token
  return re.search(r"<[A-Za-z]", s) is not None

def find_exported_component_name(s: str):
  # Prefer exported function component
  m = re.search(r"^\s*export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(", s, flags=re.M)
  if m: return m.group(1)

  # exported const component = (...) => or = () =>
  m = re.search(r"^\s*export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\(", s, flags=re.M)
  if m: return m.group(1)

  m = re.search(r"^\s*export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*\(\s*\)\s*=>", s, flags=re.M)
  if m: return m.group(1)

  m = re.search(r"^\s*export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*function\s*\(", s, flags=re.M)
  if m: return m.group(1)

  return None

def patch_add_default_export(path: str, s: str, name: str):
  if re.search(rf"^\s*export\s+default\s+{re.escape(name)}\s*;", s, flags=re.M):
    return s, False
  out = s.rstrip() + f"\n\nexport default {name};\n"
  return out, True

def ensure_orders_demo_ts_fixed(appdir: str):
  # Fix any orders-demo.ts / orders_demo.ts anywhere under app/**
  fixed = []
  for root, dirs, files in os.walk(os.path.join(appdir, "app")):
    for fn in files:
      if fn in ("orders-demo.ts","orders_demo.ts"):
        ts_path = os.path.join(root, fn)
        # we will replace with orders-demo.tsx in the SAME folder
        tsx_path = os.path.join(root, "orders-demo.tsx")

        fixed.append((ts_path, tsx_path))

        if not DRY:
          backup(ts_path)
          if os.path.exists(tsx_path):
            backup(tsx_path)
          # remove the .ts
          try:
            os.remove(ts_path)
          except FileNotFoundError:
            pass
          # write placeholder .tsx
          with open(tsx_path, "w", encoding="utf-8") as f:
            f.write(PLACEHOLDER_TSX)

        # also remove potential snake_case .tsx duplicate in same folder (avoid collisions)
        snake_tsx = os.path.join(root, "orders_demo.tsx")
        if os.path.exists(snake_tsx):
          if not DRY:
            backup(snake_tsx)
            os.remove(snake_tsx)

  return fixed

summary = {"orders_demo_ts_fixed": [], "tsx_patched": [], "tsx_skipped": [], "ts_report_only": []}

for a in APPS:
  appdir = os.path.join(ROOT, "apps", a)
  if not os.path.isdir(appdir):
    continue

  # 1) Priority fix: orders-demo.ts ghosts
  fixed = ensure_orders_demo_ts_fixed(appdir)
  for ts_path, tsx_path in fixed:
    summary["orders_demo_ts_fixed"].append((a, ts_path, tsx_path))

  # 2) Safe patch for .tsx missing default export (simple + JSX + exported component)
  for path in list_route_files(appdir):
    if not path.endswith(".tsx"):
      # report .ts routes (do NOT auto edit globally)
      if path.endswith(".ts") and not path.endswith(".d.ts"):
        try:
          s = open(path, "r", encoding="utf-8").read()
        except Exception:
          s = ""
        if (not has_default_export(s)) and os.path.basename(path) not in ("+html.ts","+html.tsx"):
          summary["ts_report_only"].append((a, path))
      continue

    try:
      s = open(path, "r", encoding="utf-8").read()
    except Exception:
      continue

    if has_default_export(s):
      continue

    # ultra-safe gate: must look like a UI route
    if not has_jsx(s):
      summary["tsx_skipped"].append((a, path, "SKIP: no JSX detected"))
      continue

    name = find_exported_component_name(s)
    if not name:
      summary["tsx_skipped"].append((a, path, "SKIP: no exported component found (export function/const)"))
      continue

    out, changed = patch_add_default_export(path, s, name)
    if not changed:
      continue

    if not DRY:
      backup(path)
      with open(path, "w", encoding="utf-8") as f:
        f.write(out)

    summary["tsx_patched"].append((a, path, name))

print("\n[da-routes] RESULTS")
print(f"- orders-demo.ts fixed (removed .ts + wrote orders-demo.tsx): {len(summary['orders_demo_ts_fixed'])}")
for a, ts_path, tsx_path in summary["orders_demo_ts_fixed"][:80]:
  print(f"  FIXED [{a}]: {ts_path}  ->  {tsx_path}")

print(f"\n- .tsx patched (added export default <Component>): {len(summary['tsx_patched'])}")
for a, p, name in summary["tsx_patched"][:120]:
  print(f"  PATCHED [{a}]: {p}  (default={name})")
if len(summary["tsx_patched"]) > 120:
  print("  ... (truncated)")

print(f"\n- .tsx skipped: {len(summary['tsx_skipped'])}")
for a, p, reason in summary["tsx_skipped"][:80]:
  print(f"  {reason} :: [{a}] {p}")
if len(summary["tsx_skipped"]) > 80:
  print("  ... (more skips not shown)")

print(f"\n- .ts route files (report only, not modified): {len(summary['ts_report_only'])}")
for a, p in summary["ts_report_only"][:120]:
  print(f"  REPORT [{a}]: {p}")
if len(summary["ts_report_only"]) > 120:
  print("  ... (truncated)")

print(f"\n[da-routes] DRY_RUN={DRY} | backups_dir={BACKUP_DIR}")
PY

log "Done."
cat <<'NEXT'

NEXT:
1) Restart metro with --clear:
   cd /opt/delishafrica/monorepo/apps/client   && pnpm dev -- --tunnel --port 8081 --clear
   cd /opt/delishafrica/monorepo/apps/courier  && pnpm dev -- --tunnel --port 8082 --clear
   cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear

2) iPhone: swipe-close complet + rescan QR.

Rollback:
- backups in: /opt/delishafrica/monorepo/.backups/da_autofix_routes_default_export_safe_<timestamp>/
NEXT
