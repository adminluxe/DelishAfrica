#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_COMMIT="${1:-}"
if [ -z "$TARGET_COMMIT" ]; then
  echo "Usage: sudo bash deploy-certified-vps-20260929.sh <exact-git-commit>" >&2
  exit 64
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 77
fi

REPO_URL="https://github.com/adminluxe/DelishAfrica.git"
LANDING_ROOT="/var/www/delishafrica-landing"
CURRENT_LINK="$LANDING_ROOT/current"
OLD_RELEASE="$(readlink -f "$CURRENT_LINK")"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="/tmp/delish-landing-deploy-${TS}"
NEW_RELEASE="$LANDING_ROOT/releases/github-${TARGET_COMMIT:0:12}-${TS}"
LOG="$LANDING_ROOT/deploy-${TS}.log"

exec > >(tee -a "$LOG") 2>&1

rollback() {
  echo "ROLLBACK -> $OLD_RELEASE"
  ln -sfn "$OLD_RELEASE" "$LANDING_ROOT/.current.rollback"
  mv -Tf "$LANDING_ROOT/.current.rollback" "$CURRENT_LINK"
  nginx -t && systemctl reload nginx || true
}
cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'echo "DEPLOYMENT_FAILED"; rollback' ERR

echo "=== DELISH CERTIFIED LANDING DEPLOY ==="
echo "target=$TARGET_COMMIT"
echo "old=$OLD_RELEASE"
echo "new=$NEW_RELEASE"
echo "log=$LOG"

test -d "$OLD_RELEASE"
for f in   water-app-parity-v2.css water-cordon-v3.css water-rain-food-v4.css   water-gala-v5.css water-gala-v6.css water-gala-v7.css water-gala-v8.css   water-gala-v9.css water-gala-v10.css water-gala-v11.css
do
  test -f "$OLD_RELEASE/$f"
done
for d in media/water media/dishes/editorial media/partners/la-boule-bleue; do
  test -d "$OLD_RELEASE/$d"
done

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node >=22 required; found $(node -v)" >&2
  exit 65
fi

mkdir -p "$WORK"
git clone --filter=blob:none --no-checkout "$REPO_URL" "$WORK/repo"
git -C "$WORK/repo" checkout --detach "$TARGET_COMMIT"
ACTUAL="$(git -C "$WORK/repo" rev-parse HEAD)"
test "$ACTUAL" = "$TARGET_COMMIT"

cd "$WORK/repo/apps/landing"
npm install --no-audit --no-fund
npm run check
npm run build

test -f dist/index.html
test -f dist/robots.txt
test -f dist/sitemap.xml
test -f dist/site.webmanifest
test -f dist/site.webmanifest.json
test -f dist/delish-theme-v2.css
test -f dist/theme-controller-v3.js
test -f dist/cookies/index.html
test -f dist/terms/index.html
test -f dist/legal/index.html
test -f dist/privacy/index.html

mkdir -p "$NEW_RELEASE"
cp -a dist/. "$NEW_RELEASE/"

# Preserve only the already-public certified live visual layer.
for f in   water-app-parity-v2.css water-cordon-v3.css water-rain-food-v4.css   water-gala-v5.css water-gala-v6.css water-gala-v7.css water-gala-v8.css   water-gala-v9.css water-gala-v10.css water-gala-v11.css
do
  cp -a "$OLD_RELEASE/$f" "$NEW_RELEASE/$f"
done
for d in media/water media/dishes/editorial media/partners/la-boule-bleue; do
  mkdir -p "$NEW_RELEASE/$d"
  cp -a "$OLD_RELEASE/$d/." "$NEW_RELEASE/$d/"
done

# Collapse ten certified WATER/GALA stylesheets into one request while preserving cascade order.
BUNDLE="$NEW_RELEASE/water-live-v11.bundle.css"
: > "$BUNDLE"
for f in   water-app-parity-v2.css   water-cordon-v3.css   water-rain-food-v4.css   water-gala-v5.css   water-gala-v6.css   water-gala-v7.css   water-gala-v8.css   water-gala-v9.css   water-gala-v10.css   water-gala-v11.css
do
  printf '\n/* ===== %s ===== */\n' "$f" >> "$BUNDLE"
  cat "$OLD_RELEASE/$f" >> "$BUNDLE"
  printf '\n' >> "$BUNDLE"
