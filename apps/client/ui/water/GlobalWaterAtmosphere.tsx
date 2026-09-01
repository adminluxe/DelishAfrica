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

const CLIENT_GLOBAL_RAIN_TILE = require("../../assets/h2o/client-rain-streak-tile-v1.png");
const CLIENT_GLOBAL_WET_LENS = require("../../assets/h2o/client-h2o-raster-premium-v1.png");
const CLIENT_SPECULAR_GLINTS = require("../../assets/h2o/client-h2o-specular-glints-v1.png");
const CLIENT_DROP_SPRITE = require("../../assets/h2o/client-h2o-drop-sprite-v1.png");

/**
 * S10S — Client Universal Rain Canopy.
 * The accepted S10R wet-glass optical layer remains secondary-route only.
 * A separate global rain canopy uses Courier's proven rain morphology and timing
 * on every Client route, including Home, without duplicating the local wet-lens engine.
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
      phase.setValue(0.41);
      return undefined;
    }

    phase.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 15400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 14600,
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
    const target = isHome ? 0 : reduceTransparency ? 0.14 : 1;
    if (reduceMotion) {
      presence.setValue(target);
      return undefined;
    }
    Animated.timing(presence, {
      toValue: target,
      duration: isHome ? 360 : 620,
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
      dropA.setValue(0.31);
      dropB.setValue(0.71);
      return undefined;
    }

    dropA.setValue(0);
    dropB.setValue(0);
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.delay(3300),
        Animated.timing(dropA, {
          toValue: 1,
          duration: 19600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.delay(11100),
        Animated.timing(dropB, {
          toValue: 1,
          duration: 24600,
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

  const translateX = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-1.3, 1.25, -1.3] });
  const translateY = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, -1.2, 0.6] });
  const scale = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.003, 1.006, 1.003] });
  const lensOpacity = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.53, 0.67, 0.53] });
  const glintOpacity = phase.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0.13, 0.24, 0.16, 0.22, 0.13],
  });
  const dropAY = dropA.interpolate({ inputRange: [0, 1], outputRange: [-205, viewportHeight + 235] });
  const dropBY = dropB.interpolate({ inputRange: [0, 1], outputRange: [-245, viewportHeight + 275] });
  const dropAX = dropA.interpolate({ inputRange: [0, 0.28, 0.62, 1], outputRange: [0, 2.2, -1.3, 0.8] });
  const dropBX = dropB.interpolate({ inputRange: [0, 0.32, 0.68, 1], outputRange: [0, -1.8, 2, -0.6] });

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
            source={CLIENT_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            blurRadius={0.28}
            style={[styles.rainTile, { top: -tileHeight, height: tileHeight }]}
          />
          <Image
            source={CLIENT_GLOBAL_RAIN_TILE}
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
            source={CLIENT_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            style={[styles.rainTile, { top: -tileHeight, height: tileHeight }]}
            onLoad={() => {
              if (__DEV__) console.log("DA_S10S_GLOBAL_RAIN_CLIENT_ONLOAD");
            }}
          />
          <Image
            source={CLIENT_GLOBAL_RAIN_TILE}
            resizeMode="stretch"
            style={[styles.rainTile, { top: 0, height: tileHeight }]}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.layer, { opacity: presence }]}>
        <Animated.Image
          source={CLIENT_GLOBAL_WET_LENS}
          resizeMode="cover"
          style={[
            styles.lens,
            {
              opacity: lensOpacity,
              transform: [{ translateX }, { translateY }, { scale }],
            },
          ]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_OPTICAL_CLIENT_ONLOAD");
          }}
        />
        <Animated.Image
          source={CLIENT_SPECULAR_GLINTS}
          resizeMode="cover"
          style={[
            styles.glints,
            {
              opacity: glintOpacity,
              transform: [{ translateX }, { translateY }, { scale }],
            },
          ]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GLOBAL_GLINT_CLIENT_ONLOAD");
          }}
        />

        <Animated.Image
          source={CLIENT_DROP_SPRITE}
          resizeMode="contain"
          style={[
            styles.drop,
            styles.dropA,
            { opacity: 0.42, transform: [{ translateX: dropAX }, { translateY: dropAY }, { rotate: "1deg" }, { scale: 0.78 }] },
          ]}
          onLoad={() => {
            if (__DEV__) console.log("DA_S10R_GRAVITY_DROP_CLIENT_ONLOAD");
          }}
        />
        <Animated.Image
          source={CLIENT_DROP_SPRITE}
          resizeMode="contain"
          style={[
            styles.drop,
            styles.dropB,
            { opacity: 0.29, transform: [{ translateX: dropBX }, { translateY: dropBY }, { rotate: "-3deg" }, { scale: 0.54 }] },
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
  lens: {
    position: "absolute",
    top: -12,
    right: -10,
    bottom: -12,
    left: -10,
    width: undefined,
    height: undefined,
  },
  glints: {
    position: "absolute",
    top: -12,
    right: -10,
    bottom: -12,
    left: -10,
    width: undefined,
    height: undefined,
  },
  drop: {
    position: "absolute",
    top: 0,
    width: 54,
    height: 76,
  },
  dropA: { left: "89%" },
  dropB: { left: "6%" },
});
