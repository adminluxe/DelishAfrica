// DA_P2A3_MAGIC_WRAPPER_V1C
// DA_P2B2B_MOTION_TRANSITION_RUNTIME_V2_V1
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import { MotionHero as MotionHeroCore } from "./MotionHeroCore";
import { MotionTransitionController } from "./MotionTransitionController";

import { MotionAmbientLayer } from "./MotionAmbientLayer";
import { MotionFocusEngine } from "./MotionFocusEngine";
type MotionHeroProps = React.ComponentProps<typeof MotionHeroCore>;
type LooseRecord = Record<string, unknown>;

function readStatus(props: MotionHeroProps): string {
  const loose = props as unknown as LooseRecord;
  const order = (loose.order ?? loose.selectedOrder) as LooseRecord | undefined;
  const raw = order?.status ?? loose.status ?? "pending";
  return String(raw).toLowerCase();
}

function statusEnergy(status: string): number {
  if (status === "delivered") return 0.45;
  if (status === "picked_up" || status === "courier_accepted") return 1;
  if (status === "ready") return 0.9;
  if (status === "accepted" || status === "preparing") return 0.75;
  return 0.6;
}

export function MotionHero(props: MotionHeroProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const breath = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const status = useMemo(() => readStatus(props), [props]);
  const energy = useMemo(() => statusEnergy(status), [status]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => mounted && setReduceMotion(enabled))
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    breath.stopAnimation();
    orbit.stopAnimation();
    shimmer.stopAnimation();

    if (reduceMotion) {
      breath.setValue(0.35);
      orbit.setValue(0);
      shimmer.setValue(0.2);
      return undefined;
    }

    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: Math.round(1700 / energy),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: Math.round(1700 / energy),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const orbitLoop = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: Math.round(5600 / energy),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: Math.round(2200 / energy),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: Math.round(2200 / energy),
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    breathLoop.start();
    orbitLoop.start();
    shimmerLoop.start();

    return () => {
      breathLoop.stop();
      orbitLoop.stop();
      shimmerLoop.stop();
    };
  }, [breath, energy, orbit, reduceMotion, shimmer, status]);

  const haloScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.045],
  });
  const haloOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.14, 0.34],
  });
  const orbitRotation = orbit.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.3],
  });
  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 10],
  });

  return (
    <MotionTransitionController
      onComplete={props.onPress}
      reduceMotion={reduceMotion}
    >
      {({ trigger }) => (
        <View
          style={styles.shell}
          accessibilityLabel="Suivi de commande DelishAfrica en direct"
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View
              style={[
                styles.halo,
                {
                  opacity: haloOpacity,
                  transform: [{ scale: haloScale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.orbit,
                { transform: [{ rotate: orbitRotation }] },
              ]}
            >
              <View style={styles.orbitSpark} />
              <View style={[styles.orbitSpark, styles.orbitSparkSecond]} />
            </Animated.View>
            <Animated.View
              style={[
                styles.shimmer,
                {
                  opacity: shimmerOpacity,
                  transform: [{ translateY: shimmerTranslate }],
                },
              ]}
            />
          </View>

          {/* DA_P2C1B_AMBIENT_MOTION_LAYER_RUNTIME_V2_V2 */}
      {/* DA_P2D1_MOTION_FOCUS_ENGINE_RUNTIME_V2_V1 */}
      <MotionFocusEngine>
        <MotionAmbientLayer status={status}>
          <MotionHeroCore {...props} onPress={trigger} />
        </MotionAmbientLayer>
      </MotionFocusEngine>
        </View>
      )}
    </MotionTransitionController>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "relative",
  },
  halo: {
    position: "absolute",
    top: -8,
    right: -8,
    bottom: -8,
    left: -8,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255, 183, 77, 0.72)",
    backgroundColor: "rgba(255, 122, 24, 0.05)",
  },
  orbit: {
    position: "absolute",
    top: -12,
    right: -12,
    bottom: -12,
    left: -12,
    borderRadius: 36,
  },
  orbitSpark: {
    position: "absolute",
    top: 1,
    left: "50%",
    width: 7,
    height: 7,
    marginLeft: -3.5,
    borderRadius: 99,
    backgroundColor: "rgba(255, 214, 128, 0.95)",
    shadowColor: "#FFB347",
    shadowOpacity: 0.75,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  orbitSparkSecond: {
    top: undefined,
    bottom: 1,
    width: 4,
    height: 4,
    marginLeft: -2,
    opacity: 0.72,
  },
  shimmer: {
    position: "absolute",
    top: "18%",
    right: 14,
    width: 2,
    height: "64%",
    borderRadius: 99,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
  },
});
