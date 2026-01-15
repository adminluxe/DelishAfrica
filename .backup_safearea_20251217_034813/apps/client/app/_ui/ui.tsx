import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { makeTheme } from "./theme";

export const theme = makeTheme("__ACCENT__");

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg0, paddingHorizontal: 16, paddingTop: 18 }}>
      {/* watermark */}
      <Text
        style={{
          position: "absolute",
          right: 12,
          bottom: 18,
          fontSize: 44,
          fontWeight: "900",
          color: "rgba(255,255,255,0.03)",
          transform: [{ rotate: "-12deg" }],
        }}
      >
        Delish
      </Text>

      {children}
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: theme.text, fontSize: 26, fontWeight: "900", letterSpacing: 0.2 }}>{children}</Text>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: theme.muted, fontSize: 14, marginTop: 6, lineHeight: 20 }}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Badge({ label, kind }: { label: string; kind: "ok" | "warn" | "bad" | "neutral" }) {
  const bg =
    kind === "ok" ? "rgba(34,197,94,0.14)" :
    kind === "warn" ? "rgba(245,158,11,0.14)" :
    kind === "bad" ? "rgba(239,68,68,0.14)" :
    "rgba(255,255,255,0.10)";

  const fg =
    kind === "ok" ? theme.ok :
    kind === "warn" ? theme.warn :
    kind === "bad" ? theme.bad :
    theme.text;

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
}) {
  const base = {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  const style =
    variant === "primary"
      ? { ...base, backgroundColor: theme.accent }
      : { ...base, backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border };

  const color = variant === "primary" ? "#FFFFFF" : theme.text;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, style]}>
      <Text style={{ color, fontWeight: "900" }}>{title}</Text>
    </Pressable>
  );
}