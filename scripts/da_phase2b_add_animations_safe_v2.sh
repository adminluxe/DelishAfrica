#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

FILES=(
  "apps/client/ui/screens/SignatureHomeClient.tsx"
  "apps/merchant/ui/screens/SignatureHomeMerchant.tsx"
  "apps/courier/ui/screens/SignatureHomeCourier.tsx"
)

echo "== DA | Phase 2B | Animations SAFE V2 (restore + patch without perl) =="

latest_backup="$(ls -1dt /root/backup_phase2b_anim_* 2>/dev/null | head -n 1 || true)"
if [ -z "${latest_backup:-}" ]; then
  echo "!! No backup found at /root/backup_phase2b_anim_*"
  echo "   I won't patch. Create/point a backup first."
  exit 1
fi

echo "== Restore from latest backup =="
echo "Backup: $latest_backup"
for f in "${FILES[@]}"; do
  if [ -f "$latest_backup/$f" ]; then
    cp -a "$latest_backup/$f" "$ROOT/$f"
    echo "RESTORED: $f"
  else
    echo "WARN: missing in backup: $latest_backup/$f"
  fi
done

echo "== Patch (python) =="
python3 - <<'PY'
import re
from pathlib import Path

ROOT = Path("/opt/delishafrica/monorepo")
files = [
  "apps/client/ui/screens/SignatureHomeClient.tsx",
  "apps/merchant/ui/screens/SignatureHomeMerchant.tsx",
  "apps/courier/ui/screens/SignatureHomeCourier.tsx",
]

def ensure_named_import(text: str, module: str, names: list[str]) -> str:
  # Find: import { A, B } from 'module';
  pat = re.compile(rf"(^\s*import\s*\{{(?P<body>[^}}]+)\}}\s*from\s*['\"]{re.escape(module)}['\"]\s*;\s*$)", re.M)
  m = pat.search(text)
  if not m:
    return text

  body = m.group("body")
  parts = [p.strip() for p in body.split(",") if p.strip()]
  s = set(parts)
  changed = False
  for n in names:
    if n not in s:
      parts.append(n)
      changed = True
  if not changed:
    return text

  new_line = f"import {{ {', '.join(parts)} }} from '{module}';"
  return text[:m.start(1)] + new_line + text[m.end(1):]

def ensure_react_useRef(text: str) -> str:
  # If: import React, { ... } from 'react';
  pat = re.compile(r"^\s*import\s+React\s*,\s*\{(?P<body>[^}]+)\}\s*from\s*['\"]react['\"]\s*;\s*$", re.M)
  m = pat.search(text)
  if m:
    body = m.group("body")
    parts = [p.strip() for p in body.split(",") if p.strip()]
    if "useRef" not in parts:
      parts.append("useRef")
      new_line = f"import React, {{ {', '.join(parts)} }} from 'react';"
      text = text[:m.start()] + new_line + text[m.end():]
    return text

  # Else if: import React from 'react';
  pat2 = re.compile(r"^\s*import\s+React\s+from\s+['\"]react['\"]\s*;\s*$", re.M)
  m2 = pat2.search(text)
  if m2:
    new_line = "import React, { useRef } from 'react';"
    text = text[:m2.start()] + new_line + text[m2.end():]
  return text

def inject_anim_block(text: str) -> str:
  if "DA_ANIM_V1" in text:
    return text

  block = r"""
  // DA_ANIM_V1
  const animIn = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(animIn, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [animIn]);

  const fadeInStyle = {
    opacity: animIn,
    transform: [
      { translateY: animIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
      { scale: animIn.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
    ],
  };
"""

  # export default function X(...) {  -> inject after the first "{"
  m = re.search(r"(export\s+default\s+function[^{]*\{)", text)
  if m:
    return text[:m.end()] + block + text[m.end():]

  # export default (...) => {  -> inject after "{"
  m2 = re.search(r"(export\s+default\s*\([^)]*\)\s*=>\s*\{)", text)
  if m2:
    return text[:m2.end()] + block + text[m2.end():]

  return text

def wrap_primary_cta_once(text: str) -> str:
  if "DA_WRAP_CTA_V1" in text:
    return text

  # Wrap only FIRST Pressable/TouchableOpacity/Button that contains "Action principale"
  pat = re.compile(r"(<[^>]*(Pressable|TouchableOpacity|Button)[^>]*>[\s\S]*?Action principale[\s\S]*?</[^>]+>)", re.I)
  m = pat.search(text)
  if not m:
    return text

  wrapped = f"<Animated.View style={{fadeInStyle}}>\n  {m.group(1)}\n</Animated.View>\n{{/* DA_WRAP_CTA_V1 */}}"
  return text[:m.start(1)] + wrapped + text[m.end(1):]

for rel in files:
  p = ROOT / rel
  if not p.exists():
    print(f"SKIP missing: {rel}")
    continue

  t = p.read_text(encoding="utf-8")

  # Clean any accidental {$1,...} lines if they somehow appear (extra safety)
  t = re.sub(r"^\s*import\s*\{\s*\$1\s*,\s*Animated\s*,\s*Easing\s*\}\s*from\s*['\"]react-native['\"]\s*;\s*$",
             "import { Animated, Easing } from 'react-native';",
             t, flags=re.M)

  # imports
  t = ensure_react_useRef(t)
  t = ensure_named_import(t, "react-native", ["Animated", "Easing"])

  # inject anim
  t = inject_anim_block(t)
  t = wrap_primary_cta_once(t)

  p.write_text(t, encoding="utf-8")
  print(f"PATCHED: {rel}")

print("DONE ✅")
PY

echo
echo "== Next steps =="
echo "1) In EACH Metro window (client/merchant/courier): press 'r'"
echo "2) If iPhone still shows no animation: Settings > Accessibility > Motion > Reduce Motion = OFF"
