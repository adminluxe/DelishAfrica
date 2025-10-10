#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-/opt/delishafrica/delishafrica-monorepo}"
cd "$ROOT"

say(){ echo "➡️  $*"; }
ok(){ echo "✅ $*"; }
die(){ echo "❌ $*" >&2; exit 1; }

[ -f pnpm-workspace.yaml ] || die "Pas de pnpm-workspace.yaml dans $ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUTDIR="docs"
mkdir -p "$OUTDIR"
SNAP="$OUTDIR/REPO_SNAPSHOT_${STAMP}.md"

say "Génère l'inventaire → $SNAP"
{
  echo "# DelishAfrica — Snapshot du repo ($STAMP)"
  echo
  echo "Racine: \`$ROOT\`"
  echo
  echo "## 1) Arbo courante (profondeur limitée)"
  echo '```'
  # tree peut ne pas être installé; on simule
  find . -maxdepth 3 -type d | sed 's#^\./##' | sort
  echo '```'
  echo
  echo "## 2) Workspaces PNPM"
  echo '```yaml'
  sed -n '1,200p' pnpm-workspace.yaml
  echo '```'
  echo
  echo "## 3) packages.json notables"
  for p in $(grep -RIl --include="package.json" '"name"' apps packages services 2>/dev/null | sort); do
    echo "### $p"
    echo '```json'
    sed -n '1,80p' "$p"
    echo '```'
  done
  echo
  echo "## 4) Compose/Dockerfiles"
  echo '```'
  ls -1 docker-compose*.yml docker*/*.yml 2>/dev/null || true
  echo '```'
} > "$SNAP"

ok "Snapshot généré."

# Git minimal (non destructif)
if [ ! -d .git ]; then
  say "Repo git non initialisé → git init"
  git init -b main
  git add -A
  git commit -m "chore(snapshot): initial commit $STAMP"
  ok "Git initialisé."
else
  say "Repo git déjà initialisé → commit snapshot"
  git add -A
  git commit -m "chore(snapshot): snapshot $STAMP" || true
fi

git tag -f "snapshot-$STAMP" >/dev/null 2>&1 || true
ok "Tag créé: snapshot-$STAMP"

echo
ok "Fini. Fichier: $SNAP"
echo "Pour pousser ensuite :"
echo "  git remote add origin <git-url>   # si pas encore fait"
echo "  git push -u origin main --tags"
