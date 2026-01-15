import React, { useMemo } from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';
import { brand, BrandKey } from './brand';

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
    <View pointerEvents="box-none" style={[styles.root, { backgroundColor: colors[0] }]}>
      {/* gradient "soft" sans lib */}
      <View pointerEvents="none" style={[styles.layer, { backgroundColor: colors[0], opacity: 1 }]} />
      <View pointerEvents="none" style={[styles.layer, { backgroundColor: colors[1], opacity: 0.92 }]} />
      <View pointerEvents="none" style={[styles.layer, { backgroundColor: colors[2], opacity: 0.86 }]} />

      {/* blobs subtils */}
      <View style={[styles.blobA, { backgroundColor: accent, opacity: isDark ? 0.12 : 0.10 }]} />
      <View style={[styles.blobB, { backgroundColor: accent2, opacity: isDark ? 0.10 : 0.08 }]} />

      {/* voile global */}
      <View pointerEvents="none" style={[styles.vignette, { opacity: isDark ? 0.55 : 0.16 }]} />

      {/* filigrane logo */}
      <Image
        source={require('../assets/logo.jpg')}
        resizeMode="contain"
        pointerEvents="none"
        style={styles.logo}
      />

      {/* contenu */}
      <View pointerEvents="box-none" style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  layer: { ...StyleSheet.absoluteFillObject },
  blobA: {
    position: 'absolute',
    top: -140,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 999,
    transform: [{ rotate: '18deg' }],
  },
  blobB: {
    position: 'absolute',
    top: 120,
    right: -140,
    width: 340,
    height: 340,
    borderRadius: 999,
    transform: [{ rotate: '-12deg' }],
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  logo: {
    position: 'absolute',
    bottom: -60,
    right: -40,
    width: 340,
    height: 340,
    opacity: 0.075,
    transform: [{ rotate: '-8deg' }],
    zIndex: 0,
  },
  content: { flex: 1, zIndex: 2 },
});
