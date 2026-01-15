#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

# IDs (tu peux override avant: export CLIENT_ANDROID_PACKAGE=... etc.)
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
      echo "-> chattr -i $f"
      chattr -i "$f" 2>/dev/null || true
    fi
  fi
  chmod u+w "$f" 2>/dev/null || true
}

relock_file(){
  local f="$1"
  if command -v chattr >/dev/null 2>&1; then
    chattr +i "$f" 2>/dev/null || true
  fi
}

backup_file(){
  local f="$1"
  local b="${f}.bak.$(ts_now)"
  cp -a "$f" "$b"
  echo "backup: $b"
}

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

# 1) Fix common "missing comma" after plugins: [...]
# Add comma if line ends with ] and next non-empty line starts with quotes/android/ios/other key
def fix_plugins_comma(txt):
  # plugins: [ ... ]\n   <nextKey>
  pat = re.compile(r'(\bplugins\s*:\s*\[[^\]]*\])\s*\n(\s*)(["\']?[A-Za-z_][\w-]*["\']?\s*:)', re.S)
  def repl(m):
    return m.group(1) + ",\n" + m.group(2) + m.group(3)
  return pat.sub(repl, txt)

s = fix_plugins_comma(s)

# 2) Remove any root-level android/ios blocks we previously inserted next to expo (optional but clean)
#    This is best-effort: remove blocks starting at indentation 2 spaces (same as expo key usually)
root_android = re.compile(r'\n\s{2}["\']?android["\']?\s*:\s*{\s*[^}]*\s*}\s*,?', re.S)
root_ios = re.compile(r'\n\s{2}["\']?ios["\']?\s*:\s*{\s*[^}]*\s*}\s*,?', re.S)

# Only remove if file contains "expo:" (meaning object wrapper)
has_expo_wrapper = re.search(r'\bexpo\s*:\s*{', s) is not None
if has_expo_wrapper:
  s = root_android.sub('\n', s)
  s = root_ios.sub('\n', s)

# 3) Ensure android/ios exist INSIDE expo: { ... }
def expo_has_android(txt):
  m = re.search(r'\bexpo\s*:\s*{', txt)
  if not m: return False
  # naive scan: in first expo block vicinity, check android:
  return re.search(r'\bexpo\s*:\s*{[^}]*\bandroid\s*:\s*{', txt, flags=re.S) is not None

def expo_has_ios(txt):
  m = re.search(r'\bexpo\s*:\s*{', txt)
  if not m: return False
  return re.search(r'\bexpo\s*:\s*{[^}]*\bios\s*:\s*{', txt, flags=re.S) is not None

def insert_into_expo(txt, block_text):
  # insert right after expo: {
  m = re.search(r'(\bexpo\s*:\s*{)', txt)
  if not m:
    return txt, False
  idx = m.end(1)
  # indentation: find start of line where "expo:" is
  line_start = txt.rfind("\n", 0, m.start()) + 1
  indent = re.match(r'[ \t]*', txt[line_start:m.start()]).group(0)
  ins = f"\n{indent}  {block_text.replace(chr(10), chr(10)+indent+'  ')}"
  return txt[:idx] + ins + txt[idx:], True

changed = (s != orig)

if has_expo_wrapper:
  if not expo_has_android(s):
    s, ok = insert_into_expo(s, f'android: {{\n  package: "{android_pkg}",\n}},')
    changed = changed or ok
  else:
    # ensurex: if android exists, ensure package set
    s2 = re.sub(r'(android\s*:\s*{[^}]*\bpackage\s*:\s*)["\'][^"\']*["\']',
                rf'\1"{android_pkg}"', s, flags=re.S)
    changed = changed or (s2 != s)
    s = s2

  if not expo_has_ios(s):
    s, ok = insert_into_expo(s, f'ios: {{\n  bundleIdentifier: "{ios_bundle}",\n}},')
    changed = changed or ok
  else:
    s2 = re.sub(r'(ios\s*:\s*{[^}]*\bbundleIdentifier\s*:\s*)["\'][^"\']*["\']',
                rf'\1"{ios_bundle}"', s, flags=re.S)
    changed = changed or (s2 != s)
    s = s2
else:
  # No expo wrapper; fallback: add at root (rare in your repo)
  if "android:" not in s:
    s = re.sub(r'(return\s*{)', rf'\1\n  android: {{ package: "{android_pkg}" }},', s, count=1)
    changed = True
  if "ios:" not in s:
    s = re.sub(r'(return\s*{)', rf'\1\n  ios: {{ bundleIdentifier: "{ios_bundle}" }},', s, count=1)
    changed = True

if not changed:
  print("NOCHANGE")
  sys.exit(0)

p.write_text(s, encoding="utf-8")
print("PATCHED")
PY
}

verify_expo(){
  local dir="$1"
  (cd "$dir" && npx --yes expo config --type public --json 2>/dev/null \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);console.log("android.package=", j.android?.package||"");console.log("ios.bundleIdentifier=", j.ios?.bundleIdentifier||"");}catch(e){console.log("expo config parse failed");}})') || true
}

patch_app(){
  local app="$1" android_pkg="$2" ios_bundle="$3"
  local dir="$ROOT/apps/$app"
  echo
  echo "== $app =="
  echo "dir: $dir"
  echo "android.package=$android_pkg"
  echo "ios.bundleIdentifier=$ios_bundle"

  local f="$dir/app.config.ts"
  [[ -f "$f" ]] || { echo "WARN: missing $f"; return 0; }

  backup_file "$f"
  unlock_file "$f"
  echo "patch: $(py_patch "$f" "$android_pkg" "$ios_bundle" || true)"
  relock_file "$f"

  echo "-- verify --"
  verify_expo "$dir"
}

patch_app "client"   "$CLIENT_ANDROID_PACKAGE"   "$CLIENT_IOS_BUNDLE"
patch_app "merchant" "$MERCHANT_ANDROID_PACKAGE" "$MERCHANT_IOS_BUNDLE"
patch_app "courier"  "$COURIER_ANDROID_PACKAGE"  "$COURIER_IOS_BUNDLE"

echo
echo "DONE."
