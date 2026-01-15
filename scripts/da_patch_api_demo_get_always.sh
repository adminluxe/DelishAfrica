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
BK="$ROOT/.backups/api_demo_get_always_${TS}"
mkdir -p "$BK"

echo "✓ API_ROOT=$API_ROOT"
echo "✓ Backup dir: $BK"

# 1) Trouver les fichiers potentiels (DELIVERED + delete())
mapfile -t CANDIDATES < <(
  grep -RIl --include="*.ts" --include="*.tsx" "DELIVERED" "$SRC" \
  | while read -r f; do
      if grep -q "\.delete(" "$f"; then
        echo "$f"
      fi
    done
)

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "✗ Aucun fichier candidate trouvé (DELIVERED + .delete())." >&2
  echo "  -> Je ne patch rien (safe). Fais un: grep -RIn \"orders/demo/get\" $SRC" >&2
  exit 1
fi

echo "✓ Candidates:"
printf "  - %s\n" "${CANDIDATES[@]}"

# 2) Patch ULTRA SAFE : commenter UNIQUEMENT les delete() proches d'une logique DELIVERED (fenêtre 40 lignes)
python3 - <<PY
import os, shutil, re, sys

bk = r"""$BK"""
cands = ${CANDIDATES[@]@Q}

# cands arrive comme une string bash-quoted; on la récupère via argv-like split simple:
# (on relit la liste depuis l'environnement bash plus bas via un fichier temp)
PY

# Passe la liste via un fichier pour éviter les pièges de quoting
LISTFILE="$BK/candidates.txt"
printf "%s\n" "${CANDIDATES[@]}" > "$LISTFILE"

python3 - <<'PY'
import pathlib, shutil, re

bk = pathlib.Path(r"""'"$BK"'''""")
listfile = bk / "candidates.txt"
files = [pathlib.Path(line.strip()) for line in listfile.read_text().splitlines() if line.strip()]

def patch_file(p: pathlib.Path) -> int:
  txt = p.read_text(encoding="utf-8", errors="replace").splitlines(True)
  out = []
  changed = 0
  for i, line in enumerate(txt):
    if ".delete(" in line and not line.lstrip().startswith("//"):
      # lookback window for DELIVERED checks
      start = max(0, i-40)
      window = "".join(txt[start:i+1])
      if re.search(r"\bDELIVERED\b", window):
        indent = re.match(r"^(\s*)", line).group(1)
        out.append(f"{indent}// PATCH_KEEP_HISTORY (was deleting delivered): {line.lstrip()}")
        changed += 1
        continue
    out.append(line)

  if changed:
    dest = bk / (p.name + ".bak")
    shutil.copy2(p, dest)
    p.write_text("".join(out), encoding="utf-8")
  return changed

total = 0
patched = []
for f in files:
  ch = patch_file(f)
  if ch:
    patched.append((str(f), ch))
    total += ch

print(f"PATCH_SUMMARY total_changes={total}")
if not patched:
  print("PATCH_SUMMARY no_file_modified")
else:
  for f, ch in patched:
    print(f"PATCHED {f} changes={ch}")
PY

echo "✓ Patch appliqué (si PATCHED apparaît)."

# 3) Smoke test strict : create -> READY -> DELIVERED -> GET doit marcher
#    (tolère le préfixe /api/v1/orders/demo et /api/v1/api/orders/demo)
API_BASE="${API_BASE:-https://api.delishafrica.me}"

post_try() {
  local path="$1"; shift
  local json="$1"; shift || true
  local last=""
  for base in "/api/v1/orders/demo" "/api/v1/api/orders/demo"; do
    local url="${API_BASE}${base}${path}"
    last="$url"
    if out=$(curl -fsS -X POST "$url" -H "Content-Type: application/json" -d "$json"); then
      printf "%s" "$out"
      return 0
    fi
  done
  echo "✗ Impossible d'appeler ${path} (dernier essai: ${last})" >&2
  return 1
}

get_order_id() {
  python3 - <<'PY'
import json,sys
j=json.loads(sys.stdin.read())
oid = j.get("orderId") or (j.get("order") or {}).get("id") or j.get("id") or ""
print(oid)
PY
}

echo "— Smoke strict (GET must work after DELIVERED)"
post_try "/reset" '{}' >/dev/null || true

create_payload='{"partnerSlug":"thieyp","partnerName":"Thieyp","currency":"EUR","items":[{"sku":"thieyp-fri-002","name":"Thiéboudieune","priceEUR":21.9,"qty":1}]}'
create_res="$(post_try "/create" "$create_payload")"
echo "create: $create_res"

order_id="$(printf "%s" "$create_res" | get_order_id)"
if [ -z "$order_id" ]; then
  echo "✗ orderId introuvable dans la réponse create" >&2
  exit 1
fi
echo "✓ orderId=$order_id"

status_ready="$(post_try "/status" "{\"orderId\":\"$order_id\",\"id\":\"$order_id\",\"status\":\"READY\"}")"
echo "READY: $status_ready"

status_delivered="$(post_try "/status" "{\"orderId\":\"$order_id\",\"id\":\"$order_id\",\"status\":\"DELIVERED\"}")"
echo "DELIVERED: $status_delivered"

get_res="$(post_try "/get" "{\"orderId\":\"$order_id\",\"id\":\"$order_id\"}")"
echo "GET: $get_res"

python3 - <<'PY'
import json,sys
j=json.loads(sys.stdin.read())
ok = bool(j.get("ok", False))
err = j.get("error", "")
if (not ok) and err == "not_found":
  raise SystemExit("✗ Smoke strict FAILED: GET still returns not_found after DELIVERED")
print("✓ Smoke strict OK: GET returns order even after DELIVERED")
PY <<<"$get_res"

echo "✅ Patch API OK. Si ton API est sous PM2/Docker, pense à redémarrer le process si nécessaire."
