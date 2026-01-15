import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const DA_BG_OFF = (process.env.EXPO_PUBLIC_BG_OFF === "1" || process.env.NEXT_PUBLIC_BG_OFF === "1" || process.env.BG_OFF === "1");


type Flake = {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

export default function SnowOverlay() {
  
  if (DA_BG_OFF) return null;
const { width, height } = Dimensions.get("window");
  const translateY = useRef(new Animated.Value(0)).current;

  const flakes = useMemo<Flake[]>(() => {
    const count = 28;
    return Array.from({ length: count }, (_, id) => ({
      id,
      x: Math.random() * width,
      size: 2 + Math.random() * 3.5,
      duration: 7000 + Math.random() * 6000,
      delay: Math.random() * 2500,
      opacity: 0.25 + Math.random() * 0.35,
    }));
  }, [width]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateY, {
        toValue: height + 40,
        duration: 11000,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [height, translateY]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flakes.map((f) => (
        <Animated.View
          key={f.id}
          style={[
            styles.flake,
            {
              width: f.size,
              height: f.size,
              borderRadius: f.size / 2,
              left: f.x,
              opacity: f.opacity,
              transform: [
                {
                  translateY: Animated.modulo(
                    Animated.add(translateY, new Animated.Value(f.delay)),
                    height + 60
                  ),
                },
              ],
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
    top: -40,
    backgroundColor: "#FFFFFF",
  },
});
