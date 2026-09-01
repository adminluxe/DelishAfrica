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

const COURIER_GLOBAL_RAIN_TILE = require("../../assets/h2o/courier-rain-streak-tile-v3.png");
const COURIER_GLOBAL_RIVULETS = require("../../assets/h2o/courier-glass-rivulets-v3.png");
const COURIER_GLOBAL_DROPS = require("../../assets/h2o/courier-h2o-premium-v1.png");
const COURIER_SPECULAR_GLINTS = require("../../assets/h2o/courier-h2o-specular-glints-v1.png");
const COURIER_DROP_SPRITE = require("../../assets/h2o/courier-h2o-drop-sprite-v1.png");

/**
 * S10R — Courier Luminous Weather Lens.
 * Courier keeps the S10Q quiet-depth composition that earned WOW. S10R only lifts
 * specular readability: slightly brighter falling rain, sparse meniscus glints and
 * accelerating gravity beads. No curtain, no confetti, no route pulse.
 */
export function GlobalWaterAtmosphere() {
  const pathname = usePathname();
  const { height: viewportHeight } = useWindowDimensions();
  const isHome = pathname === "/" || pathname === "/home";
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const nearPhase = useRef(new Animated.Value(0)).current;
  const farPhase = useRef(new Animated.Value(0)).current;
  const glassPhase = useRef(new Animated.Value(0)).current;
  const presence = useRef(new Animated.Value(isHome ? 0 : 1)).current;
  const dropA = useRef(new Animated.Value(0)).current;
  const dropB = useRef(new Animated.Value(0)).current;
  const dropC = useRef(new Animated.Value(0)).current;

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
    nearPhase.stopAnimation();
    farPhase.stopAnimation();
    glassPhase.stopAnimation();

    if (isHome || reduceMotion) {
      nearPhase.setValue(0.34);
      farPhase.setValue(0.69);
      glassPhase.setValue(0.45);
      return undefined;
    }

    nearPhase.setValue(0);
    farPhase.setValue(0);
    glassPhase.setValue(0);

    const nearLoop = Animated.loop(
      Animated.timing(nearPhase, {
        toValue: 1,
        duration: 5600,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    const farLoop = Animated.loop(
      Animated.timing(farPhase, {
        toValue: 1,
        duration: 9400,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    const glassLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glassPhase, {
          toValue: 1,
          duration: 14600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(glassPhase, {
          toValue: 0,
          duration: 16800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    nearLoop.start();
    farLoop.start();
    glassLoop.start();
    return () => {
      nearLoop.stop();
      farLoop.stop();
      glassLoop.stop();
    };
  }, [farPhase, glassPhase, isHome, nearPhase, reduceMotion]);

  useEffect(() => {
    presence.stopAnimation();
    const target = isHome ? 0 : reduceTransparency ? 0.12 : 1;
    if (reduceMotion) {
      presence.setValue(target);
      return undefined;
    }
    Animated.timing(presence, {
      toValue: target,
      duration: isHome ? 360 : 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start();
    return undefined;
  }, [isHome, presence, reduceMotion, reduceTransparency]);

  useEffect(() => {
    dropA.stopAnimation();
    dropB.stopAnimation();
    dropC.stopAnimation();
    if (isHome || reduceMotion) {
      dropA.setValue(0.27);
      dropB.setValue(0.56);
      dropC.setValue(0.79);
      return undefined;
    }

    dropA.setValue(0);
    dropB.setValue(0);
    dropC.setValue(0);
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(dropA, {
          toValue: 1,
          duration: 11200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.delay(7200),
        Animated.timing(dropB, {
          toValue: 1,
          duration: 14600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    const loopC = Animated.loop(
      Animated.sequence([
        Animated.delay(12600),
        Animated.timing(dropC, {
          toValue: 1,
          duration: 18800,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loopA.start();
    loopB.start();
    loopC.start();
    return () => {
      loopA.stop();
      loopB.stop();
      loopC.stop();
    };
  }, [dropA, dropB, dropC, isHome, reduceMotion]);

  const tileHeight = Math.max(760, viewportHeight + 240);
  const nearFlowY = nearPhase.interpolate({ inputRange: [0, 1], outputRange: [0, tileHeight] });
  const farFlowY = farPhase.interpolate({ inputRange: [0, 1], outputRange: [0, tileHeight] });
  const glassDriftY = glassPhase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-1.2, 1.8, -1.2] });
  const glassDriftX = glassPhase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.8, 0] });
  const glassOpacity = glassPhase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.04, 0.065, 0.04] });
  const dropletOpacity = glassPhase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.36, 0.48, 0.36] });
  const glintOpacity = glassPhase.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.14, 0.26, 0.17, 0.24, 0.14],
  });
  const dropAY = dropA.interpolate({ inputRange: [0, 1], outputRange: [-190, viewportHeight + 220] });
  const dropBY = dropB.interpolate({ inputRange: [0, 1], outputRange: [-230, viewportHeight + 260] });
  const dropCY = dropC.interpolate({ inputRange: [0, 1], outputRange: [-210, viewportHeight + 240] });
  const dropAX = dropA.interpolate({ inputRange: [0, 0.28, 0.64, 1], outputRange: [0, 3.6, -2.7, 0.9] });
  const dropBX = dropB.interpolate({ inputRange: [0, 0.33, 0.68, 1], outputRange: [0, -3.5, 2.2, -0.4] });
  const dropCX = dropC.interpolate({ inputRange: [0, 0.4, 0.75, 1], outputRange: [0, 2.2, -1.8, 0.4] });

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}
    >
      <Animated.View style={[styles.layer, { opacity: presence }]}>
        <Animated.View
          style={[
            styles.rainTrack,
            {
              height: tileHeight * 2,
              opacity: 0.08,
              transform: [{ translateY: farFlowY }, { translateX: 8 }, { scaleX: 0.97 }],
            },
          ]}
        >
          <Image source={COURIER_GLOBAL_RAIN_TILE} resizeMode="stretch" blurRadius={0.28} style={[styles.rainTile, { top: -tileHeight, height: tileHeight }]} />
          <Image source={COURIER_GLOBAL_RAIN_TILE} resizeMode="stretch" blurRadius={0.28} style={[styles.rainTile, { top: 0, height: tileHeight }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.rainTrack,
            {
              height: tileHeight * 2,
              opacity: 0.145,
              transform: [{ translateY: nearFlowY }, { translateX: -3 }],
            },
          ]}
        >
          <Image
            source={COURIER_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            style={[styles.rainTile, { top: -tileHeight, height: tileHeight }]}
            onLoad={() => {
              if (__DEV__) console.log("DA_S10R_GLOBAL_RAIN_COURIER_ONLOAD");
            }}
          />
          <Image source={COURIER_GLOBAL_RAIN_TILE} resizeMode="stretch" style={[styles.rainTile, { top: 0, height: tileHeight }]} />
        </Animated.View>

        <Animated.Image
          source={COURIER_GLOBAL_RIVULETS}
          resizeMode="stretch"
          blurRadius={0.16}
          style={[
            styles.rivulets,
            {
              opacity: glassOpacity,
              transform: [{ translateX: glassDriftX }, { translateY: glassDriftY }, { scaleX: 1.004 }],
            },
          ]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_RIVULETS_COURIER_ONLOAD");
          }}
        />

        <Animated.Image
          source={COURIER_GLOBAL_DROPS}
          resizeMode="cover"
          style={[styles.dropletField, { opacity: dropletOpacity }]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_OPTICAL_COURIER_ONLOAD");
          }}
        />
        <Animated.Image
          source={COURIER_SPECULAR_GLINTS}
          resizeMode="cover"
          style={[styles.glints, { opacity: glintOpacity }]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_GLINT_COURIER_ONLOAD");
          }}
        />

        <Animated.Image
          source={COURIER_DROP_SPRITE}
          resizeMode="contain"
          style={[styles.drop, styles.dropA, { opacity: 0.42, transform: [{ translateX: dropAX }, { translateY: dropAY }, { rotate: "2deg" }, { scale: 0.8 }] }]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GRAVITY_DROP_COURIER_ONLOAD");
          }}
        />
        <Animated.Image
          source={COURIER_DROP_SPRITE}
          resizeMode="contain"
          style={[styles.drop, styles.dropB, { opacity: 0.32, transform: [{ translateX: dropBX }, { translateY: dropBY }, { rotate: "-3deg" }, { scale: 0.6 }] }]}
        />
        <Animated.Image
          source={COURIER_DROP_SPRITE}
          resizeMode="contain"
          style={[styles.drop, styles.dropC, { opacity: 0.24, transform: [{ translateX: dropCX }, { translateY: dropCY }, { rotate: "1deg" }, { scale: 0.46 }] }]}
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
  layer: {
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
  rivulets: {
    position: "absolute",
    top: -24,
    right: -10,
    bottom: -24,
    left: -10,
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
    width: 60,
    height: 82,
  },
  dropA: { left: "9%" },
  dropB: { left: "67%" },
  dropC: { left: "89%" },
});
