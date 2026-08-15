import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type MotionETAProps = {
  eta: string;
  reduceMotion: boolean;
};

export function MotionETA({ eta, reduceMotion }: MotionETAProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const previousEta = useRef(eta);

  useEffect(() => {
    if (previousEta.current === eta) return;
    previousEta.current = eta;

    opacity.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -7,
          duration: 110,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.97,
          duration: 110,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 16,
          stiffness: 180,
          mass: 0.6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [eta, opacity, reduceMotion, scale, translateY]);

  return (
    <Animated.Text
      accessibilityRole="text"
      accessibilityLabel={`Temps estimé ${eta}`}
      style={[
        styles.eta,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      {eta}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  eta: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -1,
  },
});
