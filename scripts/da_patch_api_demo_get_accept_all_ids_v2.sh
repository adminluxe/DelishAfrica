#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

pick_api_root() {
  local c
  for c in "services/api-nest" "services/api" "services/api-rest"; do
    if [ -d "$ROOT/$c/src" ]; then
      echo "$ROOT/$c"
      return 0
    fi
  done
  return 1
}

API_ROOT="$(pick_api_root || true)"
if [ -z "${API_ROOT:-}" ]; then
  echo "✗ API root introuvable (attendu: $ROOT/services/api-nest|api|api-rest avec /src)" >&2
  exit 1
fi

SRC="$API_ROOT/src"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backups/api_demo_accept_all_ids_${TS}"
mkdir -p "$BK"

echo "✓ API_ROOT=$API_ROOT"
echo "✓ Backup dir: $BK"

mapfile -t CANDIDATES < <(
  grep -RIl --include="*.ts" -E "OrdersDemoFlowController|demo/get|@Post\\(['\\\"]get['\\\"]\\)" "$SRC" || true
)

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "✗ Aucun fichier candidat trouvé." >&2
  exit 1
fi

echo "✓ Candidates:"
printf "  - %s\n" "${CANDIDATES[@]}"

LISTFILE="$BK/candidates.txt"
printf "%s\n" "${CANDIDATES[@]}" > "$LISTFILE"

BK="$BK" LISTFILE="$LISTFILE" python3 - <<'PY'
import os, re, shutil
from pathlib import Path

bk = Path(os.environ["BK"])
listfile = Path(os.environ["LISTFILE"])
files = [Path(x.strip()) for x in listfile.read_text().splitlines() if x.strip()]

def backup(p: Path):
  shutil.copy2(p, bk / (p.name + ".bak"))

def patch_file(p: Path):
  txt = p.read_text(encoding="utf-8", errors="replace").splitlines(True)
  out = txt[:]
  changed = False

  # Patch ONLY around @Post('get') and @Post('status') areas (bounded windows)
  anchors = [i for i,l in enumerate(out) if re.search(r"@Post\(['\"](get|status)['\"]\)", l)]
  if not anchors:
    return False

  def patch_window(start, span=240):
    nonlocal changed, out
    end = min(len(out), start + span)
    block = "".join(out[start:end])

    # Replace destructuring patterns
    repls = [
      (r"const\s*\{\s*orderId\s*\}\s*=\s*body\s*;",
       "const orderId = body?.orderId ?? body?.id ?? body?.order?.id;\n    if (!orderId) return { ok: false, error: 'bad_request' };\n"),
      (r"const\s*\{\s*orderId\s*,\s*status\s*\}\s*=\s*body\s*;",
       "const orderId = body?.orderId ?? body?.id ?? body?.order?.id;\n    const status = body?.status;\n    if (!orderId || !status) return { ok: false, error: 'bad_request' };\n"),
      (r"const\s*\{\s*id\s*\}\s*=\s*body\s*;",
       "const orderId = body?.orderId ?? body?.id ?? body?.order?.id;\n    if (!orderId) return { ok: false, error: 'bad_request' };\n"),
    ]
    for pat, rep in repls:
      if re.search(pat, block):
        block2 = re.sub(pat, rep, block)
        if block2 != block:
          block = block2
          changed = True

    # If we introduced orderId, normalize common reads
    if "const orderId" in block:
      block2 = re.sub(r"\bbody\.orderId\b", "orderId", block)
      block2 = re.sub(r"\bbody\.id\b", "orderId", block2)
      block2 = re.sub(r"\bbody\.order\.id\b", "orderId", block2)
      if block2 != block:
        block = block2
        changed = True

    out[start:end] = [block]

  for a in sorted(anchors, reverse=True):
    patch_window(a)

  if changed:
    backup(p)
    p.write_text("".join(out), encoding="utf-8")
  return changed

patched = 0
for f in files:
  if patch_file(f):
    patched += 1
    print("PATCHED", f)

print(f"PATCH_SUMMARY files_modified={patched}")
PY

echo "✅ Patch terminé."
echo "👉 Redémarre ton process API (dev: Ctrl+C + relance, ou PM2)."
