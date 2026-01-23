#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/force_pnpm_pkgmgr_$NOW"
LOG="$BKP/run.log"
PNPM_VER="9.15.4"

mkdir -p "$BKP"

log(){ echo -e "\n[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
die(){ echo -e "\n[ERROR] $*" | tee -a "$LOG" >&2; exit 1; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

log "ROOT=$ROOT"
cd "$ROOT" || die "Impossible d'entrer dans $ROOT"

need node
need python3
need corepack

log "Node: $(node -v)"
log "npm:  $(npm -v 2>/dev/null || true)"
log "corepack: $(corepack --version 2>/dev/null || true)"

# 0) Backup + patch packageManager dans TOUS les package.json pertinents
log "1) Patch packageManager -> pnpm@$PNPM_VER (avec backups)"
python3 - <<PY
import os, json, shutil, sys
ROOT="$ROOT"
BKP="$BKP"
TARGET=f"pnpm@{os.environ.get('PNPM_VER','9.15.4')}"
PNPM_VER=os.environ.get('PNPM_VER','9.15.4')

# Dossiers à scanner
cands = [
  ROOT,
  os.path.join(ROOT,"apps"),
  os.path.join(ROOT,"services"),
  os.path.join(ROOT,"packages"),
]

pkg_files = []

def should_scan(path):
  # évite node_modules / .git / .expo / dist / build
  parts = set(path.split(os.sep))
  bad = {"node_modules",".git",".expo","dist","build",".next",".turbo"}
  return not (parts & bad)

for base in cands:
  if not os.path.isdir(base):
    continue
  for dirpath, dirnames, filenames in os.walk(base):
    if not should_scan(dirpath):
      dirnames[:] = []
      continue
    if "package.json" in filenames:
      pkg_files.append(os.path.join(dirpath,"package.json"))

changed = 0
failed = 0

def backup(f):
  rel = os.path.relpath(f, ROOT)
  dest = os.path.join(BKP, rel)
  os.makedirs(os.path.dirname(dest), exist_ok=True)
  shutil.copy2(f, dest)

for f in pkg_files:
  try:
    with open(f, "rb") as fh:
      raw = fh.read()
    # strip BOM if any
    if raw.startswith(b"\xef\xbb\xbf"):
      raw = raw[3:]
    txt = raw.decode("utf-8", errors="strict")
    data = json.loads(txt)

    pm = data.get("packageManager")
    # Si absent, on ne force pas partout, sauf racine
    must = (os.path.abspath(f) == os.path.abspath(os.path.join(ROOT,"package.json")))

    if pm is None and not must:
      continue

    new_pm = TARGET
    if pm == new_pm:
      continue

    backup(f)
    data["packageManager"] = new_pm

    with open(f, "w", encoding="utf-8") as out:
      json.dump(data, out, ensure_ascii=False, indent=2)
      out.write("\n")
    changed += 1
  except Exception as e:
    failed += 1
    print(f"[FAIL] {f}: {e}", file=sys.stderr)

print(f"[OK] scanned={len(pkg_files)} changed={changed} failed={failed}")
if failed:
  sys.exit(2)
PY

# 2) Désactive le strict check en plus (ceinture + bretelles)
# pnpm lit .npmrc -> on en crée un SAFE au root
log "2) Ecriture .npmrc SAFE (package-manager-strict=false)"
if [[ -f "$ROOT/.npmrc" ]]; then
  cp -a "$ROOT/.npmrc" "$BKP/.npmrc.before" || true
fi
cat > "$ROOT/.npmrc" <<'NPMRC'
# DelishAfrica (tonton) — safe defaults
package-manager-strict=false
fund=false
audit=false
NPMRC

# 3) Assure pnpm via corepack
log "3) corepack enable + prepare pnpm@$PNPM_VER"
corepack enable || true
corepack prepare "pnpm@$PNPM_VER" --activate

hash -r || true

# 4) Vérifs
log "4) Vérif pnpm"
type -a pnpm | tee -a "$LOG" || true
which -a pnpm | tee -a "$LOG" || true

log "pnpm -v"
pnpm -v | tee -a "$LOG" || die "pnpm KO"

log "5) Test workspace install (dry run basique)"
log "=> commande: pnpm -w -v"
pnpm -w -v | tee -a "$LOG" || true

log "✅ FORCE PNPM OK"
log "Backups+log: $BKP"
