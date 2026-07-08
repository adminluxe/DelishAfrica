#!/usr/bin/env bash
set -euo pipefail
corepack enable
corepack prepare pnpm@9.12.1 --activate
pnpm -v
