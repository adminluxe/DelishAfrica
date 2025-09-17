#!/usr/bin/env bash
set -euo pipefail

REPO_URL="git@github.com:adminluxe/DelishAfrica.git"
BRANCH="main"

# 0) Config git (inoffensif si déjà fait)
git config user.name  "DelishAfrica Dev" || true
git config user.email "dev@delish.africa" || true

# 1) Remote origin
if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
fi
echo "origin -> $(git remote get-url origin)"

# 2) Sur 'main'
git checkout -B "$BRANCH"

# 3) Récupère puis rebase en acceptant les histoires non liées
git fetch origin "$BRANCH" || true
if ! git pull --rebase --allow-unrelated-histories origin "$BRANCH"; then
  echo "⚠️ Conflits à résoudre. Utilise par ex.:"
  echo "   git status"
  echo "   # garder la version distante:   git checkout --theirs README.md && git add README.md"
  echo "   # garder la version locale:     git checkout --ours  README.md && git add README.md"
  echo "   git rebase --continue"
  exit 1
fi

# 4) Push + set upstream
git push -u origin "$BRANCH"
echo "✅ Sync OK."
