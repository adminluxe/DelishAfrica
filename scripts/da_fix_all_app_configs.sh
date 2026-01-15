#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

# Try both names just in case (legacy folders)
resolve_app_dir() {
  local app="$1"
  if [[ -d "$ROOT/apps/$app" ]]; then
    echo "$ROOT/apps/$app"
    return 0
  fi
  if [[ "$app" == "merchant" && -d "$ROOT/apps/marchand" ]]; then
    echo "$ROOT/apps/marchand"
    return 0
  fi
  if [[ "$app" == "courier" && -d "$ROOT/apps/coursier" ]]; then
    echo "$ROOT/apps/coursier"
    return 0
  fi
  return 1
}

backup_file() {
  local f="$1"
  local ts
  ts="$(date +%Y%m%d_%H%M%S)"
  cp -a "$f" "$f.bak.$ts"
  echo "backup: $f.bak.$ts"
}

unlock_file() {
  local f="$1"
  if command -v lsattr >/dev/null 2>&1; then
    if lsattr "$f" 2>/dev/null | grep -q '\-i\-'; then
      echo "-> immutable ON: removing (chattr -i) $f"
      chattr -i "$f" || true
    fi
  fi
  chmod u+w "$f" || true
}

relock_file() {
  local f="$1"
  chmod u-w "$f" || true
  if command -v chattr >/dev/null 2>&1; then
    chattr +i "$f" || true
  fi
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

# Extract best-effort values from the existing (possibly broken) file
project_id = pick(r"projectId\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]")
bundle_id  = pick(r"bundleIdentifier\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]")
android_pkg= pick(r"package\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]")
name       = pick(r"\\bname\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]")
slug       = pick(r"\\bslug\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]")
owner      = pick(r"\\bowner\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]")
scheme     = pick(r"\\bscheme\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]")
icon       = pick(r"\\bicon\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]", "./assets/icon.png")
splash_img = pick(r"\\bimage\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]", "./assets/splash.png")
api_url    = pick(r"EXPO_PUBLIC_API_URL\\s*:\\s*['\\\"]([^'\\\"]+)['\\\"]", "https://api.delishafrica.me/api/v1")

# Defaults if missing
if not owner: owner = "delishafrica"
if not slug:
    slug = f"delishafrica-{app}"
if not name:
    pretty = app.capitalize()
    name = f"DelishAfrica - {pretty}"
if not scheme:
    scheme = f"delishafrica.{app}"
if not bundle_id:
    # keep your existing pattern: me.delishafrica.<app>
    bundle_id = f"me.delishafrica.{app}"
if not android_pkg:
    # keep your existing pattern: com.delishafrica.<app>
    android_pkg = f"com.delishafrica.{app}"

# If project_id missing, keep it empty but still valid.
extra_eas = ""
if project_id:
    extra_eas = f"    eas: {{ projectId: \\"{project_id}\\" }},\\n"

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

  # quick local parse check (no build)
  echo "-- verify expo config parse --"
  (cd "$dir" && npx -y expo config --json >/dev/null) && echo "OK: expo config parses for $app" || {
    echo "ERROR: expo config still failing for $app"
    echo "Try: (cd $dir && npx -y expo config --json) to see the exact error"
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
