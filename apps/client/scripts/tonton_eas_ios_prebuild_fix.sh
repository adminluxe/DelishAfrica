#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

TEAM_ID="R238JQAKMG"

echo ""
echo "=============================="
echo "[tonton-sign] EAS prebuild fix"
echo "[tonton-sign] TEAM_ID=$TEAM_ID"
echo "=============================="
echo ""

if [[ ! -d "ios" ]]; then
  echo "[tonton-sign] ios/ not found yet -> skip pbxproj patch (will rely on later stages)"
  exit 0
fi

mapfile -t PBX < <(find ios -name project.pbxproj -maxdepth 6 2>/dev/null || true)
if [[ ${#PBX[@]} -eq 0 ]]; then
  echo "[tonton-sign] No pbxproj found under ios/"
  exit 0
fi

for f in "${PBX[@]}"; do
  python3 "scripts/tonton_patch_pbxproj_signing.py" "$f" "$TEAM_ID" || true
done

WS="$(ls -1 ios/*.xcworkspace 2>/dev/null | head -n1 || true)"
SCHEME=""
XCPROJ="$(ls -1 ios/*.xcodeproj 2>/dev/null | head -n1 || true)"
if [[ -n "$XCPROJ" ]]; then
  SCHEME="$(basename "$XCPROJ" .xcodeproj)"
fi

if [[ -n "$WS" && -n "$SCHEME" ]]; then
  echo ""
  echo "[tonton-sign] Resolving Swift Package Manager dependencies (best-effort)"
  xcodebuild -resolvePackageDependencies -workspace "$WS" -scheme "$SCHEME" -clonedSourcePackagesDirPath "$PWD/ios/SourcePackages" || true

  echo ""
  echo "[tonton-sign] BuildSettings excerpt (signing) — MUST show DEVELOPMENT_TEAM + Automatic"
  xcodebuild -showBuildSettings -workspace "$WS" -scheme "$SCHEME" 2>/dev/null \
    | egrep 'DEVELOPMENT_TEAM|CODE_SIGN_STYLE|PROVISIONING_PROFILE|PROVISIONING_PROFILE_SPECIFIER' \
    | head -n 120 || true
fi

echo ""
echo "[tonton-sign] done"
echo ""
exit 0