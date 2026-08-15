import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type MotionTransitionState = {
  opening: boolean;
  trigger: () => void;
};

type MotionTransitionControllerProps = {
  children: (state: MotionTransitionState) => React.ReactNode;
  duration?: number;
  onComplete: () => void;
  reduceMotion: boolean;
};

export function MotionTransitionController({
  children,
  duration = 220,
  onComplete,
  reduceMotion,
}: MotionTransitionControllerProps) {
  const [opening, setOpening] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setOpening(false);
    progress.setValue(0);
  }, [progress]);

  useEffect(() => {
    return () => {
      animationRef.current?.stop();
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const trigger = useCallback(() => {
    if (opening) return;

    setOpening(true);

    if (reduceMotion) {
      try {
        onComplete();
      } catch (error) {
        reset();
        throw error;
      }
      return;
    }

    progress.setValue(0);

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animationRef.current = animation;

    animation.start(({ finished }) => {
      if (!finished) {
        reset();
        return;
      }

      try {
        onComplete();
      } catch (error) {
        reset();
        throw error;
      }

      resetTimerRef.current = setTimeout(reset, 900);
    });
  }, [duration, onComplete, opening, progress, reduceMotion, reset]);

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
  });

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.975],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View
      accessibilityState={{ busy: opening }}
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      {children({ opening, trigger })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
});
