import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

type Props = {
  visible: boolean;
  intensity?: number; // nombre de flocons
};

export default function SnowOverlay({ visible, intensity = 18 }: Props) {
  const { width, height } = Dimensions.get("window");

  const flakes = useMemo(() => {
    return Array.from({ length: intensity }).map((_, i) => {
      const size = 2 + Math.random() * 3.5;
      return {
        key: `flake_${i}`,
        x: Math.random() * Math.max(1, width - 10),
        size,
        delay: Math.floor(Math.random() * 1600),
        duration: 6720 + Math.floor(Math.random() * 2600),
        drift: (Math.random() - 0.5) * 40,
        opacity: 0.55 + Math.random() * 0.35,
      };
    });
  }, [intensity, width]);

  const anims = useRef(flakes.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;

    const loops = anims.map((a, idx) => {
      a.setValue(0);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(flakes[idx].delay),
          Animated.timing(a, {
            toValue: 1,
            duration: flakes[idx].duration,
            useNativeDriver: true,
          }),
        ])
      );
    });

    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} pointerEvents="none">
      {flakes.map((f, idx) => {
        const translateY = anims[idx].interpolate({
          inputRange: [0, 1],
          outputRange: [-20, height + 40],
        });

        const translateX = anims[idx].interpolate({
          inputRange: [0, 1],
          outputRange: [f.x, f.x + f.drift],
        });

        return (
          <Animated.View
            key={f.key}
            style={[
              styles.flake,
              {
                width: f.size,
                height: f.size,
                borderRadius: f.size / 2,
                opacity: f.opacity,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flake: {
    position: "absolute",
    top: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
});
