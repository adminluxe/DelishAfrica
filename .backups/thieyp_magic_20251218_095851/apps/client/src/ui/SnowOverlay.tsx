import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width, height } = Dimensions.get("window");

type Props = {
  visible: boolean;
  intensity?: number; // 20..80
};

export default function SnowOverlay({ visible, intensity = 42 }: Props) {
  const flakes = useMemo(() => {
    const n = Math.max(20, Math.min(80, intensity));
    return Array.from({ length: n }).map((_, i) => ({
      key: `flake_${i}`,
      x: Math.random() * width,
      size: 2 + Math.random() * 4,
      duration: 2500 + Math.random() * 2500,
      delay: Math.random() * 1200,
      drift: -30 + Math.random() * 60
    }));
  }, [intensity]);

  const anims = useRef(
    flakes.map(() => ({
      y: new Animated.Value(-20 - Math.random() * height),
      x: new Animated.Value(0),
      o: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    const loops = anims.map((a, idx) => {
      a.y.setValue(-40 - Math.random() * 120);
      a.x.setValue(0);
      a.o.setValue(0);

      const loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.delay(flakes[idx]?.delay ?? 0),
            Animated.timing(a.o, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]),
          Animated.timing(a.y, {
            toValue: height + 60,
            duration: flakes[idx]?.duration ?? 3200,
            useNativeDriver: true,
          }),
          Animated.timing(a.x, {
            toValue: flakes[idx]?.drift ?? 0,
            duration: flakes[idx]?.duration ?? 3200,
            useNativeDriver: true,
          }),
        ])
      );

      loop.start();
      return loop;
    });

    return () => {
      loops.forEach((l) => l?.stop?.());
    };
  }, [visible, anims, flakes]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flakes.map((f, i) => (
        <Animated.View
          key={f.key}
          style={[
            styles.flake,
            {
              width: f.size,
              height: f.size,
              borderRadius: f.size,
              transform: [
                { translateX: f.x },
                { translateY: anims[i].y },
                { translateX: anims[i].x },
              ],
              opacity: anims[i].o,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flake: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#ffffff",
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});
