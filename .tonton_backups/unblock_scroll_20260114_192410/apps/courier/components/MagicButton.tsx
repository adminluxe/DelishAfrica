import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { brand, BrandKey } from './brand';

export default function MagicButton({
  app,
  label,
  onPress,
  style,
}: {
  app: BrandKey;
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const b = brand[app];
  const s = useRef(new Animated.Value(1)).current;

  const down = () =>
    Animated.spring(s, { toValue: 0.97, useNativeDriver: true, speed: 24, bounciness: 8 }).start();
  const up = () =>
    Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }).start();

  return (
    <Pressable onPress={onPress} onPressIn={down} onPressOut={up}>
      <Animated.View style={[styles.btn, { transform: [{ scale: s }], borderColor: b.accent }, style]}>
        <Text style={[styles.txt, { color: b.accent }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  txt: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
