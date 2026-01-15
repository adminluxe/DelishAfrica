#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/compose/apps"
[ -d "$ROOT" ] || ROOT="/opt/delishafrica/monorepo/apps"

apps=("courier" "client" "merchant")

write_common_components() {
  local APP_DIR="$1"
  mkdir -p "$APP_DIR/components"

  cat > "$APP_DIR/components/brand.ts" <<'TS'
export type BrandKey = 'courier' | 'client' | 'merchant';

export const brand = {
  courier: {
    name: 'DelishAfrica',
    accent: '#0DBF7D',
    accent2: '#1A8C7F',
    bgDark: ['#070709', '#0B0B10', '#10101A'],
    bgLight: ['#F8FFFC', '#F3FBFF', '#F0F5FF'],
  },
  client: {
    name: 'DelishAfrica',
    accent: '#3B82F6',
    accent2: '#22D3EE',
    bgDark: ['#070B12', '#0B1220', '#0A1628'],
    bgLight: ['#F7FBFF', '#F1F7FF', '#EEF6FF'],
  },
  merchant: {
    name: 'DelishAfrica',
    accent: '#B45309',   // terre cuite
    accent2: '#F59E0B',  // braise
    bgDark: ['#0A0707', '#120B0B', '#180F10'],
    bgLight: ['#FFF7F2', '#FFF2E8', '#FFF8F3'],
  },
} as const;
TS

  cat > "$APP_DIR/components/AppBackground.tsx" <<'TSX'
import React, { useMemo } from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { brand, BrandKey } from './brand';

/** Fond premium ultra-light : gradient "soft" + voile + micro texture via blocs flous */
export default function AppBackground({
  app,
  children,
}: {
  app: BrandKey;
  children: React.ReactNode;
}) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const colors = useMemo(() => {
    const b = brand[app];
    return isDark ? b.bgDark : b.bgLight;
  }, [app, isDark]);

  const accent = brand[app].accent;
  const accent2 = brand[app].accent2;

  return (
    <View style={[styles.root, { backgroundColor: colors[0] }]}>
      {/* "fake gradient" (sans lib) via 3 couches */}
      <View style={[styles.layer, { backgroundColor: colors[0], opacity: 1 }]} />
      <View style={[styles.layer, { backgroundColor: colors[1], opacity: 0.9 }]} />
      <View style={[styles.layer, { backgroundColor: colors[2], opacity: 0.85 }]} />

      {/* blobs subtils */}
      <View style={[styles.blob, styles.blobA, { backgroundColor: accent, opacity: isDark ? 0.12 : 0.10 }]} />
      <View style={[styles.blob, styles.blobB, { backgroundColor: accent2, opacity: isDark ? 0.10 : 0.08 }]} />

      {/* voile global pour le contraste */}
      <View style={[styles.vignette, { opacity: isDark ? 0.55 : 0.18 }]} />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { ...StyleSheet.absoluteFillObject },
  content: { flex: 1 },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
    transform: [{ rotate: '12deg' }],
  },
  blobA: { width: 520, height: 520, right: -180, top: -140, filter: undefined as any },
  blobB: { width: 620, height: 420, left: -220, bottom: -180, filter: undefined as any },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
});
TSX

  cat > "$APP_DIR/components/HeroHeader.tsx" <<'TSX'
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brand, BrandKey } from './brand';

export default function HeroHeader({
  app,
  title = 'DelishAfrica',
  subtitle,
  pill,
}: {
  app: BrandKey;
  title?: string;
  subtitle?: string;
  pill?: string;
}) {
  const b = brand[app];

  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {pill ? (
          <View style={[styles.pill, { borderColor: b.accent + '44' }]}>
            <View style={[styles.dot, { backgroundColor: b.accent }]} />
            <Text style={styles.pillText}>{pill}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 10 },
  center: { alignItems: 'center' },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: 0.2, color: '#F3F4F6' },
  subtitle: { marginTop: 6, fontSize: 15, color: '#9CA3AF' },
  pill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dot: { width: 8, height: 8, borderRadius: 99, marginRight: 8 },
  pillText: { color: '#E5E7EB', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },
});
TSX

  cat > "$APP_DIR/components/MagicButton.tsx" <<'TSX'
