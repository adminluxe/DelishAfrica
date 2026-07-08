import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { base } from "./tokens";
import { useDATheme } from "./theme";

export function DAScreen({ children }: { children: React.ReactNode }) {
  const t = useDATheme();
  return <View style={{ flex: 1, backgroundColor: t.bg, padding: base.space.md }}>{children}</View>;
}

export function DAHeader({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const t = useDATheme();
  return (
    <View style={{ marginBottom: base.space.lg, flexDirection: "row", alignItems: "flex-start" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: base.font.h1, fontWeight: "800", letterSpacing: -0.5 }}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: t.muted, fontSize: base.font.body, marginTop: 6 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!right && <View style={{ marginLeft: base.space.md }}>{right}</View>}
    </View>
  );
}

export function DACard({
  children,
  style
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useDATheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: base.radius.lg,
          padding: base.space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function DAPill({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "neutral" }) {
  const t = useDATheme();
  const bg =
    tone === "ok" ? "rgba(34,197,94,0.14)"
    : tone === "warn" ? "rgba(245,158,11,0.14)"
    : tone === "bad" ? "rgba(239,68,68,0.14)"
    : "rgba(255,255,255,0.08)";

  const color =
    tone === "ok" ? t.success
    : tone === "warn" ? t.warning
    : tone === "bad" ? t.danger
    : t.muted;

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
      <Text style={{ color, fontSize: base.font.micro, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function DAButton({
  label,
  onPress,
  loading,
  variant = "primary",
  style
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
}) {
  const t = useDATheme();

  const btnBg = variant === "primary" ? t.brand : "transparent";
  const border = variant === "primary" ? "transparent" : t.border;
  const txt = variant === "primary" ? "#FFFFFF" : t.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: btnBg,
          borderColor: border,
          borderWidth: StyleSheet.hairlineWidth,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: base.radius.lg,
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }]
        },
        style
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {loading ? <ActivityIndicator /> : null}
        <Text style={{ color: txt, fontSize: base.font.body, fontWeight: "800", marginLeft: loading ? 10 : 0 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function DAText({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: TextStyle }) {
  const t = useDATheme();
  return <Text style={[{ color: muted ? t.muted : t.text, fontSize: base.font.body }, style]}>{children}</Text>;
}
