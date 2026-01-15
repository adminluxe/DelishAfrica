#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

# ---- Default identifiers (change if you already own others) ----
CLIENT_ANDROID_PACKAGE="${CLIENT_ANDROID_PACKAGE:-com.delishafrica.client}"
CLIENT_IOS_BUNDLE="${CLIENT_IOS_BUNDLE:-com.delishafrica.client}"

MERCHANT_ANDROID_PACKAGE="${MERCHANT_ANDROID_PACKAGE:-com.delishafrica.merchant}"
MERCHANT_IOS_BUNDLE="${MERCHANT_IOS_BUNDLE:-com.delishafrica.merchant}"

COURIER_ANDROID_PACKAGE="${COURIER_ANDROID_PACKAGE:-com.delishafrica.courier}"
COURIER_IOS_BUNDLE="${COURIER_IOS_BUNDLE:-com.delishafrica.courier}"

ts_now(){ date +%Y%m%d_%H%M%S; }

unlock_file(){
  local f="$1"
  if command -v lsattr >/dev/null 2>&1; then
    if lsattr "$f" 2>/dev/null | awk '{print $1}' | grep -q 'i'; then
      echo "-> removing immutable flag (chattr -i) on $f"
      chattr -i "$f" 2>/dev/null || true
    fi
  fi
  chmod u+w "$f" 2>/dev/null || true
}

relock_file(){
  local f="$1"
  if command -v chattr >/dev/null 2>&1; then
    echo "-> re-lock immutable (chattr +i) on $f"
    chattr +i "$f" 2>/dev/null || true
  fi
}

backup_file(){
  local f="$1"
  local b="${f}.bak.$(ts_now)"
  cp -a "$f" "$b"
  echo "backup: $b"
}

# Patch strategy:
# - If android:{...} exists but no package -> insert package right after "{"
# - If ios:{...} exists but no bundleIdentifier -> insert bundleIdentifier right after "{"
# - If android/ios blocks don't exist -> append minimal blocks just before last "}" (best-effort)
py_patch(){
  local file="$1"
  local android_pkg="$2"
  local ios_bundle="$3"

  python3 - "$file" "$android_pkg" "$ios_bundle" <<'PY'
import re, sys, pathlib

p = pathlib.Path(sys.argv[1])
android_pkg = sys.argv[2]
ios_bundle = sys.argv[3]

s = p.read_text(encoding="utf-8", errors="replace")

orig = s

def has_android_pkg(txt):
  return re.search(r'android\s*:\s*{[^}]*\bpackage\s*:', txt, flags=re.S) is not None

def has_ios_bundle(txt):
  return re.search(r'ios\s*:\s*{[^}]*\bbundleIdentifier\s*:', txt, flags=re.S) is not None

def insert_after_open_block(txt, key, insert_line):
  # insert right after "key: {"
  pattern = re.compile(rf'({key}\s*:\s*{{)', flags=re.S)
  m = pattern.search(txt)
  if not m:
    return txt, False
  idx = m.end()
  # keep indentation: find indent from the block line start
  line_start = txt.rfind("\n", 0, m.start()) + 1
  indent = re.match(r'[ \t]*', txt[line_start:m.start()]).group(0)
  ins = f"\n{indent}  {insert_line}"
  return txt[:idx] + ins + txt[idx:], True

changed = False

# android.package
if not has_android_pkg(s):
  s2, ok = insert_after_open_block(s, "android", f'package: "{android_pkg}",')
  if ok:
    s = s2; changed = True
  else:
    # append minimal android block before last }
    # best effort: only if looks like an exported object
    last = s.rfind("}")
    if last != -1:
      s = s[:last] + f',\n  android: {{\n    package: "{android_pkg}",\n  }}\n' + s[last:]
      changed = True

# ios.bundleIdentifier
if not has_ios_bundle(s):
  s2, ok = insert_after_open_block(s, "ios", f'bundleIdentifier: "{ios_bundle}",')
  if ok:
    s = s2; changed = True
  else:
    last = s.rfind("}")
    if last != -1:
      s = s[:last] + f',\n  ios: {{\n    bundleIdentifier: "{ios_bundle}",\n  }}\n' + s[last:]
      changed = True

if not changed:
  print("NOCHANGE")
  sys.exit(0)

p.write_text(s, encoding="utf-8")
print("PATCHED")
PY
}

patch_one_app(){
  local app="$1"
  local android_pkg="$2"
  local ios_bundle="$3"

  local dir="$ROOT/apps/$app"
  echo
  echo "== APP: $app =="
  echo "android.package    : $android_pkg"
  echo "ios.bundleIdentifier: $ios_bundle"
  echo "dir: $dir"

  if [[ ! -d "$dir" ]]; then
    echo "WARN: missing dir $dir"
    return 0
  fi

  # Try patching these candidates (in priority)
  local candidates=(
    "$dir/app.config.ts"
    "$dir/app.config.js"
    "$dir/app.config.base.ts"
    "$dir/app.json"
  )

  local any=0
  for f in "${candidates[@]}"; do
    [[ -f "$f" ]] || continue
    any=1
    echo "-- patch file: $f"
    backup_file "$f"
    unlock_file "$f"
    out="$(py_patch "$f" "$android_pkg" "$ios_bundle" || true)"
    echo "patch_result: $out"
    # relock only if file existed and we touched perms
    relock_file "$f"
  done

  if [[ "$any" -eq 0 ]]; then
    echo "WARN: no config file found in $dir (app.config.* / app.json)"
  fi

  echo "-- verify resolved expo config (android.package + ios.bundleIdentifier) --"
  (cd "$dir" && npx --yes expo config --type public --json 2>/dev/null \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);console.log("android.package=", j.android?.package||"");console.log("ios.bundleIdentifier=", j.ios?.bundleIdentifier||"");}catch(e){console.log("expo config parse failed");}})' \
  ) || true
}

echo "== DelishAfrica: force Expo IDs (safe) =="
patch_one_app "client"   "$CLIENT_ANDROID_PACKAGE"   "$CLIENT_IOS_BUNDLE"
patch_one_app "merchant" "$MERCHANT_ANDROID_PACKAGE" "$MERCHANT_IOS_BUNDLE"
patch_one_app "courier"  "$COURIER_ANDROID_PACKAGE"  "$COURIER_IOS_BUNDLE"

echo
echo "DONE."
