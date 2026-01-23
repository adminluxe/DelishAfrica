#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/add_rngh_dep_$TS"
LOG="$BK/run.log"

mkdir -p "$BK"
exec > >(tee -a "$LOG") 2>&1

echo "=== TONTON: add react-native-gesture-handler as DIRECT dependency ==="
echo "ROOT=$ROOT"
echo "BACKUP=$BK"
echo "LOG=$LOG"
echo

cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node introuvable"
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "❌ pnpm introuvable"
  exit 1
fi

# Get currently installed version (avoid mismatch)
RNGH_VER="$(node -p "require('react-native-gesture-handler/package.json').version" 2>/dev/null || true)"
if [[ -z "${RNGH_VER:-}" ]]; then
  echo "❌ react-native-gesture-handler n'est pas présent dans node_modules."
  echo "➡️ Essaie: cd '$ROOT' && npx expo install react-native-gesture-handler"
  exit 2
fi

echo "Detected react-native-gesture-handler version: $RNGH_VER"
echo

APPS=(client merchant courier)

# Backup package.json files
cp -a "$ROOT/package.json" "$BK/package.json.root.bak" || true
for app in "${APPS[@]}"; do
  if [[ -f "$ROOT/apps/$app/package.json" ]]; then
    mkdir -p "$BK/apps/$app"
    cp -a "$ROOT/apps/$app/package.json" "$BK/apps/$app/package.json.bak"
  fi
done

node - <<'NODE' "$ROOT" "$RNGH_VER"
const fs = require("fs");
const path = require("path");

const root = process.argv[1];
const ver = process.argv[2];
const apps = ["client","merchant","courier"];

function patchPkg(p) {
  const txt = fs.readFileSync(p, "utf8");
  const j = JSON.parse(txt);
  j.dependencies = j.dependencies || {};
  if (!j.dependencies["react-native-gesture-handler"]) {
    j.dependencies["react-native-gesture-handler"] = ver; // exact, safe
    return { changed: true, json: j };
  }
  return { changed: false, json: j };
}

function writeJson(p, j) {
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
}

let changed = [];
for (const app of apps) {
  const p = path.join(root, "apps", app, "package.json");
  if (!fs.existsSync(p)) {
    console.log(`⚠️ Missing: ${p}`);
    continue;
  }
  const r = patchPkg(p);
  if (r.changed) {
    writeJson(p, r.json);
    changed.push(path.relative(root, p));
    console.log(`✅ Patched: ${path.relative(root, p)} (added react-native-gesture-handler@${ver})`);
  } else {
    console.log(`✅ OK already: ${path.relative(root, p)}`);
  }
}

// Also patch root package.json (optional but safe)
const rootPkg = path.join(root, "package.json");
if (fs.existsSync(rootPkg)) {
  const r = patchPkg(rootPkg);
  if (r.changed) {
    writeJson(rootPkg, r.json);
    changed.push("package.json");
    console.log(`✅ Patched: package.json (root)`);
  } else {
    console.log(`✅ OK already: package.json (root)`);
  }
}

console.log("\n=== SUMMARY ===");
console.log("Changed files:", changed.length);
for (const f of changed) console.log(" -", f);
NODE

echo
echo "➡️ Running pnpm install (workspace)…"
pnpm -w install

echo
echo "✅ Done."
echo "Next: rebuild Dev Clients iOS (EAS) pour que RNGH soit dans le binaire."
