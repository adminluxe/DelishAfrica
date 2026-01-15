#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

resolve_app_dir() {
  local app="$1"
  if [[ -d "$ROOT/apps/$app" ]]; then
    echo "$ROOT/apps/$app"; return 0
  fi
  # compat alias (au cas où)
  if [[ "$app" == "merchant" && -d "$ROOT/apps/marchand" ]]; then
    echo "$ROOT/apps/marchand"; return 0
  fi
  if [[ "$app" == "courier" && -d "$ROOT/apps/coursier" ]]; then
    echo "$ROOT/apps/coursier"; return 0
  fi
  return 1
}

backup_file() {
  local f="$1"
  local ts="$(date +%Y%m%d_%H%M%S)"
  cp -a "$f" "$f.bak.$ts"
  echo "backup: $f.bak.$ts"
}

unlock_file() {
  local f="$1"
  if command -v lsattr >/dev/null 2>&1; then
    if lsattr "$f" 2>/dev/null | grep -q 'i'; then
      echo "-> immutable ON: removing (chattr -i) $f"
      chattr -i "$f" || true
    fi
  fi
  chmod u+w "$f" || true
}

relock_file() {
  local f="$1"
  chmod u-w "$f" || true
  command -v chattr >/dev/null 2>&1 && chattr +i "$f" || true
}

patch_one() {
  local app="$1"
  local dir
  dir="$(resolve_app_dir "$app")"
  local f="$dir/app.config.ts"

  echo
  echo "== $app =="
  echo "dir: $dir"
  [[ -f "$f" ]] || { echo "ERROR: missing $f"; return 1; }

  backup_file "$f"
  unlock_file "$f"

  python3 - <<PY
import re, pathlib

app = "${app}"
dirp = pathlib.Path("${dir}")
f = dirp / "app.config.ts"
s = f.read_text(encoding="utf-8", errors="replace")

def pick(pattern, default=None):
    m = re.search(pattern, s, re.M)
    return m.group(1) if m else default

# IMPORTANT: raw strings delimited by SINGLE quotes to safely include ["\']
project_id = pick(r'eas\\s*:\\s*\\{[^}]*projectId\\s*:\\s*["\\\']([^"\\\']+)["\\\']', None) \
            or pick(r'projectId\\s*:\\s*["\\\']([^"\\\']+)["\\\']', None)

bundle_id  = pick(r'bundleIdentifier\\s*:\\s*["\\\']([^"\\\']+)["\\\']', None)
android_pkg= pick(r'\\bpackage\\s*:\\s*["\\\']([^"\\\']+)["\\\']', None)

name       = pick(r'\\bname\\s*:\\s*["\\\']([^"\\\']+)["\\\']', None)
slug       = pick(r'\\bslug\\s*:\\s*["\\\']([^"\\\']+)["\\\']', None)
owner      = pick(r'\\bowner\\s*:\\s*["\\\']([^"\\\']+)["\\\']', "delishafrica")
scheme     = pick(r'\\bscheme\\s*:\\s*["\\\']([^"\\\']+)["\\\']', None)

icon       = pick(r'\\bicon\\s*:\\s*["\\\']([^"\\\']+)["\\\']', "./assets/icon.png")
splash_img = pick(r'splash\\s*:\\s*\\{[^}]*image\\s*:\\s*["\\\']([^"\\\']+)["\\\']', "./assets/splash.png")

api_url    = pick(r'EXPO_PUBLIC_API_URL\\s*:\\s*["\\\']([^"\\\']+)["\\\']', "https://api.delishafrica.me/api/v1")

# Defaults if missing
if not slug:
    slug = f"delishafrica-{app}"
if not name:
    pretty = app.capitalize()
    name = f"DelishAfrica - {pretty}"
if not scheme:
    scheme = f"delishafrica.{app}"
if not bundle_id:
    bundle_id = f"me.delishafrica.{app}"
if not android_pkg:
    android_pkg = f"com.delishafrica.{app}"

extra_eas = ""
if project_id:
    extra_eas = f'    eas: {{ projectId: "{project_id}" }},\\n'

out = f'''import type {{ ExpoConfig }} from "expo/config";

const config: ExpoConfig = {{
  name: "{name}",
  slug: "{slug}",
  owner: "{owner}",
  scheme: "{scheme}",
  icon: "{icon}",
  splash: {{
    image: "{splash_img}",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  }},
  extra: {{
    EXPO_PUBLIC_API_URL: "{api_url}",
{extra_eas.rstrip()}
  }},
  ios: {{
    bundleIdentifier: "{bundle_id}",
  }},
  android: {{
    package: "{android_pkg}",
  }},
  plugins: ["expo-router", "expo-secure-store"],
}};

export default config;
'''

f.write_text(out, encoding="utf-8")
print("WROTE:", f)
print("projectId:", project_id or "(missing)")
print("ios.bundleIdentifier:", bundle_id)
print("android.package:", android_pkg)
PY

  echo "-- verify expo config parse --"
  (cd "$dir" && npx -y expo config --json >/dev/null) && echo "OK: expo config parses for $app" || {
    echo "ERROR: expo config still failing for $app"
    echo "Run: cd $dir && npx -y expo config --json"
    return 1
  }

  relock_file "$f"
  echo "locked: $f"
}

patch_one client
patch_one merchant
patch_one courier

echo
echo "DONE: app.config.ts fixed for client/merchant/courier"
