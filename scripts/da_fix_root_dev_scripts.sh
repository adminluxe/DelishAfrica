#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$ROOT/package.json"

if [ ! -f "$PKG" ]; then
  echo "❌ package.json introuvable: $PKG"
  exit 1
fi

TS="$(date +%Y%m%d_%H%M%S)"
cp "$PKG" "$PKG.bak.$TS"
echo "✅ Backup: $PKG.bak.$TS"

PKG="$PKG" node <<'NODE'
const fs = require("fs");

const pkgPath = process.env.PKG;
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.scripts = pkg.scripts || {};

const mk = (app, port) =>
  `pnpm --filter ./apps/${app} exec -- expo start --dev-client -c --tunnel --port ${port}`;

pkg.scripts["client:dev"]   = mk("client",   8081);
pkg.scripts["courier:dev"]  = mk("courier",  8082);
pkg.scripts["merchant:dev"] = mk("merchant", 8083);

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("✅ Scripts mis à jour:");
console.log(" - client:dev   -> 8081 tunnel");
console.log(" - courier:dev  -> 8082 tunnel");
console.log(" - merchant:dev -> 8083 tunnel");
NODE

echo "✅ OK"
