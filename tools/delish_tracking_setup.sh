#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <chemin_vers_delishafrica_code_skeleton.zip> [--force]"
  exit 1
}

ZIP="${1:-}"; [[ -z "${ZIP}" ]] && usage
FORCE="${2:-}"

if [[ ! -f "$ZIP" ]]; then
  echo "❌ Fichier introuvable: $ZIP"
  echo "   Vérifie le chemin (ls -lh \"$ZIP\")."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Rendre le repo 'safe' pour Git si nécessaire (cas root vs owner).
git status >/dev/null 2>&1 || {
  git config --global --add safe.directory "$REPO_ROOT"
}

TMP_DIR="$(mktemp -d)"
cleanup(){ rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "➡️  Décompression du skeleton dans: $TMP_DIR"
unzip -q "$ZIP" -d "$TMP_DIR"

# Le ZIP peut contenir templates/, tools/, docs/ ... on fusionne prudemment.
copy_dir() {
  local src="$1" dst="$2"
  [[ -d "$src" ]] || return 0
  mkdir -p "$dst"
  if [[ "$FORCE" == "--force" ]]; then
    rsync -a "$src"/ "$dst"/
  else
    rsync -a --ignore-existing "$src"/ "$dst"/
  fi
}

for dir in templates tools docs; do
  copy_dir "$TMP_DIR/$dir" "$REPO_ROOT/$dir"
done

# Optionnel: hooks/ ou scripts/ si existants dans le skeleton
for dir in scripts hooks; do
  copy_dir "$TMP_DIR/$dir" "$REPO_ROOT/$dir"
done

# Droits d'exécution pour les scripts importés
find "$REPO_ROOT/tools" -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
find "$REPO_ROOT/scripts" -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# Commit si des changements
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add .
  git commit -m "chore(tracking): import skeleton from $(basename "$ZIP")"
  echo "✅ Skeleton importé et commit effectué."
else
  echo "ℹ️  Aucun changement à committer (déjà en place)."
fi
