import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Marker } from "react-native-maps";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type LivingCourierMarkerProps = {
  coordinate: Coordinate;
  heading: number;
  running: boolean;
};

export function LivingCourierMarker({
  coordinate,
  heading,
  running,
}: LivingCourierMarkerProps) {
  const breath = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop();

    if (!running) {
      breath.stopAnimation();
      breath.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
    };
  }, [breath, running]);

  const ringScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.18],
  });

  const ringOpacity = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.05],
  });

  const coreScale = breath.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.025],
  });

  return (
    <Marker
      coordinate={coordinate}
      rotation={heading}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={running}
      zIndex={20}
    >
      <View style={styles.stage}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.core,
            { transform: [{ scale: coreScale }] },
          ]}
        >
          <Text style={styles.scooter}>🛵</Text>
        </Animated.View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  ring: {
    backgroundColor: "rgba(255, 210, 61, 0.18)",
    borderColor: "rgba(255, 241, 168, 0.72)",
    borderRadius: 31,
    borderWidth: 2,
    height: 62,
    position: "absolute",
    width: 62,
  },
  core: {
    alignItems: "center",
    backgroundColor: "#21140F",
    borderColor: "#FFFFFF",
    borderRadius: 27,
    borderWidth: 4,
    height: 54,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    width: 54,
  },
  scooter: {
    fontSize: 25,
    lineHeight: 30,
    textAlign: "center",
  },
});
