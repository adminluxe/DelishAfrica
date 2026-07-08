import React, { useEffect, useMemo } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

type Props = {
  trigger: number; // change value to re-burst
  count?: number;
  durationMs?: number;
};

type Particle = {
  key: string;
  x: number;
  size: number;
  rot: number;
  delay: number;
};

const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#B983FF", "#FF8FAB"];

export default function POGConfetti({ trigger, count = 42, durationMs = 1600 }: Props) {
  const { width, height } = useWindowDimensions();

  const particles: Particle[] = useMemo(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        key: `p_${trigger}_${i}`,
        x: Math.random() * width,
        size: 6 + Math.random() * 10,
        rot: Math.random() * 180,
        delay: Math.floor(Math.random() * 220),
      });
    }
    return arr;
  }, [trigger, count, width]);

  const anim = useMemo(() => new Animated.Value(0), [trigger]);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: durationMs,
      delay: 0,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim, durationMs, trigger]);

  // Fade out toward end
  const opacity = anim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 1, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => {
        const color = COLORS[i % COLORS.length];
        const fall = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, height + 40],
        });
        const drift = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (Math.random() - 0.5) * 140],
        });
        const spin = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [`${p.rot}deg`, `${p.rot + 540}deg`],
        });

        return (
          <Animated.View
            key={p.key}
            style={[
              styles.particle,
              {
                left: p.x,
                width: p.size,
                height: p.size * 1.6,
                backgroundColor: color,
                opacity,
                transform: [
                  { translateY: fall },
                  { translateX: drift },
                  { rotate: spin },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
    top: 0,
    borderRadius: 2,
  },
});
