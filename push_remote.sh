#!/usr/bin/env bash
set -euo pipefail

# 1) Identité git si manquante
git config user.name  >/dev/null || git config user.name  "DelishAfrica Dev"
git config user.email >/dev/null || git config user.email "dev@delish.africa"

# 2) Demande l’URL du remote si absent (HTTPS ou SSH)
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Aucun remote 'origin' configuré."
  echo "Colle l’URL du repo GitHub (ex. https://github.com/<user>/DelishAfrica.git ou git@github.com:<user>/DelishAfrica.git):"
  read -r REMOTE_URL
  git remote add origin "$REMOTE_URL"
else
  echo "Remote 'origin' déjà présent: $(git remote get-url origin)"
fi

# 3) Définit la branche par défaut sur main et push upstream
git branch -M main
git push -u origin main

echo "✓ Push effectué sur 'origin/main'."
