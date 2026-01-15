#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
TS="$(date -Is | tr ':' '-')"
OUT_DIR="${ROOT}/_snapshots/${TS}"
mkdir -p "${OUT_DIR}"

log="${OUT_DIR}/snapshot.txt"
exec > >(tee -a "${log}") 2>&1

echo "===== SNAPSHOT ${TS} ====="
echo "ROOT: ${ROOT}"
echo

echo "== SYSTEM =="
uname -a || true
echo "DATE: $(date)"
echo

echo "== RUNTIME =="
command -v node >/dev/null 2>&1 && echo "node: $(node -v)" || echo "node: missing"
command -v pnpm >/dev/null 2>&1 && echo "pnpm: $(pnpm -v)" || echo "pnpm: missing"
command -v npm  >/dev/null 2>&1 && echo "npm:  $(npm -v)"  || echo "npm: missing"
command -v yarn >/dev/null 2>&1 && echo "yarn: $(yarn -v)" || echo "yarn: missing"
command -v turbo >/dev/null 2>&1 && echo "turbo: $(turbo --version)" || true
echo

echo "== GIT (root) =="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "BRANCH: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  echo "LAST COMMIT:"
  git --no-pager log -1 --oneline --decorate || true
  echo
  echo "STATUS:"
  git status -sb || true
  echo
  echo "REMOTES:"
  git remote -v || true
  echo
  echo "SUBMODULES:"
  git submodule status || true
  echo
else
  echo "Not a git repo here."
  echo
fi

echo "== FILES (package managers) =="
ls -la package.json pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null || true
echo

echo "== SCRIPTS (root package.json) =="
if [ -f package.json ] && command -v node >/dev/null 2>&1; then
  node - <<'NODE' || true
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json','utf8'));
console.log(`name: ${p.name || '(none)'}`);
console.log(`version: ${p.version || '(none)'}`);
console.log('scripts:');
const s = p.scripts || {};
Object.keys(s).sort().forEach(k => console.log(`  ${k}: ${s[k]}`));
NODE
fi
echo

echo "== ENV FILES (presence only) =="
find "${ROOT}" -maxdepth 3 -type f \( -name ".env" -o -name ".env.local" -o -name ".env.*" \) -print -exec ls -la {} \; 2>/dev/null || true
echo

echo "== PORTS (listening) =="
command -v ss >/dev/null 2>&1 && ss -ltnp | sed -n '1,200p' || true
echo

echo "== PROCESSES (expo/metro/node) =="
ps aux | egrep -i "expo|metro|node|turbo|cloudflared|pm2|docker" | head -n 200 || true
echo

echo "== DOCKER (if any) =="
command -v docker >/dev/null 2>&1 && {
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' || true
  echo
  docker compose ps || true
} || true
echo

echo "== HEALTH PROBES (best effort) =="
API_PORT="${API_PORT:-3010}"
for u in \
  "http://127.0.0.1:${API_PORT}/api/health" \
  "http://127.0.0.1:${API_PORT}/api/v1/health" \
  "https://api.delishafrica.me/api/health" \
  "https://api.delishafrica.me/api/v1/health"
do
  echo "-- $u"
  curl -fsS -m 5 "$u" || echo "FAIL"
  echo
done

echo "== DONE =="
echo "Snapshot saved to: ${OUT_DIR}"
