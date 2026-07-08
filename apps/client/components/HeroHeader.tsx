import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { brand, BrandKey } from './brand';

export default function HeroHeader({
  app,
  title,
  subtitle,
}: {
  app: BrandKey;
  title: string;
  subtitle?: string;
}) {
  const b = brand[app];
  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>index</Text>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={[styles.rule, { backgroundColor: b.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10,
    alignItems: 'center',
  },
  kicker: {
    opacity: 0.65,
    marginBottom: 6,
    fontSize: 14,
    letterSpacing: 1,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    opacity: 0.75,
    textAlign: 'center',
  },
  rule: {
    height: 3,
    width: 72,
    borderRadius: 99,
    marginTop: 12,
    opacity: 0.75,
  },
});
