import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MotionETA } from "./MotionETA";
import { MotionProgress } from "./MotionProgress";

type MotionHeroProps = {
  eta: string;
  status?: string | null;
  title?: string;
  subtitle?: string;
  onPress: () => void;
};

type MotionState = {
  label: string;
  progress: number;
};

function stateFor(status?: string | null): MotionState {
  const value = String(status || "").trim().toLowerCase();

  if (value === "pending") {
    return { label: "Commande confirmée", progress: 0.18 };
  }

  if (value === "accepted") {
    return { label: "Préparation en cours", progress: 0.38 };
  }

  if (["ready", "courier_proposed", "courier_accepted"].includes(value)) {
    return { label: "Prête pour le coursier", progress: 0.58 };
  }

  if (value === "picked_up") {
    return { label: "Le coursier est en route", progress: 0.82 };
  }

  if (value === "delivered") {
    return { label: "Commande livrée", progress: 1 };
  }

  return { label: "Suivi en direct actif", progress: 0.48 };
}

export function MotionHero({
  eta,
  status,
  title = "Votre commande est en mouvement",
  subtitle = "Suivez le parcours du coursier en temps réel sur la carte DelishAfrica®.",
  onPress,
}: MotionHeroProps) {
  const motionState = useMemo(() => stateFor(status), [status]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(Boolean(enabled)),
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    pulse.stopAnimation();
    halo.stopAnimation();

    if (reduceMotion) {
      pulse.setValue(0);
      halo.setValue(0);
      return undefined;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    haloLoop.start();

    return () => {
      pulseLoop.stop();
      haloLoop.stop();
    };
  }, [halo, pulse, reduceMotion]);

  const badgeScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.045],
  });

  const badgeOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1],
  });

  const haloScale = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.04],
  });

  const haloOpacity = halo.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.22],
  });

  return (
    <View style={styles.card}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Animated.View
            accessibilityRole="text"
            accessibilityLabel="Suivi en direct actif"
            style={[
              styles.badge,
              {
                opacity: badgeOpacity,
                transform: [{ scale: badgeScale }],
              },
            ]}
          >
            <View style={styles.dot} />
            <Text style={styles.badgeText}>LIVE</Text>
          </Animated.View>

          <MotionETA eta={eta} reduceMotion={reduceMotion} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{motionState.label}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Suivre ma commande sur la carte"
          accessibilityHint="Ouvre la carte de suivi en direct de votre commande"
          onPress={onPress}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Suivre ma commande</Text>
        </Pressable>

        <MotionProgress
          progress={motionState.progress}
          label={motionState.label}
          reduceMotion={reduceMotion}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#0C4B3B",
    padding: 18,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(170,255,219,0.16)",
    shadowColor: "#071F18",
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  halo: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 999,
    right: -90,
    top: -110,
    backgroundColor: "#54E2A6",
  },
  content: {
    position: "relative",
    zIndex: 2,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#72F3B2",
    shadowColor: "#72F3B2",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  badgeText: {
    color: "#E8FFF4",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    marginTop: 18,
  },
  subtitle: {
    color: "rgba(239,255,248,0.76)",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 7,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#F4B95C",
  },
  statusText: {
    flex: 1,
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 16,
    transform: [{ scale: 1 }],
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  buttonText: {
    color: "#123D31",
    fontSize: 15,
    fontWeight: "900",
  },
});
