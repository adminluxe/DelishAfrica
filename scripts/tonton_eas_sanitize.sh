#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date +%Y%m%d_%H%M%S)"
APPS=(client merchant courier)

sanitize_one() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "skip (missing): $f"
    return 0
  fi

  cp -a "$f" "$f.bak.$TS"

  node - "$f" <<'NODE'
const fs = require("fs");
const file = process.argv[2]; // IMPORTANT: argv[1] == "-" quand on fait "node -"
if (!file) process.exit(2);

const raw = fs.readFileSync(file, "utf8");
let j;
try { j = JSON.parse(raw); }
catch (e) { console.error("ERROR: JSON parse failed:", file); process.exit(2); }

if (j.build && typeof j.build === "object") {
  for (const prof of Object.values(j.build)) {
    if (prof && typeof prof === "object" && Object.prototype.hasOwnProperty.call(prof, "installCommand")) {
      delete prof.installCommand;
    }
  }
}

fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n");
NODE

  echo "patched: $f (installCommand removed if present)"
}

for app in "${APPS[@]}"; do
  sanitize_one "$ROOT/apps/$app/eas.json"
done

echo
echo "Sanity check: eas project:info (par app)"
for app in "${APPS[@]}"; do
  echo "== $app =="
  ( cd "$ROOT/apps/$app" && npx --yes eas project:info ) || true
  echo
done