import React, { useMemo, useRef } from 'react';
import { Pressable, Text, StyleSheet, Animated, View } from 'react-native';
import { brand, BrandKey } from './brand';

export default function MagicButton({
  app,
  label,
  onPress,
  variant = 'primary',
}: {
  app: BrandKey;
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
}) {
  const b = brand[app];
  const s = useRef(new Animated.Value(1)).current;

  const bg = useMemo(() => {
    if (variant === 'ghost') return 'rgba(255,255,255,0.06)';
    return b.accent;
  }, [b.accent, variant]);

  const text = variant === 'ghost' ? '#E5E7EB' : '#061014';

  return (
    <Animated.View style={{ transform: [{ scale: s }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(s, { toValue: 0.98, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(s, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start()}
        style={[styles.btn, { backgroundColor: bg }, variant === 'primary' ? styles.shadow : null]}
      >
        {/* glow subtil */}
        {variant === 'primary' ? <View style={[styles.glow, { backgroundColor: b.accent2 }]} /> : null}
        <Text style={[styles.label, { color: text }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 999,
    opacity: 0.18,
    right: -90,
    top: -110,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});
TSX

  cat > "$APP_DIR/components/StatusPill.tsx" <<'TSX'
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { brand, BrandKey } from './brand';

export default function StatusPill({ app, ok, text }: { app: BrandKey; ok: boolean; text: string }) {
  const b = brand[app];
  return (
    <View style={[styles.pill, { borderColor: (ok ? b.accent : '#EF4444') + '55' }]}>
      <View style={[styles.dot, { backgroundColor: ok ? b.accent : '#EF4444' }]} />
      <Text style={styles.t}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dot: { width: 8, height: 8, borderRadius: 99, marginRight: 8 },
  t: { color: '#E5E7EB', fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
});
TSX
}

patch_screen_file() {
  local APP_DIR="$1"
  local APP_KEY="$2"

  local FILE=""
  if [ -f "$APP_DIR/app/home.tsx" ]; then FILE="$APP_DIR/app/home.tsx"; fi
  if [ -z "$FILE" ] && [ -f "$APP_DIR/app/index.tsx" ]; then FILE="$APP_DIR/app/index.tsx"; fi
  if [ -z "$FILE" ]; then
    echo "⚠️  Aucun app/home.tsx ou app/index.tsx trouvé dans $APP_DIR — skip"
    return 0
  fi

  cp -a "$FILE" "$FILE.bak.$(date +%Y%m%d_%H%M%S)"

  # inject imports si pas déjà
  if ! grep -q "AppBackground" "$FILE"; then
    perl -0777 -i -pe "s/(import .*?;\\n)/\$1import AppBackground from '..\\/components\\/AppBackground';\\nimport HeroHeader from '..\\/components\\/HeroHeader';\\nimport MagicButton from '..\\/components\\/MagicButton';\\nimport StatusPill from '..\\/components\\/StatusPill';\\n/si" "$FILE" || true
  fi

  # wrap le return(...) avec AppBackground
  if ! grep -q "app=\"$APP_KEY\"" "$FILE"; then
    perl -0777 -i -pe "s/return\\s*\\(\\s*/return (\\n    <AppBackground app=\\\"$APP_KEY\\\">\\n/si" "$FILE" || true
    perl -0777 -i -pe "s/\\n\\s*\\);\\s*\\n/\\n    <\\/AppBackground>\\n  );\\n/si" "$FILE" || true
  fi

  echo "✅ Patch screen: $FILE"
}

for app in "${apps[@]}"; do
  APP_DIR="$ROOT/$app"
  if [ ! -d "$APP_DIR" ]; then
    echo "⚠️  App dir absent: $APP_DIR — skip"
    continue
  fi

  echo "==> $app"
  write_common_components "$APP_DIR"
  patch_screen_file "$APP_DIR" "$app"
done

echo "✅ Magic pack installé. Relance expo (-c) pour voir."
