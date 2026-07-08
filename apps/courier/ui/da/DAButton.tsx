import React, { useMemo, useRef } from "react";
import { Animated, Pressable, Text, StyleSheet, View } from "react-native";
import type { DAApp } from "./tokens";
import { getDATheme } from "./theme";

const APP: DAApp = "courier";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function DAButton(props: {
  app?: DAApp;
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}){
  const { app = APP, label, onPress, variant="primary", loading=false } = props;
  const t = getDATheme(app);
  const disabled = props.disabled || loading;

  const scale = useRef(new Animated.Value(1)).current;

  const colors = useMemo(() => {
    if (variant === "danger") return { bg: "#2A0D12", bd: "#7A1F2A", fg: t.colors.error };
    if (variant === "secondary") return { bg: t.colors.surface1, bd: t.colors.border, fg: t.colors.text };
    if (variant === "ghost") return { bg: "transparent", bd: t.colors.border, fg: t.colors.text2 };
    return { bg: "#1A243D", bd: "#2E3A5C", fg: t.colors.accent2 };
  }, [variant, t]);

  const pressIn = () => Animated.timing(scale, { toValue: 0.985, duration: t.motion.fast, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1, duration: t.motion.fast, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.55 : 1 }}>
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