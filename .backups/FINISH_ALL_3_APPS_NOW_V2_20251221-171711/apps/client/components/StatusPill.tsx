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
