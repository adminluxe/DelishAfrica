#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS_DIR="$ROOT/apps"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.backups/da_autofix_async_useEffect_safe_$TS"

log()  { printf "\n\033[1;32m[da-autofix]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[da-autofix]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[da-autofix]\033[0m %s\n" "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Missing dependency: $1"; exit 1; }; }

backup_file() {
  local f="$1"
  mkdir -p "$BACKUP_DIR"
  local rel="${f#$ROOT/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -a "$f" "$BACKUP_DIR/$rel"
}

DRY_RUN="${DRY_RUN:-0}" # set DRY_RUN=1 to not write changes

log "Sanity checks"
need bash
need python3
mkdir -p "$ROOT/.backups"
[ -d "$APPS_DIR" ] || { err "Apps dir not found: $APPS_DIR"; exit 1; }

log "Scanning TS/TSX files under: $APPS_DIR"
log "Mode: $([ "$DRY_RUN" = "1" ] && echo 'DRY_RUN (no writes)' || echo 'APPLY (writes + backups)')"

python3 - <<'PY' "$APPS_DIR" "$ROOT" "$BACKUP_DIR" "$DRY_RUN"
import os, sys, re

APPS_DIR, ROOT, BACKUP_DIR, DRY_RUN = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
DRY_RUN = DRY_RUN == "1"

# --- Minimal tokenizer to skip strings/comments while searching for braces/parens ---
def is_word_boundary(s, i):
    before = s[i-1] if i > 0 else ""
    after  = s[i] if i < len(s) else ""
    return (not (before.isalnum() or before == "_")) and (not (after.isalnum() or after == "_"))

def skip_ws(s, i):
    n = len(s)
    while i < n and s[i].isspace():
        i += 1
    return i

def skip_string(s, i):
    quote = s[i]
    i += 1
    n = len(s)
    if quote == "`":
        # template literal (best effort)
        while i < n:
            c = s[i]
            if c == "\\":
                i += 2
                continue
            if c == "`":
                return i + 1
            i += 1
        return n
    else:
        while i < n:
            c = s[i]
            if c == "\\":
                i += 2
                continue
            if c == quote:
                return i + 1
            i += 1
        return n

def skip_comment(s, i):
    n = len(s)
    if i+1 >= n: return i
    if s[i:i+2] == "//":
        j = s.find("\n", i+2)
        return n if j == -1 else j + 1
    if s[i:i+2] == "/*":
        j = s.find("*/", i+2)
        return n if j == -1 else j + 2
    return i

def next_code_char(s, i):
    n = len(s)
    while i < n:
        if s[i].isspace():
            i += 1
            continue
        if s[i] in ("'", '"', "`"):
            i = skip_string(s, i)
            continue
        if s[i:i+2] in ("//", "/*"):
            i = skip_comment(s, i)
            continue
        return i
    return n

def find_matching(s, i, open_ch, close_ch):
    # i points to open_ch
    assert s[i] == open_ch
    n = len(s)
    depth = 1
    i += 1
    while i < n:
        if s[i] in ("'", '"', "`"):
            i = skip_string(s, i)
            continue
        if s[i:i+2] in ("//", "/*"):
            i = skip_comment(s, i)
            continue
        c = s[i]
        if c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

