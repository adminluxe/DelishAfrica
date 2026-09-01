import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "expo-router";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

const MERCHANT_GLOBAL_RAIN_TILE = require("../../assets/h2o/merchant-rain-streak-tile-v1.png");
const MERCHANT_GLOBAL_CONDENSATION = require("../../assets/h2o/merchant-condensation-atmosphere-v3.png");
const MERCHANT_GLOBAL_DROPS = require("../../assets/h2o/merchant-h2o-premium-v1.png");
const MERCHANT_SPECULAR_GLINTS = require("../../assets/h2o/merchant-h2o-specular-glints-v1.png");
const MERCHANT_DROP_SPRITE = require("../../assets/h2o/merchant-h2o-drop-sprite-v1.png");

/**
 * S10S — Merchant Universal Rain Canopy.
 * Courier's proven two-depth rain morphology becomes a persistent Merchant weather skin
 * on every route. The accepted S10R warm condensation/specular layer remains secondary-route
 * only, so cards, forms and operational controls retain priority.
 */
export function GlobalWaterAtmosphere() {
  const pathname = usePathname();
  const { height: viewportHeight } = useWindowDimensions();
  const isHome = pathname === "/" || pathname === "/home";
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const rainNearPhase = useRef(new Animated.Value(0)).current;
  const rainFarPhase = useRef(new Animated.Value(0)).current;
  const phase = useRef(new Animated.Value(0)).current;
  const presence = useRef(new Animated.Value(isHome ? 0 : 1)).current;
  const dropA = useRef(new Animated.Value(0)).current;
  const dropB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduceMotion(value))
      .catch(() => undefined);
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((value) => mounted && setReduceTransparency(value))
      .catch(() => undefined);

    const motionSub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const transparencySub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparency,
    );

    return () => {
      mounted = false;
      motionSub.remove();
      transparencySub.remove();
    };
  }, []);

  useEffect(() => {
    rainNearPhase.stopAnimation();
    rainFarPhase.stopAnimation();
    if (reduceMotion) {
      rainNearPhase.setValue(0.34);
      rainFarPhase.setValue(0.69);
      return undefined;
    }

    rainNearPhase.setValue(0);
    rainFarPhase.setValue(0);
    const nearLoop = Animated.loop(
      Animated.timing(rainNearPhase, {
        toValue: 1,
        duration: 5600,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    const farLoop = Animated.loop(
      Animated.timing(rainFarPhase, {
        toValue: 1,
        duration: 9400,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    nearLoop.start();
    farLoop.start();
    return () => {
      nearLoop.stop();
      farLoop.stop();
    };
  }, [rainFarPhase, rainNearPhase, reduceMotion]);

  useEffect(() => {
    phase.stopAnimation();
    if (isHome || reduceMotion) {
      phase.setValue(0.43);
      return undefined;
    }
    phase.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 14200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 16400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isHome, phase, reduceMotion]);

  useEffect(() => {
    presence.stopAnimation();
    const target = isHome ? 0 : reduceTransparency ? 0.12 : 1;
    if (reduceMotion) {
      presence.setValue(target);
      return undefined;
    }
    Animated.timing(presence, {
      toValue: target,
      duration: isHome ? 360 : 680,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start();
    return undefined;
  }, [isHome, presence, reduceMotion, reduceTransparency]);

  useEffect(() => {
    dropA.stopAnimation();
    dropB.stopAnimation();
    if (isHome || reduceMotion) {
      dropA.setValue(0.29);
      dropB.setValue(0.73);
      return undefined;
    }
    dropA.setValue(0);
    dropB.setValue(0);
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.delay(6900),
        Animated.timing(dropA, {
          toValue: 1,
          duration: 26000,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.delay(15100),
        Animated.timing(dropB, {
          toValue: 1,
          duration: 33000,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loopA.start();
    loopB.start();
    return () => {
      loopA.stop();
      loopB.stop();
    };
  }, [dropA, dropB, isHome, reduceMotion]);

  const tileHeight = Math.max(760, viewportHeight + 240);
  const rainNearY = rainNearPhase.interpolate({ inputRange: [0, 1], outputRange: [0, tileHeight] });
  const rainFarY = rainFarPhase.interpolate({ inputRange: [0, 1], outputRange: [0, tileHeight] });
  const rainMasterOpacity = reduceTransparency ? 0.26 : 1;

  const condensationOpacity = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.09, 0.14, 0.09] });
  const condensationX = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-1, 1.2, -1] });
  const condensationY = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.0, -1.1, 1.0] });
  const condensationScale = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.002, 1.005, 1.002] });
  const dropletOpacity = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.38, 0.48, 0.38] });
  const glintOpacity = phase.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.12, 0.24, 0.15, 0.22, 0.12],
  });
  const dropAY = dropA.interpolate({ inputRange: [0, 1], outputRange: [-200, viewportHeight + 230] });
  const dropBY = dropB.interpolate({ inputRange: [0, 1], outputRange: [-240, viewportHeight + 270] });
  const dropAX = dropA.interpolate({ inputRange: [0, 0.3, 0.66, 1], outputRange: [0, -2.2, 2.2, 0.5] });
  const dropBX = dropB.interpolate({ inputRange: [0, 0.35, 0.7, 1], outputRange: [0, 1.8, -1.5, 0] });

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}
    >
      <View style={[styles.rainLayer, { opacity: rainMasterOpacity }]}>
        <Animated.View
          style={[
            styles.rainTrack,
            {
              height: tileHeight * 2,
              opacity: 0.08,
              transform: [{ translateY: rainFarY }, { translateX: 8 }, { scaleX: 0.97 }],
            },
          ]}
        >
          <Image
            source={MERCHANT_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            blurRadius={0.28}
            style={[styles.rainTile, { top: -tileHeight, height: tileHeight }]}
          />
          <Image
            source={MERCHANT_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            blurRadius={0.28}
            style={[styles.rainTile, { top: 0, height: tileHeight }]}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.rainTrack,
            {
              height: tileHeight * 2,
              opacity: 0.145,
              transform: [{ translateY: rainNearY }, { translateX: -3 }],
            },
          ]}
        >
          <Image
            source={MERCHANT_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            style={[styles.rainTile, { top: -tileHeight, height: tileHeight }]}
            onLoad={() => {
              if (__DEV__) console.log("DA_S10S_GLOBAL_RAIN_MERCHANT_ONLOAD");
            }}
          />
          <Image
            source={MERCHANT_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            style={[styles.rainTile, { top: 0, height: tileHeight }]}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.layer, { opacity: presence }]}>
        <Animated.Image
          source={MERCHANT_GLOBAL_CONDENSATION}
          resizeMode="cover"
          blurRadius={0.35}
          style={[
            styles.condensation,
            {
              opacity: condensationOpacity,
              transform: [{ translateX: condensationX }, { translateY: condensationY }, { scale: condensationScale }],
            },
          ]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_CONDENSATION_MERCHANT_ONLOAD");
          }}
        />
        <Animated.Image
          source={MERCHANT_GLOBAL_DROPS}
          resizeMode="cover"
          style={[styles.dropletField, { opacity: dropletOpacity }]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_OPTICAL_MERCHANT_ONLOAD");
          }}
        />
        <Animated.Image
          source={MERCHANT_SPECULAR_GLINTS}
          resizeMode="cover"
          style={[styles.glints, { opacity: glintOpacity }]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_GLINT_MERCHANT_ONLOAD");
          }}
        />

        <Animated.Image
          source={MERCHANT_DROP_SPRITE}
          resizeMode="contain"
          style={[
            styles.drop,
            styles.dropA,
            { opacity: 0.34, transform: [{ translateX: dropAX }, { translateY: dropAY }, { rotate: "-3deg" }, { scale: 0.67 }] },
          ]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GRAVITY_DROP_MERCHANT_ONLOAD");
          }}
        />
        <Animated.Image
          source={MERCHANT_DROP_SPRITE}
          resizeMode="contain"
          style={[
            styles.drop,
            styles.dropB,
            { opacity: 0.24, transform: [{ translateX: dropBX }, { translateY: dropBY }, { rotate: "2deg" }, { scale: 0.49 }] },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    elevation: 90,
    overflow: "hidden",
  },
  rainLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  rainTrack: {
    position: "absolute",
    top: 0,
    right: -18,
    left: -18,
  },
  rainTile: {
    position: "absolute",
    right: 0,
    left: 0,
    width: "100%",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  condensation: {
    position: "absolute",
    top: -18,
    right: -12,
    bottom: -18,
    left: -12,
    width: undefined,
    height: undefined,
  },
  dropletField: {
    position: "absolute",
    top: -10,
    right: -8,
    bottom: -10,
    left: -8,
    width: undefined,
    height: undefined,
  },
  glints: {
    position: "absolute",
    top: -10,
    right: -8,
    bottom: -10,
    left: -8,
    width: undefined,
    height: undefined,
  },
  drop: {
    position: "absolute",
    top: 0,
    width: 58,
    height: 80,
  },
  dropA: { left: "8%" },
  dropB: { left: "89%" },
});
