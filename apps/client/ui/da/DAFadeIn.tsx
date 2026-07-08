import React, { ReactNode, useEffect, useMemo } from "react";
import { Animated, Easing, Text } from "react-native";

type Props = {
  children?: ReactNode;
  duration?: number;
  delay?: number;
  from?: number; // opacity start
  translateY?: number; // Y offset start
  style?: any;
};

const DAFadeIn = ({
  children,
  duration = 260,
  delay = 0,
  from = 0,
  translateY = 8,
  style,
}: Props) => {
  const a = useMemo(() => new Animated.Value(from), []);
  const y = useMemo(() => new Animated.Value(translateY), []);

  useEffect(() => {
    a.setValue(from);
    y.setValue(translateY);

    Animated.parallel([
      Animated.timing(a, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [a, y, from, translateY, duration, delay]);

  // ✅ RN rule: strings/numbers must be inside <Text>
  const safeChildren =
    typeof children === "string" || typeof children === "number" ? (
      <Text>{children}</Text>
    ) : (
      children
    );

  return (
    <Animated.View style={[{ opacity: a, transform: [{ translateY: y }] }, style]}>
      {safeChildren}
    </Animated.View>
  );
};

// ✅ Support BOTH import styles:
//   import DAFadeIn from "...";
//   import { DAFadeIn } from "...";
export { DAFadeIn };
export default DAFadeIn;
