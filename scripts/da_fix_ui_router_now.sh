#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

APPS=(client courier merchant)

echo "== Backup (ui folders) =="
BK="$ROOT/backups/ui_router_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BK"
for a in "${APPS[@]}"; do
  tar -czf "$BK/${a}_app.tgz" -C "$ROOT/apps/$a" app >/dev/null 2>&1 || true
done
echo "Backups: $BK"

echo
echo "== Merge ui -> +ui, then remove ui =="
for a in "${APPS[@]}"; do
  D="$ROOT/apps/$a/app"

  if [ -d "$D/ui" ] && [ -d "$D/+ui" ]; then
    echo "[$a] merging ui/ into +ui/"
    rsync -a "$D/ui/" "$D/+ui/"
    rm -rf "$D/ui"
  elif [ -d "$D/ui" ] && [ ! -d "$D/+ui" ]; then
    echo "[$a] renaming ui -> +ui"
    mv "$D/ui" "$D/+ui"
  else
    echo "[$a] ok (no ui/ conflict)"
  fi
done

echo
echo "== Rewrite relative imports: ./ui/ or ../ui/ -> ./+ui/ or ../+ui/ =="
for a in "${APPS[@]}"; do
  BASE="$ROOT/apps/$a"
  files=$(rg -l "(['\"])\\./ui/|(['\"])\\.\\./ui/" "$BASE" -g'*.{ts,tsx,js,jsx}' || true)
  if [ -n "${files:-}" ]; then
    echo "[$a] patching imports in:"
    echo "$files" | sed 's/^/  - /'
    echo "$files" | xargs -r perl -pi -e 's#(\.\/|\.\.\/)ui\/#$1+ui/#g'
  else
    echo "[$a] no imports to patch"
  fi
done

echo
echo "== Sanity check (folders) =="
for a in "${APPS[@]}"; do
  echo "[$a] app folders:"
  (ls -la "$ROOT/apps/$a/app" | egrep " (\+ui|ui)$" || true)
done

echo
echo "== Remaining references check (should be empty) =="
for a in "${APPS[@]}"; do
  echo "[$a] ./ui/ refs:"
  (rg -n "(['\"])\\./ui/|(['\"])\\.\\./ui/" "$ROOT/apps/$a" -g'*.{ts,tsx,js,jsx}' || true)
done

echo
echo "OK. Next: restart Expo with --clear."
