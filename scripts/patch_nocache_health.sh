#!/usr/bin/env bash
set -euo pipefail

API_DIR="services/api"
MAIN_TS="$API_DIR/src/main.ts"

cd ~/delishafrica-monorepo

# Backup
cp -a "$MAIN_TS" "$MAIN_TS.bak.$(date +%s)"

# Assure l'import des types Express (si absent)
grep -q "from 'express'" "$MAIN_TS" || \
  sed -i "1s|^|import type { Request, Response, NextFunction } from 'express';\n|" "$MAIN_TS"

# Injecte un middleware no-cache pour /api/health AVANT le premier "await app.listen("
perl -0777 -pe 's|await app\.listen\(|(function(){\n  const _nocache = (req: Request, res: Response, next: NextFunction) => {\n    if (req.originalUrl && req.originalUrl.startsWith(\"/api/health\")) {\n      res.setHeader(\"Cache-Control\", \"no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0\");\n      res.setHeader(\"Pragma\", \"no-cache\");\n      res.setHeader(\"Expires\", \"0\");\n    }\n    next();\n  };\n  (app as any).use(_nocache);\n})();\n\nawait app.listen(|s' -i "$MAIN_TS"

echo "✓ Middleware no-cache injecté dans $MAIN_TS"
