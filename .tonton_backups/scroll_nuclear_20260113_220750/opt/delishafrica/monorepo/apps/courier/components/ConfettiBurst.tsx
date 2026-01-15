// apps/courier/components/ConfettiBurst.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

type Props = {
  /** Incrémente ce nombre pour déclencher une nouvelle explosion */
  runKey: number;
  /** 0..1 */
  intensity?: number;
};

const { width: W, height: H } = Dimensions.get('window');

export default function ConfettiBurst({ runKey, intensity = 1 }: Props) {
  const seeded = useMemo(() => {
    // 5 particules ultra-light (cercles), positions & vitesses stables par run
    const baseX = W * 0.5;
    return Array.from({ length: 5 }).map((_, i) => {
      const sign = i % 2 === 0 ? -1 : 1;
      const spread = (W * 0.22 + i * 10) * sign;
      const dx = spread * (0.7 + Math.random() * 0.6);
      const dy = -(H * 0.18 + Math.random() * H * 0.12);
      const size = 8 + i * 3;
      const delay = i * 40;
      // palette “luxe” (neutre + un accent)
      const colors = ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.55)', 'rgba(240,230,200,0.85)'];
      const color = colors[(i + Math.floor(Math.random() * colors.length)) % colors.length];
      return { baseX, dx, dy, size, delay, color };
    });
  }, [runKey]);

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // reset + run
    progress.setValue(0);
    const a = Animated.timing(progress, {
      toValue: 1,
      duration: Math.floor(650 + 250 * intensity),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [runKey, intensity, progress]);

  // Styles animés dérivés
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {seeded.map((p, idx) => {
        const t = progress;
        const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] });
        const opacity = t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.95, 0] });
        const scale = t.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.9, 1.05, 1] });
        const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(idx % 2 ? 1 : -1) * (120 + idx * 25)}deg`] });

        return (
          <Animated.View
            key={idx}
            style={[
              styles.dot,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                left: p.baseX - p.size / 2,
                top: H * 0.18,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }, { rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
});
