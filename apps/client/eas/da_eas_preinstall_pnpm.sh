#!/usr/bin/env bash
set -euo pipefail
echo "[DA] eas-build-pre-install: enable corepack + pnpm"
corepack enable || true
corepack prepare "pnpm@9.15.4" --activate || true
pnpm -v || true
