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

# 1) Trouver les fichiers qui contiennent la route demo/get ou un @Post('get') dans un controller OrdersDemo*
mapfile -t CANDIDATES < <(
  grep -RIl --include="*.ts" --include="*.tsx" -E "demo/get|@Post\\(['\\\"]get['\\\"]\\)|OrdersDemo.*Controller" "$SRC" \
  | while read -r f; do
      # on garde ceux qui ont aussi une trace de get/status (sinon trop large)
      if grep -Eq "@Post\\(['\\\"]get['\\\"]\\)|@Post\\(['\\\"]status['\\\"]\\)|demo/status|demo/get" "$f"; then
        echo "$f"
      fi
    done
)

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "✗ Aucun fichier candidat trouvé pour patcher get/status." >&2
  echo "  Astuce: grep -RIn \"orders/demo/get\" \"$SRC\" | head" >&2
  exit 1
fi

echo "✓ Candidates:"
printf "  - %s\n" "${CANDIDATES[@]}"

# 2) Patch TS ultra safe: dans les méthodes @Post('get') et @Post('status'),
#    remplacer destructuring orderId par un extracteur tolérant: body.orderId || body.id || body.order.id
LISTFILE="$BK/candidates.txt"
printf "%s\n" "${CANDIDATES[@]}" > "$LISTFILE"

python3 - <<'PY'
import re
import shutil
from pathlib import Path

bk = Path(r"""'"$BK"'''""")
files = [Path(x.strip()) for x in (bk/"candidates.txt").read_text().splitlines() if x.strip()]

def backup(p: Path):
  shutil.copy2(p, bk / (p.name + ".bak"))

def patch_method_block(lines, start_idx, max_lines=220):
  """
  Patch a method block starting around an annotation line.
  We apply only inside a bounded window to avoid global changes.
  """
  end = min(len(lines), start_idx + max_lines)
  block = "".join(lines[start_idx:end])

  changed = False

  # A) Remplacer "const { orderId } = body" ou "const { orderId, status } = body"
  #    par extracteur robuste.
  #    On accepte aussi "const { id } = body"
  patterns = [
    (r"const\s*\{\s*orderId\s*\}\s*=\s*body\s*;",
     "const orderId = body?.orderId ?? body?.id ?? body?.order?.id;\n    if (!orderId) return { ok: false, error: 'bad_request' };\n"),
    (r"const\s*\{\s*orderId\s*,\s*status\s*\}\s*=\s*body\s*;",
     "const orderId = body?.orderId ?? body?.id ?? body?.order?.id;\n    const status = body?.status;\n    if (!orderId || !status) return { ok: false, error: 'bad_request' };\n"),
    (r"const\s*\{\s*id\s*\}\s*=\s*body\s*;",
     "const orderId = body?.orderId ?? body?.id ?? body?.order?.id;\n    if (!orderId) return { ok: false, error: 'bad_request' };\n"),
  ]
  for pat, rep in patterns:
    if re.search(pat, block):
      block2 = re.sub(pat, rep, block)
      if block2 != block:
        block = block2
        changed = True

  # B) Si aucun destructuring trouvé, injecter un orderId robuste
  #    juste après l'ouverture de fonction si on voit "body" utilisé.
  if "orderId =" not in block and re.search(r"\bbody\b", block) and ("@Post('get')" in block or '@Post("get")' in block or "@Post('status')" in block or '@Post("status")' in block):
    # On tente d'injecter après la première ligne contenant "{"
    m = re.search(r"\{\s*\n", block)
    if m:
      insert = "    const orderId = body?.orderId ?? body?.id ?? body?.order?.id;\n    if (!orderId) return { ok: false, error: 'bad_request' };\n"
      block = block[:m.end()] + insert + block[m.end():]
      changed = True

  # C) Remplacer les usages fréquents dans le bloc (borné) : body.orderId / body.id / body.order.id -> orderId
  #    (uniquement si on a introduit orderId)
  if "const orderId" in block:
    block2 = re.sub(r"\bbody\.orderId\b", "orderId", block)
    block2 = re.sub(r"\bbody\.id\b", "orderId", block2)
    block2 = re.sub(r"\bbody\.order\.id\b", "orderId", block2)
    if block2 != block:
      block = block2
      changed = True

  return block, changed, start_idx, end

def patch_file(p: Path):
  txt = p.read_text(encoding="utf-8", errors="replace").splitlines(True)
  changed_any = False
  out = txt[:]  # mutable copy

  # On repère les zones autour de @Post('get') et @Post('status')
  anchors = []
  for i, line in enumerate(txt):
    if re.search(r"@Post\(['\"]get['\"]\)", line) or re.search(r"@Post\(['\"]status['\"]\)", line):
      anchors.append(i)

  if not anchors:
    return False, 0

  # On patch chaque bloc ancré
  patches = []
  for a in anchors:
    block, changed, s, e = patch_method_block(out, a, max_lines=240)
    if changed:
      patches.append((s, e, block))

  if not patches:
    return False, 0

  # Appliquer les patches du bas vers le haut (pour éviter décalages)
  for s, e, block in sorted(patches, key=lambda x: x[0], reverse=True):
    out[s:e] = [block]
    changed_any = True

  if changed_any:
    backup(p)
    p.write_text("".join(out), encoding="utf-8")
    return True, len(patches)
  return False, 0

total_files = 0
total_blocks = 0
for f in files:
  ok, nb = patch_file(f)
  if ok:
    total_files += 1
    total_blocks += nb
    print(f"PATCHED {f} blocks={nb}")

print(f"PATCH_SUMMARY files_modified={total_files} blocks_modified={total_blocks}")
PY

echo "✓ Patch terminé."
echo "👉 Si tu exécutes l'API en mode dev, redémarre la fenêtre API (Ctrl+C puis relance). Si PM2: pm2 restart <name>."
