#!/usr/bin/env bash
set -u
ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)

echo "=== EAS DOCTOR V2 ==="
echo "Root: $ROOT"
echo

command -v eas >/dev/null 2>&1 || { echo "eas absent -> npm i -g eas-cli"; exit 1; }

for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  echo "---- $a ----"
  if [ ! -d "$APPDIR" ]; then
    echo "SKIP: $APPDIR absent"
    echo
    continue
  fi

  cd "$APPDIR" || continue

  TMP="/tmp/expo_config_${a}.json"
  ERR="/tmp/expo_config_${a}.err"
  rm -f "$TMP" "$ERR"

  echo "[expo config -> $TMP]"
  # pas de pipe: on redirige vers fichier
  if npx expo config --type public --json >"$TMP" 2>"$ERR"; then
    :
  else
    echo "WARN: expo config a échoué. stderr:"
    sed -n '1,60p' "$ERR" || true
  fi

  if [ ! -s "$TMP" ]; then
    echo "KO: config JSON vide pour $a (voir $ERR)"
  else
    node - <<NODE
const fs=require('fs');
const cfg=JSON.parse(fs.readFileSync("$TMP","utf8"));
const e=cfg.expo||{};
console.log("slug:", e.slug);
console.log("owner:", e.owner);
console.log("scheme:", e.scheme);
console.log("ios.bundleIdentifier:", e?.ios?.bundleIdentifier);
console.log("extra.eas.projectId:", e?.extra?.eas?.projectId);
NODE
  fi

  echo
  echo "[eas project:info]"
  if eas project:info >/dev/null 2>&1; then
    eas project:info | sed -n '1,120p'
    echo "OK: EAS link present"
  else
    echo "KO: EAS link absent / projectId invalide"
    echo "=> A faire:  cd $APPDIR && eas project:init"
  fi

  echo
done
