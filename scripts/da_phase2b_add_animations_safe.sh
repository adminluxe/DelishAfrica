#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
BACKUP="/root/backup_phase2b_anim_$(date +%F_%H%M%S)"

echo "== DelishAfrica | Phase 2B | Add visible animations (safe) =="
mkdir -p "$BACKUP"

FILES=(
  "apps/client/ui/screens/SignatureHomeClient.tsx"
  "apps/merchant/ui/screens/SignatureHomeMerchant.tsx"
  "apps/courier/ui/screens/SignatureHomeCourier.tsx"
)

backup_file() {
  local f="$1"
  [ -f "$ROOT/$f" ] || { echo "!! missing: $ROOT/$f"; return 0; }
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -a "$ROOT/$f" "$BACKUP/$f"
}

patch_imports() {
  local f="$1"
  local p="$ROOT/$f"
  [ -f "$p" ] || return 0

  # 1) React import -> add useRef if needed (safe)
  if grep -qE "import React, \{[^}]*useRef[^}]*\} from ['\"]react['\"];" "$p"; then
    : # already has useRef
  else
    if grep -qE "import React, \{[^}]+\} from ['\"]react['\"];" "$p"; then
      # IMPORTANT: use double quotes for perl; escape backref with \$1
      perl -0777 -i -pe "s/import React, \\{([^}]+)\\} from ['\\\"]react['\\\"];?/import React, {\\\$1, useRef} from 'react';/s" "$p"
    elif grep -qE "import React from ['\"]react['\"];" "$p"; then
      perl -0777 -i -pe "s/import React from ['\\\"]react['\\\"];?/import React, { useRef } from 'react';/s" "$p"
    else
      # If file has no React import, we don't force-insert (ultra safe)
      :
    fi
  fi

  # 2) react-native import -> add Animated + Easing if missing (safe)
  if grep -qE "from ['\"]react-native['\"];" "$p"; then
    if grep -qE "import \{[^}]*Animated[^}]*\} from ['\"]react-native['\"];" "$p"; then
      : # has Animated
    else
      # If destructured import exists, append Animated,Easing
      if grep -qE "import \{[^}]+\} from ['\"]react-native['\"];" "$p"; then
        perl -0777 -i -pe "s/import \\{([^}]+)\\} from ['\\\"]react-native['\\\"];?/import {\\\$1, Animated, Easing} from 'react-native';/s" "$p"
      else
        # No destructured import; inject a new one at top (after first import)
        perl -0777 -i -pe "s/(^import[^\\n]*\\n)/\\\$1import { Animated, Easing } from 'react-native';\\n/s" "$p"
      fi
    fi
  fi
}

inject_anim_block() {
  local f="$1"
  local p="$ROOT/$f"
  [ -f "$p" ] || return 0

  # Avoid double patch
  if grep -q "DA_ANIM_V1" "$p"; then
    echo "SKIP (already patched): $f"
    return 0
  fi

  # Insert a small, harmless animation block near the top of component body:
  # - fade in header / CTA (scale+opacity)
  # - uses useRef + Animated + Easing
  #
  # Strategy:
  # 1) Find first occurrence of "export default function" or "export default" component
  # 2) Insert block after the first "{" that opens the function body (best effort, safe)
  perl -0777 -i -pe "s/(export default function[^{]*\\{)/\\\$1\\n\\n \\/\\/ DA_ANIM_V1\\n  const animIn = useRef(new Animated.Value(0)).current;\\n  React.useEffect(() => {\\n    Animated.timing(animIn, {\\n      toValue: 1,\\n      duration: 650,\\n      easing: Easing.out(Easing.cubic),\\n      useNativeDriver: true,\\n    }).start();\\n  }, [animIn]);\\n\\n  const fadeInStyle = {\\n    opacity: animIn,\\n    transform: [\\n      { translateY: animIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },\\n      { scale: animIn.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },\\n    ],\\n  };\\n/s" "$p"

  # If the file uses "export default () =>" pattern, handle it too
  if ! grep -q "DA_ANIM_V1" "$p"; then
    perl -0777 -i -pe "s/(export default\\s*\\([^)]*\\)\\s*=>\\s*\\{)/\\\$1\\n\\n  \\/\\/ DA_ANIM_V1\\n  const animIn = useRef(new Animated.Value(0)).current;\\n  React.useEffect(() => {\\n    Animated.timing(animIn, {\\n      toValue: 1,\\n      duration: 650,\\n      easing: Easing.out(Easing.cubic),\\n      useNativeDriver: true,\\n    }).start();\\n  }, [animIn]);\\n\\n  const fadeInStyle = {\\n    opacity: animIn,\\n    transform: [\\n      { translateY: animIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },\\n      { scale: animIn.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },\\n    ],\\n  };\\n/s" "$p"
  fi
}

wrap_primary_cta_once() {
  local f="$1"
  local p="$ROOT/$f"
  [ -f "$p" ] || return 0

  # Ultra-safe: only wrap the FIRST occurrence of a Pressable/Button block we detect with "Action principale" text.
  # If not found, we do nothing.
  if grep -q "DA_WRAP_CTA_V1" "$p"; then
    return 0
  fi

  perl -0777 -i -pe "s/(<[^>]*(Pressable|TouchableOpacity|Button)[^>]*>[\\s\\S]*?Action principale[\\s\\S]*?<\\/[^>]+>)/<Animated.View style={fadeInStyle}>\\n  \\1\\n<\\/Animated.View>\\n{\\/\\* DA_WRAP_CTA_V1 \\*\\/}/s" "$p" || true
}

echo "== Backup =="
for f in "${FILES[@]}"; do backup_file "$f"; done
echo "DONE ✅ Backup saved at: $BACKUP"

echo "== Patch imports + inject anim =="
for f in "${FILES[@]}"; do
  echo "-- $f"
  patch_imports "$f"
  inject_anim_block "$f"
  wrap_primary_cta_once "$f"
done

echo "DONE ✅"
echo "Next: press 'r' in the 3 Metro windows (client/courier/merchant)."
echo "If still no animation on iPhone: Settings > Accessibility > Motion > Reduce Motion = OFF."
