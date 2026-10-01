// DA_GALA_TACTILE_INERTIA_MASS_COUPLED_ENVELOPE_V1 - shared DAButton preserves Combo35 geometry while coupling attack/release kinetics to tactile mass and safely retargeting interrupted presses; no color, copy, dependency or business mutation.\n// DA_GALA_TACTILE_KINETICS_DAMPED_RELEASE_TRIAD_HF1_V1 - shared DAButton kinetics preserve the exact disabled handler/opacity contract while adding the validated tactile triad and damped release; colors, copy and business behavior remain frozen.
// DA_GALA_INTERACTION_OSMOSIS_V1 - shared actions inherit each app chroma while deep surfaces breathe more freely; no new timer, dependency or business mutation.
import React, { useMemo, useRef } from "react";
import { Animated, Pressable, Text, StyleSheet, View } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function DAButton(props: {
  app: DAApp;
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}){
  const { app, label, onPress, variant="primary", loading=false } = props;
  const t = getDATheme(app);
  const disabled = props.disabled || loading;
  const primaryAccent = app === "merchant" ? t.colors.accent : t.colors.accent2;

  const pressProgress = useRef(new Animated.Value(0)).current;

  const pressTarget = useMemo(() => {
    if (variant === "primary" || variant === "danger") return { opacity: 0.92, x: 0.990, y: 0.982, depth: 1, origin: "center bottom" as const, attackMs: t.motion.fast, release: { stiffness: 390, damping: 36, mass: 0.82 } };
    if (variant === "secondary") return { opacity: 0.950557, x: 0.99382, y: 0.988875, depth: 0.618034, origin: "center 75%" as const, attackMs: Math.max(48, Math.round(t.motion.fast * 0.82)), release: { stiffness: 440, damping: 34, mass: 0.64 } };
    return { opacity: 0.969443, x: 0.99618, y: 0.993125, depth: 0.381966, origin: "center center" as const, attackMs: Math.max(44, Math.round(t.motion.fast * 0.68)), release: { stiffness: 500, damping: 32.5, mass: 0.52 } };
  }, [variant, t.motion.fast]);

  const pressScaleX = pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, pressTarget.x] });
  const pressScaleY = pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, pressTarget.y] });
  const pressDepth = pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, pressTarget.depth] });
  const pressOpacity = pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, pressTarget.opacity] });
  const pressOrigin = pressTarget.origin as any;

  const colors = useMemo(() => {
    if (variant === "danger") return { bg: "#2A0D12", bd: "#7A1F2A", fg: t.colors.error };
    if (variant === "secondary") return { bg: t.colors.surface0, bd: t.colors.border, fg: t.colors.text };
    if (variant === "ghost") return { bg: "transparent", bd: t.colors.border, fg: t.colors.text2 };
    return { bg: t.colors.surface1, bd: primaryAccent, fg: primaryAccent };
  }, [variant, t]);

  const pressIn = () => {
    pressProgress.stopAnimation();
    Animated.timing(pressProgress, { toValue: 1, duration: pressTarget.attackMs, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    pressProgress.stopAnimation();
    Animated.spring(pressProgress, { toValue: 0, stiffness: pressTarget.release.stiffness, damping: pressTarget.release.damping, mass: pressTarget.release.mass, overshootClamping: true, restDisplacementThreshold: 0.001, restSpeedThreshold: 0.001, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scaleX: pressScaleX }, { scaleY: pressScaleY }, { translateY: pressDepth }], opacity: disabled ? 0.55 : pressOpacity , transformOrigin: pressOrigin}}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : pressIn}
        onPressOut={disabled ? undefined : pressOut}
        style={[styles.btn, {
          backgroundColor: colors.bg,
          borderColor: colors.bd,
          borderRadius: t.radius.lg,
        }]}
      >
        <View style={styles.row}>
          <Text style={[styles.txt, { color: colors.fg }]}>{loading ? "…" : label}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: { borderWidth: 1, paddingVertical: 14, paddingHorizontal: 14 },
  row: { alignItems: "center", justifyContent: "center" },
  txt: { fontSize: 16, fontWeight: "700" },
});
