#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/_snapshots/$TS"
mkdir -p "$OUT"

echo "▶︎ Snapshot: $OUT"

# 1) Etat git si dispo
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git status --porcelain > "$OUT/git_status.txt" || true
  git diff > "$OUT/git_diff.patch" || true

  # 2) Archive des fichiers modifiés + non trackés (hors gros dossiers)
  FILES="$(git ls-files -m -o --exclude-standard || true)"
  if [[ -n "$FILES" ]]; then
    echo "$FILES" > "$OUT/files_list.txt"
    tar -czf "$OUT/files.tgz" \
      --exclude='**/node_modules' \
      --exclude='**/.expo' \
      --exclude='**/.turbo' \
      --exclude='**/dist' \
      --exclude='**/build' \
      --exclude='**/.next' \
      $FILES
  else
    echo "(aucun fichier modifié/untracked)" > "$OUT/files_list.txt"
  fi
else
  echo "⚠️ Pas de repo git détecté. Snapshot minimal: liste fichiers récents."
  find "$ROOT" -maxdepth 4 -type f -printf '%T@ %p\n' | sort -nr | head -200 > "$OUT/recent_files.txt"
fi

echo "✅ OK"
