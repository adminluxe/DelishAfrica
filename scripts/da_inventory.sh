#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/opt/delishafrica/monorepo}"
OUT="${ROOT}/_snapshots/$(date -Is | tr ':' '-')"
mkdir -p "$OUT"

report="$OUT/inventory.txt"
exec > >(tee -a "$report") 2>&1

echo "===== INVENTORY $(date -Is) ====="
echo "ROOT: $ROOT"
echo

detect_git () {
  local dir="$1"
  if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "GIT: yes"
    echo "BRANCH: $(git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    echo "LAST: $(git -C "$dir" log -1 --oneline --decorate 2>/dev/null || true)"
    echo "STATUS:"
    git -C "$dir" status -sb 2>/dev/null || true
  else
    echo "GIT: no"
  fi
}

list_scripts () {
  local dir="$1"
  if [ -f "$dir/package.json" ] && command -v node >/dev/null 2>&1; then
    # IMPORTANT: node "-" => le path utile est process.argv[2]
    node - "$dir" <<'NODE' || true
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) process.exit(0);

const pj = path.join(dir, 'package.json');
const p = JSON.parse(fs.readFileSync(pj,'utf8'));

console.log(`name: ${p.name || '(none)'}`);
console.log(`version: ${p.version || '(none)'}`);
console.log('scripts:');
const s = p.scripts || {};
Object.keys(s).sort().forEach(k => console.log(`  ${k}: ${s[k]}`));
NODE
  fi
}

extract_env_keys () {
  local dir="$1"
  command -v rg >/dev/null 2>&1 || return 0

  rg -No --hidden --glob '!**/node_modules/**' \
    'process\.env\.([A-Z0-9_]{2,})|EXPO_PUBLIC_[A-Z0-9_]{2,}|NEXT_PUBLIC_[A-Z0-9_]{2,}|VITE_[A-Z0-9_]{2,}' \
    "$dir" 2>/dev/null \
  | sed -E 's/.*process\.env\.([A-Z0-9_]{2,}).*/\1/; s/.*\b(EXPO_PUBLIC_[A-Z0-9_]{2,})\b.*/\1/; s/.*\b(NEXT_PUBLIC_[A-Z0-9_]{2,})\b.*/\1/; s/.*\b(VITE_[A-Z0-9_]{2,})\b.*/\1/' \
  | awk 'NF' \
  | sort -u
}

present_env_keys () {
  local dir="$1"
  ( find "$dir" -maxdepth 2 -type f \( -name ".env" -o -name ".env.local" -o -name ".env.*" \) -print0 2>/dev/null \
    | xargs -0 -r cat 2>/dev/null \
    | sed -nE 's/^([A-Z0-9_]{2,})=.*/\1/p' \
    | sort -u ) || true
}

audit_dir () {
  local dir="$1"
  echo "=============================="
  echo "DIR: $dir"
  [ -f "$dir/package.json" ] && echo "package.json: yes" || echo "package.json: no"
  detect_git "$dir"
  echo
  echo "---- package scripts ----"
  list_scripts "$dir"
  echo
  echo "---- env files (presence) ----"
  find "$dir" -maxdepth 2 -type f \( -name ".env" -o -name ".env.local" -o -name ".env.*" \) -print 2>/dev/null || true
  echo
  echo "---- env vars used (code) ----"
  used="$(mktemp)"
  pres="$(mktemp)"
  extract_env_keys "$dir" > "$used" || true
  present_env_keys "$dir" > "$pres" || true

  if [ -s "$used" ]; then
    echo "USED:"
    cat "$used"
    echo
    echo "MISSING (used - present):"
    comm -23 "$used" "$pres" || true
  else
    echo "(no env keys detected or rg missing)"
  fi
  rm -f "$used" "$pres"
  echo
}

echo "== Runtime =="
node -v 2>/dev/null || true
pnpm -v 2>/dev/null || true
echo

# Cibles directes
candidates=(
  "$ROOT"
  "$ROOT/apps/client"
  "$ROOT/apps/courier"
  "$ROOT/apps/merchant"
)

# OPS / Platform : scan large (au cas où)
for d in \
  "$ROOT/apps/platform" "$ROOT/apps/ops" "$ROOT/platform" "$ROOT/ops" \
  "$ROOT/delishafrica-ops" "$ROOT/ops-web" "$ROOT/apps/ops-web" \
  "/opt/delishafrica/ops" "/opt/delishafrica/platform" "/opt/delishafrica/delishafrica-ops"
do
  [ -d "$d" ] && candidates+=("$d")
done

# Détection automatique : packages dont le name contient ops/platform
if command -v rg >/dev/null 2>&1; then
  while IFS= read -r pj; do
    dir="$(dirname "$pj")"
    candidates+=("$dir")
  done < <(find "$ROOT" -maxdepth 6 -name package.json 2>/dev/null \
          | xargs -r rg -l '"name"\s*:\s*".*(ops|platform).*"' 2>/dev/null || true)
fi

# Dédupe
mapfile -t candidates < <(printf "%s\n" "${candidates[@]}" | awk 'NF' | sort -u)

echo "== COMPONENTS FOUND =="
printf "%s\n" "${candidates[@]}"
echo

for dir in "${candidates[@]}"; do
  [ -d "$dir" ] || continue
  audit_dir "$dir"
done

echo "Inventory saved to: $report"