def backup_file(path):
    rel = path[len(ROOT)+1:] if path.startswith(ROOT + "/") else path.lstrip("/")
    dest = os.path.join(BACKUP_DIR, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    # copy bytes to preserve exact content
    with open(path, "rb") as rf, open(dest, "wb") as wf:
        wf.write(rf.read())

def should_consider(path):
    # Only apps/client|courier|merchant for safety
    p = path.replace("\\", "/")
    return ("/apps/client/" in p) or ("/apps/courier/" in p) or ("/apps/merchant/" in p)

def scan_file(path):
    try:
        s = open(path, "r", encoding="utf-8").read()
    except Exception:
        return (0, [], [])

    patches = []
    skips = []

    i = 0
    n = len(s)

    while True:
        idx = s.find("useEffect", i)
        if idx == -1:
            break

        # word boundary
        if idx > 0 and (s[idx-1].isalnum() or s[idx-1] == "_"):
            i = idx + 8
            continue

        j = idx + len("useEffect")
        j = next_code_char(s, j)
        if j >= n or s[j] != "(":
            i = idx + 8
            continue

        # Find the callback start
        cb_start = next_code_char(s, j+1)

        # Must start with async keyword
        if not s.startswith("async", cb_start) or not is_word_boundary(s, cb_start):
            i = idx + 8
            continue

        k = cb_start + len("async")
        k = skip_ws(s, k)

        # Must be "(...) => {"
        if k >= n or s[k] != "(":
            skips.append((path, idx, "SKIP: async useEffect callback is not '(...) => { ... }' (no '(' after async)"))
            i = idx + 8
            continue

        params_end = find_matching(s, k, "(", ")")
        if params_end == -1:
            skips.append((path, idx, "SKIP: cannot match params ')'"))
            i = idx + 8
            continue

        arrow_pos = next_code_char(s, params_end + 1)
        if not s.startswith("=>", arrow_pos):
            skips.append((path, idx, "SKIP: not an arrow function after params"))
            i = idx + 8
            continue

        body_open = next_code_char(s, arrow_pos + 2)
        if body_open >= n or s[body_open] != "{":
            # we only patch block body
            skips.append((path, idx, "SKIP: body is not '{...}' (probably expression body)"))
            i = idx + 8
            continue

        body_close = find_matching(s, body_open, "{", "}")
        if body_close == -1:
            skips.append((path, idx, "SKIP: cannot match body '}'"))
            i = idx + 8
            continue

        # after body close, next real code char should be ',' (separator before deps)
        after_body = next_code_char(s, body_close + 1)
        if after_body >= n or s[after_body] != ",":
            skips.append((path, idx, "SKIP: pattern not 'useEffect(async () => { ... }, deps)' (no comma after body)"))
            i = idx + 8
            continue

        body_text = s[body_open+1:body_close]

        # ULTRA-SAFE GUARD: no "return" anywhere in body
        # (prevents breaking intended cleanup or early returns)
        if re.search(r"\breturn\b", body_text):
            skips.append((path, idx, "SKIP: body contains 'return' (cleanup/early return risk)"))
            i = body_close + 1
            continue

        # Build patch:
        # replace "useEffect(async" -> "useEffect(() => { (async"
        # insert "})();\n}" before the comma after body
        # We keep everything else unchanged.
        patch = {
            "start": idx,
            "useEffect_open_paren": j,         # position of '('
            "async_pos": cb_start,
            "body_open": body_open,
            "body_close": body_close,
            "comma_pos": after_body
        }
        patches.append(patch)

        i = body_close + 1

    if not patches:
        return (0, [], skips)

    # Apply patches from end to start
    out = s
    for p in sorted(patches, key=lambda x: x["start"], reverse=True):
        # 1) Replace callback head: "useEffect(async" -> "useEffect(() => { (async"
        # We'll do it by slicing between "useEffect(" and "async"
        useeffect_paren = p["useEffect_open_paren"]
        async_pos = p["async_pos"]
        head_before = out[:useeffect_paren+1]
        between = out[useeffect_paren+1:async_pos]
        # preserve whitespace/comments between '(' and 'async'
        head_after = out[async_pos:]
        # only patch if head_after starts with 'async' still
        if not head_after.startswith("async"):
            continue

        # new start segment up to async: "useEffect(" + between + "() => { (async"
        new_head = head_before + between + "() => { ("
        out = new_head + head_after  # temporarily, then we fix the remainder with insertion below

        # Recompute positions? To avoid complex offset issues, we re-locate the body_close comma region locally.
        # Find the specific instance by searching forward from async_pos for the next "{...}," with no return.
        # Since we apply from end to start, and just modified earlier chars, we can safely locate the comma by scanning.
        # We'll locate the first "{", match to "}", then comma.
        scan_from = async_pos  # old async_pos; still valid-ish due to only local replacement
        # Find first "{"
        bopen = out.find("{", scan_from)
        if bopen == -1:
            continue
        bclose = find_matching(out, bopen, "{", "}")
        if bclose == -1:
            continue
        comma = next_code_char(out, bclose + 1)
        if comma >= len(out) or out[comma] != ",":
            continue

        # Insert after body close: "})();\n}" before comma
        out = out[:bclose+1] + ")();\n}" + out[comma:]

        # Now we must remove the original "async" keyword, because we inserted "(async" but still have "async"
        # Actually new_head added "(“ before original 'async', and kept original 'async' – correct.
        # But we also changed "useEffect(" to include "() => { ("; so final is: useEffect(() => { (async ...
        # That's correct.

    # Cleanup: We introduced "useEffect(() => { (" but we still have "async" right after "(".
    # Final should be: useEffect(() => { (async (...) => { ... })(); }, deps)
    # That’s exactly what we produced.

    if out == s:
        return (0, [], skips)

    return (1, [out], skips)

def iter_ts_files(base):
    for root, dirs, files in os.walk(base):
        # skip node_modules just in case
        if "node_modules" in root.split(os.sep):
            continue
        for fn in files:
            if fn.endswith(".ts") or fn.endswith(".tsx"):
                yield os.path.join(root, fn)

patched = []
skipped = []

for path in iter_ts_files(APPS_DIR):
    if not should_consider(path):
        continue

    changed, outs, skips = scan_file(path)
    for s in skips:
        skipped.append(s)

    if changed and outs:
        new_content = outs[0]
        if not DRY_RUN:
            backup_file(path)
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
        patched.append(path)

print("\n[da-autofix] Summary")
print(f"- Patched files: {len(patched)}")
for p in patched[:200]:
    print(f"  PATCHED: {p}")
if len(patched) > 200:
    print("  ... (truncated)")

print(f"\n- Skipped candidates: {len(skipped)}")
# show only the first N skips to keep it readable
N = 80
for (path, pos, reason) in skipped[:N]:
    print(f"  {reason} :: {path}")
if len(skipped) > N:
    print("  ... (more skips not shown)")

print(f"\n[da-autofix] Backups dir: {BACKUP_DIR}")
if DRY_RUN:
    print("[da-autofix] DRY_RUN=1 => no files were written, no backups created.")
PY

log "Done."
echo "Backups (if applied) in: $BACKUP_DIR"
echo
echo "Tip: run DRY first:"
echo "  DRY_RUN=1 bash /opt/delishafrica/monorepo/scripts/da_autofix_async_useEffect_safe.sh"
