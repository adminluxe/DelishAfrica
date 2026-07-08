#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

TEAM_ID="${TONTON_TEAM_ID:-${APPLE_TEAM_ID:-${EXPO_APPLE_TEAM_ID:-${1:-}}}}"
if [[ -z "${TEAM_ID}" ]]; then
  echo "[tonton-pbxproj] TEAM_ID missing (set TONTON_TEAM_ID or pass as arg). Skipping."
  exit 0
fi

echo "[tonton-pbxproj] TEAM_ID=$TEAM_ID"
echo "[tonton-pbxproj] pwd=$(pwd)"

# pbxproj existe seulement après prebuild -> on cherche large
mapfile -t PBX < <(find . -type f -name project.pbxproj -path "*ios*/*.xcodeproj/*" 2>/dev/null || true)

if [[ "${#PBX[@]}" -eq 0 ]]; then
  echo "[tonton-pbxproj] No pbxproj found yet (prebuild not done). Skipping."
  exit 0
fi

python3 - <<PY
import re, sys, pathlib, os

team = os.environ.get("TONTON_TEAM_ID") or os.environ.get("APPLE_TEAM_ID") or os.environ.get("EXPO_APPLE_TEAM_ID") or "${TEAM_ID}"
files = ${PBX[@]+"[" + ", ".join([repr(p) for p in "${PBX[@]}"]) + "]"}  # bash injects list (fallback below)
if not isinstance(files, list):
    files = []
# fallback: re-scan from python (safer)
if not files:
    files = [str(p) for p in pathlib.Path(".").rglob("project.pbxproj") if "ios" in str(p) and ".xcodeproj" in str(p)]

def patch_build_settings_block(block: str) -> str:
    lines = block.splitlines(True)
    out = []
    saw_team = False
    saw_style = False

    for line in lines:
        # remove forced profiles
        if re.search(r'\\bPROVISIONING_PROFILE(_SPECIFIER)?\\b', line):
            continue

        if re.search(r'\\bDEVELOPMENT_TEAM\\b', line):
            out.append(re.sub(r'=\\s*.*?;', f'= {team};', line))
            saw_team = True
            continue

        if re.search(r'\\bCODE_SIGN_STYLE\\b', line):
            out.append(re.sub(r'=\\s*.*?;', '= Automatic;', line))
            saw_style = True
            continue

        out.append(line)

    # insert missing keys
    if (not saw_team) or (not saw_style):
        insert_at = None
        for i, l in enumerate(out):
            if "PRODUCT_BUNDLE_IDENTIFIER" in l:
                insert_at = i + 1
                break
        if insert_at is None:
            insert_at = 1

        indent = re.match(r'^(\\s*)', out[insert_at-1]).group(1) if out else "\\t\\t\\t\\t"
        add = []
        if not saw_team:
            add.append(f"{indent}DEVELOPMENT_TEAM = {team};\\n")
        if not saw_style:
            add.append(f"{indent}CODE_SIGN_STYLE = Automatic;\\n")
        out[insert_at:insert_at] = add

    return "".join(out)

def patch_target_attributes(block: str) -> str:
    # force ProvisioningStyle + DevelopmentTeam in TargetAttributes
    # We do a light patch: set any existing DevelopmentTeam / ProvisioningStyle, else inject near the start of each target attr.
    def patch_one_target(m):
        target_block = m.group(0)
        tb = target_block

        if re.search(r'\\bDevelopmentTeam\\b', tb):
            tb = re.sub(r'\\bDevelopmentTeam\\s*=\\s*[^;]+;', f'DevelopmentTeam = {team};', tb)
        else:
            tb = re.sub(r'(\\{\\s*\\n)', r'\\1\\t\\t\\t\\t\\t\\tDevelopmentTeam = %s;\\n' % team, tb, count=1)

        if re.search(r'\\bProvisioningStyle\\b', tb):
            tb = re.sub(r'\\bProvisioningStyle\\s*=\\s*[^;]+;', 'ProvisioningStyle = Automatic;', tb)
        else:
            tb = re.sub(r'(\\{\\s*\\n)', r'\\1\\t\\t\\t\\t\\t\\tProvisioningStyle = Automatic;\\n', tb, count=1)

        return tb

    return re.sub(r'\\b[0-9A-F]{24}\\b\\s*=\\s*\\{[\\s\\S]*?\\};', patch_one_target, block)

for f in files:
    p = pathlib.Path(f)
    try:
        s = p.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"[tonton-pbxproj] Cannot read {p}: {e}")
        continue

    orig = s

    # patch TargetAttributes section if present
    s = re.sub(r'(TargetAttributes\\s*=\\s*\\{[\\s\\S]*?\\};)', lambda m: patch_target_attributes(m.group(1)), s)

    # patch all buildSettings blocks
    def repl(m):
        inner = m.group(1)
        patched = patch_build_settings_block(inner)
        return "buildSettings = {\\n" + patched + "\\n\\t\\t\\t};"

    s2 = re.sub(r'buildSettings\\s*=\\s*\\{\\n([\\s\\S]*?)\\n\\t\\t\\t\\};', repl, s)

    # ensure CODE_SIGN_STYLE not left Manual anywhere
    s2 = re.sub(r'\\bCODE_SIGN_STYLE\\s*=\\s*Manual;', 'CODE_SIGN_STYLE = Automatic;', s2)
    # remove any leftover PROVISIONING_PROFILE* in case some format differs
    s2 = re.sub(r'^\\s*PROVISIONING_PROFILE(_SPECIFIER)?(\\[sdk=[^\\]]+\\])?\\s*=\\s*.*?;\\s*\\n', '', s2, flags=re.M)

    if s2 != orig:
        p.write_text(s2, encoding="utf-8")
        print(f"[tonton-pbxproj] patched: {p}")
    else:
        print(f"[tonton-pbxproj] no change: {p}")

print("[tonton-pbxproj] done.")
PY