done
test -s "$BUNDLE"
echo "WATER_BUNDLE_SHA256=$(sha256sum "$BUNDLE" | cut -d' ' -f1)"

node "$WORK/repo/apps/landing/scripts/verify-live-polish.mjs" "$NEW_RELEASE"

# Construction-era surfaces must stay gone.
test ! -e "$NEW_RELEASE/lab/smart-links/index.html"
test ! -e "$NEW_RELEASE/en/lab/smart-links/index.html"
test ! -e "$NEW_RELEASE/devenir-coursier/simulateur/index.html"
test ! -e "$NEW_RELEASE/en/become-a-courier/simulator/index.html"

chown -R root:root "$NEW_RELEASE"
find "$NEW_RELEASE" -type d -exec chmod 0755 {} +
find "$NEW_RELEASE" -type f -exec chmod 0644 {} +

echo "=== PRE-SWITCH STATIC PROBE ==="
python3 -m http.server 18999 --bind 127.0.0.1 --directory "$NEW_RELEASE" >"$WORK/http.log" 2>&1 &
HTTP_PID=$!
sleep 1
for p in / /robots.txt /site.webmanifest.json /sitemap.xml /delish-theme-v2.css /theme-controller-v3.js /water-live-v11.bundle.css /privacy/ /cookies/ /terms/ /legal/; do
  code="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:18999$p")"
  echo "$p -> $code"
  test "$code" = "200"
done
kill "$HTTP_PID"
wait "$HTTP_PID" 2>/dev/null || true

echo "=== ATOMIC SWITCH ==="
ln -sfn "$NEW_RELEASE" "$LANDING_ROOT/.current.next"
mv -Tf "$LANDING_ROOT/.current.next" "$CURRENT_LINK"
nginx -t
systemctl reload nginx

echo "=== ORIGIN GATE ==="
for p in / /robots.txt /site.webmanifest.json /sitemap.xml /delish-theme-v2.css /theme-controller-v3.js /water-live-v11.bundle.css /privacy/ /cookies/ /terms/ /legal/; do
  code="$(curl -ksS --max-time 8 --resolve delishafrica.me:443:127.0.0.1 -o /dev/null -w '%{http_code}' "https://delishafrica.me$p")"
  type="$(curl -ksSI --max-time 8 --resolve delishafrica.me:443:127.0.0.1 "https://delishafrica.me$p" | awk -F': ' 'tolower($1)=="content-type"{print $2}' | tr -d '\r' | tail -1)"
  echo "$p -> HTTP=$code TYPE=$type"
  test "$code" = "200"
done

ROBOTS_TYPE="$(curl -ksSI --resolve delishafrica.me:443:127.0.0.1 https://delishafrica.me/robots.txt | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tr -d '\r')"
SITEMAP_TYPE="$(curl -ksSI --resolve delishafrica.me:443:127.0.0.1 https://delishafrica.me/sitemap.xml | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tr -d '\r')"
MANIFEST_TYPE="$(curl -ksSI --resolve delishafrica.me:443:127.0.0.1 https://delishafrica.me/site.webmanifest.json | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tr -d '\r')"
echo "$ROBOTS_TYPE" | grep -Eq 'text/plain|text/'
echo "$SITEMAP_TYPE" | grep -Eq 'xml|text/plain'
echo "$MANIFEST_TYPE" | grep -Eq 'application/json|application/manifest\+json'

trap - ERR

echo "=== PUBLIC OBSERVATION ==="
for p in / /robots.txt /site.webmanifest.json /sitemap.xml /delish-theme-v2.css /theme-controller-v3.js /water-live-v11.bundle.css /privacy/ /cookies/ /terms/ /legal/; do
  curl -sS --max-time 8 -o /dev/null -w "$p -> HTTP=%{http_code} TYPE=%{content_type}\n" "https://delishafrica.me$p" || true
done

echo "DEPLOYMENT_PASS"
echo "CURRENT=$(readlink -f "$CURRENT_LINK")"
echo "ROLLBACK_TARGET=$OLD_RELEASE"
echo "ROLLBACK_CMD=ln -sfn '$OLD_RELEASE' '$LANDING_ROOT/.current.rollback' && mv -Tf '$LANDING_ROOT/.current.rollback' '$CURRENT_LINK' && nginx -t && systemctl reload nginx"
