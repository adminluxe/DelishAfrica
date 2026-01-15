#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backup_phase2b_anim_$TS"

echo "== DelishAfrica | Phase 2B | Add visible animations (safe) =="
mkdir -p "$BACKUP"
cd "$ROOT"

FILES=(
  "apps/client/ui/screens/SignatureHomeClient.tsx"
  "apps/merchant/ui/screens/SignatureHomeMerchant.tsx"
  "apps/courier/ui/screens/SignatureHomeCourier.tsx"
)

backup_file() {
  local f="$1"
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP/$(dirname "$f")"
    cp -a "$f" "$BACKUP/$f"
  fi
}

patch_imports() {
  local f="$1"
  # 1) Add useRef to React import if missing
  if grep -qE "import React, \{[^}]*\} from 'react';" "$f" && ! grep -qE "import React, \{[^}]*useRef" "$f"; then
    perl -0777 -i -pe "s/import React, \\{([^}]*)\\} from 'react';/import React, {$1, useRef} from 'react';/s" "$f"
  fi

  # 2) Ensure Animated + Easing in react-native import
  if grep -qE "from 'react-native';" "$f" && ! grep -qE "Animated" "$f"; then
    # If import is destructured: import { ... } from 'react-native';
    if grep -qE "import \\{[^}]*\\} from 'react-native';" "$f"; then
      perl -0777 -i -pe "s/import \\{([^}]*)\\} from 'react-native';/import {$1, Animated, Easing} from 'react-native';/s" "$f"
    else
      # fallback: add a new import line
      perl -0777 -i -pe "s/(import .*from 'react-native';\\s*)/\$1import { Animated, Easing } from 'react-native';\\n/s" "$f"
    fi
  fi
}

inject_anim_state() {
  local f="$1"
  # Avoid double patch
  if grep -q "DA_ANIM_V1" "$f"; then
    echo "SKIP (already patched): $f"
    return
  fi

  # Insert animation refs + effect right after the apiMs state line (exists in your screens)
  # Pattern: const [apiMs, setApiMs] = useState<number>(...);
  perl -0777 -i -pe '
    s/(const\\s*\\[apiMs,\\s*setApiMs\\]\\s*=\\s*useState<[^>]+>\\([^;]*\\);\\s*)/
$1
  \\/\\/ DA_ANIM_V1
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(12)).current;
  const ctaPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, []);
/s;
  ' "$f"
}

wrap_scrollview_children() {
  local f="$1"
  # Wrap inside ScrollView with Animated.View (first occurrence only)
  # Add opening right after <ScrollView ...>
  perl -0777 -i -pe '
    s/(<ScrollView\\b[^>]*>)/$1\\n      <Animated.View style={{ opacity: enterOpacity, transform: [{ translateY: enterY }] }}>/
    s;
  ' "$f"

  # Close before </ScrollView> (first occurrence only)
  perl -0777 -i -pe '
    s/(\\s*)(<\\/ScrollView>)/$1      <\\/Animated.View>\\n$1$2/s;
  ' "$f"
}

wrap_primary_cta_once() {
  local f="$1"
  # Wrap the first component that has variant="primary" with a pulsing Animated.View
  # Works for <Button ... variant="primary" .../> or <DelishButton ... variant="primary" .../>
  perl -0777 -i -pe '
    my $wrapped = 0;
    s{
      (<(Button|DelishButton)\\b[^>]*\\bvariant="primary"[^>]*\\/>)
    }{
      if ($wrapped) { $1 }
      else {
        $wrapped = 1;
        "<Animated.View style={{ transform: [{ scale: ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }}>" .
        $1 .
        "</Animated.View>"
      }
    }gexs;
  ' "$f"
}

for f in "${FILES[@]}"; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "WARN: missing $f (skip)"
    continue
  fi

  echo "-- Patching: $f"
  backup_file "$f"
  patch_imports "$f"
  inject_anim_state "$f"
  wrap_scrollview_children "$f"
  wrap_primary_cta_once "$f"
done

echo ""
echo "DONE ✅ Backup saved at: $BACKUP"
echo "Next: press 'r' in the 3 Metro windows (client/merchant/courier)."
echo "If still no animation on iPhone: check iOS Settings > Accessibility > Motion > Reduce Motion = OFF."
