import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
} from "react-native";

type MotionFocusEngineProps = {
  children: React.ReactNode;
};

export function MotionFocusEngine({
  children,
}: MotionFocusEngineProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active"
  );

  const focus = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => undefined);

    const reduceMotionSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(Boolean(enabled))
    );

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => setAppActive(nextState === "active")
    );

    return () => {
      mounted = false;
      reduceMotionSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    focus.stopAnimation();

    if (reduceMotion || !appActive) {
      focus.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(focus, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(focus, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [appActive, focus, reduceMotion]);

  const scale = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.006],
  });

  const translateY = focus.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -1.5],
  });

  return (
    <Animated.View
      style={[
        styles.root,
        {
          transform: [{ scale }, { translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
});
