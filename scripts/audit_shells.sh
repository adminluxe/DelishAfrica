#!/usr/bin/env bash
# ./scripts/audit_shells.sh
#!/usr/bin/env bash
if [ -z "${BASH_VERSION:-}" ]; then exec /bin/bash "$0" "$@"; fi
set -Eeuo pipefail
trap 'echo "[audit_shells] Erreur à la ligne $LINENO"; exit 1' ERR

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; BLU=$'\e[34m'; NC=$'\e[0m'
ROOT="$(pwd)"
MODIFIED_FILES=()

echo "${BLU}→ Audit des scripts .sh…${NC}"

# --- Collecte des fichiers .sh (git si dispo, sinon find) ---
declare -a SH_FILES=()
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r -d $'\0' f; do SH_FILES+=("$f"); done < <(git ls-files -z -- '*.sh')
else
  while IFS= read -r -d $'\0' f; do [[ "$f" == *"/node_modules/"* ]] && continue; SH_FILES+=("${f#./}"); done < <(find . -type f -name '*.sh' -print0)
fi

if ((${#SH_FILES[@]}==0)); then
  echo "${YLW}Aucun .sh trouvé. Rien à faire.${NC}"
  exit 0
fi

ensure_header() {
  local file="$1"
  local changed=0

  # 1) Normalise CRLF → LF
  if LC_ALL=C grep -q $'\r' "$file"; then
    sed -i 's/\r$//' "$file"; changed=1
  fi

  # 2) Shebang → #!/usr/bin/env bash
  local first; first="$(head -n1 "$file" || true)"
  if [[ "$first" == \#!* ]]; then
    if [[ "$first" != "#!/usr/bin/env bash" ]]; then
      awk 'NR==1{print "#!/usr/bin/env bash"; next} {print}' "$file" > "$file.__tmp" && mv "$file.__tmp" "$file"; changed=1
    fi
  else
    { echo '#!/usr/bin/env bash'; cat "$file"; } > "$file.__tmp" && mv "$file.__tmp" "$file"; changed=1
  fi

  # 3) Guard bash + set -Eeuo pipefail
  if ! grep -q 'BASH_VERSION' "$file"; then
    awk 'NR==1{print; print "if [ -z \"${BASH_VERSION:-}\" ]; then exec /bin/bash \"$0\" \"$@\"; fi"} NR>1{print}' "$file" > "$file.__tmp" && mv "$file.__tmp" "$file"; changed=1
  fi
  if ! grep -qE '^set -E?euo pipefail' "$file"; then
    awk 'NR==1{print; next} NR==2{print; print "set -Eeuo pipefail"; next} {print}' "$file" > "$file.__tmp" && mv "$file.__tmp" "$file"; changed=1
  fi

  # 4) Exécutable
  if [[ ! -x "$file" ]]; then chmod +x "$file"; changed=1; fi

  # 5) Push si modifié (safe avec set -e)
  if (( changed )); then MODIFIED_FILES+=("$file"); fi
}

# --- Passe de correction des headers ---
for f in "${SH_FILES[@]}"; do
  ensure_header "$f"
done

# --- Audit Heredocs (robuste) ---
echo "${BLU}→ Audit heredocs…${NC}"
exit_code=0
python3 - "${SH_FILES[@]}" <<'PY' || exit_code=$?
import re, sys

def audit_file(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            lines = fh.read().splitlines()
    except Exception as e:
        print(f"[HEREDOC-ERROR] {path}: cannot read ({e})")
        return 1

    stack = []  # [(token, allow_tabs)]
    pat = re.compile(r'<<-?\s*(["\']?)([A-Za-z0-9_]+)\1')

    for line in lines:
        if stack:
            token, allow_tabs = stack[-1]
            end_line = line
            if allow_tabs:
                lstripped = end_line.lstrip('\t')
                prefix = end_line[:len(end_line)-len(lstripped)]
                if lstripped == token and (set(prefix) <= {'\t'}):
                    stack.pop()
            else:
                if end_line == token:
                    stack.pop()
            continue

        for m in pat.finditer(line):
            op = m.group(0)
            tok = m.group(2)
            allow_tabs = ('<<-' in op)
            stack.append((tok, allow_tabs))

    if stack:
        toks = ", ".join([t for t,_ in stack])
        print(f"[HEREDOC-ERROR] {path}: delimiters non fermés -> {toks}")
        return 1
    return 0

files = sys.argv[1:]
rc = 0
for p in files:
    rc |= audit_file(p)
sys.exit(rc)
PY

if (( exit_code != 0 )); then
  echo "${RED}✖ Heredoc(s) non fermés détectés. Aucun commit effectué.${NC}"
  exit 2
fi

echo "${GRN}✓ Heredocs OK.${NC}"

# --- Commit de sûreté si OK ---
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if ((${#MODIFIED_FILES[@]})); then
    echo "${BLU}→ git add (${#MODIFIED_FILES[@]} fichiers)…${NC}"
    git add -- "${MODIFIED_FILES[@]}"
    git commit -m "chore(scripts): enforce bash guard + set -Eeuo pipefail; normalize CRLF; heredocs audit (clean)"
    echo "${GRN}✓ Commit créé avec les corrections.${NC}"
  else
    git commit --allow-empty -m "chore(scripts): audit shell scripts (no changes); heredocs clean"
    echo "${GRN}✓ Commit de sûreté (aucun changement) créé.${NC}"
  fi
else
  echo "${YLW}Repo git non détecté : corrections appliquées mais pas de commit.${NC}"
fi

echo "${GRN}✔ Audit & sécurisation terminés.${NC}"
