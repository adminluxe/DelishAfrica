#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "merchant" "courier")
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.backup_ui_v1_$TS"

echo "== DelishAfrica UX Foundation V1 =="
echo "Root: $ROOT"
echo "Backup: $BACKUP"
mkdir -p "$BACKUP"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }
need bash
need node
need rsync

# 1) Backup minimal (ui + app routes entry points)
echo "== 1) Backup =="
for a in "${APPS[@]}"; do
  mkdir -p "$BACKUP/apps/$a"
  [ -d "$ROOT/apps/$a/ui" ] && rsync -a "$ROOT/apps/$a/ui" "$BACKUP/apps/$a/" || true
  [ -d "$ROOT/apps/$a/app" ] && rsync -a "$ROOT/apps/$a/app" "$BACKUP/apps/$a/" || true
done

# 2) Create UI foundation per app
echo "== 2) Inject UI Foundation per app =="
for a in "${APPS[@]}"; do
  APP="$ROOT/apps/$a"
  UI="$APP/ui"
  mkdir -p "$UI/components" "$UI/hooks" "$UI/utils" "$UI/brand" "$UI/screens"

  # 2.1 Theme tokens (shared + per app accents)
  cat > "$UI/theme.ts" <<'TS'
export type DelishAccent = "client" | "merchant" | "courier";

export const DELISH_BASE = {
  radius: { sm: 10, md: 16, lg: 22, xl: 28 },
  space: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  font: { h1: 34, h2: 22, h3: 18, body: 16, small: 13 },
  shadow: {
    soft: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
    deep: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
  },
};

export const ACCENTS: Record<DelishAccent, { brand: string; brand2: string; ok: string; bg: string; card: string; text: string; subtext: string; border: string; }> = {
  client:   { brand: "#2E5BFF", brand2: "#8A5BFF", ok: "#34C759", bg: "#070A12", card: "#0E1425", text: "#F4F7FF", subtext: "#AAB6D6", border: "#1E2A4D" },
  merchant: { brand: "#FF6A2A", brand2: "#FFB547", ok: "#34C759", bg: "#070A12", card: "#111421", text: "#FFF6EF", subtext: "#D7B7A3", border: "#2B2530" },
  courier:  { brand: "#22C55E", brand2: "#60A5FA", ok: "#34C759", bg: "#070A12", card: "#0B1720", text: "#F2FFFA", subtext: "#9FC7B8", border: "#153642" },
};

export function getTheme(accent: DelishAccent) {
  const A = ACCENTS[accent];
  return {
    accent,
    ...DELISH_BASE,
    colors: {
      ...A,
      danger: "#FF3B30",
      warn: "#FF9500",
      overlay: "rgba(0,0,0,0.55)",
      shimmerBase: "rgba(255,255,255,0.08)",
      shimmerGlow: "rgba(255,255,255,0.18)",
    },
  };
}
TS

  # Accent resolver per app
  cat > "$UI/brand/accent.ts" <<TS
export const APP_ACCENT = "${a}" as const;
TS

  # 2.2 Haptics helper (safe fallback)
  cat > "$UI/utils/haptics.ts" <<'TS'
export async function hapticLight() {
  try {
    const H = await import("expo-haptics");
    await H.impactAsync(H.ImpactFeedbackStyle.Light);
  } catch {
    // noop (web / missing native)
  }
}
export async function hapticSoft() {
  try {
    const H = await import("expo-haptics");
    await H.impactAsync(H.ImpactFeedbackStyle.Soft);
  } catch {
    // noop
  }
}
TS

  # 2.3 useTheme hook
  cat > "$UI/hooks/useTheme.ts" <<'TS'
import { useMemo } from "react";
import { getTheme } from "../theme";
import { APP_ACCENT } from "../brand/accent";

export function useTheme() {
  return useMemo(() => getTheme(APP_ACCENT), []);
}
TS

  # 2.4 Button (signature)
  cat > "$UI/components/DelishButton.tsx" <<'TS'
import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";
import { hapticLight } from "../utils/haptics";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
  disabled?: boolean;
};

export default function DelishButton({ title, onPress, variant = "primary", style, disabled }: Props) {
  const T = useTheme();
  const s = useSharedValue(1);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: disabled ? 0.55 : 1,
  }));

  const bg = variant === "primary" ? T.colors.brand : "transparent";
  const bd = variant === "ghost" ? T.colors.border : "transparent";
  const tx = variant === "primary" ? "#071018" : T.colors.text;

  return (
    <Animated.View style={[aStyle, { borderRadius: T.radius.lg }, style]}>
      <Pressable
        disabled={disabled}
        onPress={async () => {
          await hapticLight();
          onPress?.();
        }}
        onPressIn={() => (s.value = withTiming(0.98, { duration: 90 }))}
        onPressOut={() => (s.value = withTiming(1, { duration: 130 }))}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: T.radius.lg,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: bd,
          alignItems: "center",
          justifyContent: "center",
          ...T.shadow.soft,
        }}
      >
        <Text style={{ color: tx, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 }}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}
TS

  # 2.5 Card
  cat > "$UI/components/DelishCard.tsx" <<'TS'
import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "../hooks/useTheme";

export default function DelishCard({ style, ...rest }: ViewProps) {
  const T = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: T.colors.card,
          borderRadius: T.radius.xl,
          borderWidth: 1,
          borderColor: T.colors.border,
          padding: T.space.lg,
          ...T.shadow.deep,
        },
        style,
      ]}
    />
  );
}
TS

  # 2.6 Shimmer (simple)
  cat > "$UI/components/ShimmerLine.tsx" <<'TS'
import React, { useEffect } from "react";
import { View, ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";

type Props = { w?: number | string; h?: number; r?: number; style?: ViewStyle };

export default function ShimmerLine({ w = "100%", h = 12, r = 10, style }: Props) {
  const T = useTheme();
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, []);

  const a = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.35 * x.value,
  }));

  return (
    <Animated.View
      style={[
        a,
        {
          width: w,
          height: h,
          borderRadius: r,
          backgroundColor: T.colors.shimmerBase,
          borderWidth: 1,
          borderColor: T.colors.border,
        },
        style,
      ]}
    />
  );
}
TS

  # 2.7 OrderTimeline (animé)
  cat > "$UI/components/OrderTimeline.tsx" <<'TS'
import React from "react";
import { View, Text } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";

type Step = { key: string; title: string; subtitle: string; done: boolean };

export default function OrderTimeline({ steps }: { steps: Step[] }) {
  const T = useTheme();

  return (
    <View style={{ gap: 12 }}>
      {steps.map((s, i) => (
        <Animated.View
          key={s.key}
          entering={FadeInUp.delay(i * 90).duration(360)}
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
            padding: 14,
            borderRadius: T.radius.lg,
            backgroundColor: "rgba(255,255,255,0.03)",
            borderWidth: 1,
            borderColor: T.colors.border,
          }}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              backgroundColor: s.done ? T.colors.ok : T.colors.border,
              marginTop: 3,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.colors.text, fontWeight: "800", fontSize: 15 }}>{s.title}</Text>
            <Text style={{ color: T.colors.subtext, marginTop: 3, lineHeight: 18 }}>{s.subtitle}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}
TS

  # 2.8 Onboarding Screen (3 slides)
  cat > "$UI/screens/Onboarding.tsx" <<'TS'
import React, { useMemo, useState } from "react";
import { View, Text, Dimensions } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import DelishButton from "../components/DelishButton";
import DelishCard from "../components/DelishCard";
import { useTheme } from "../hooks/useTheme";

const W = Dimensions.get("window").width;

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const T = useTheme();
  const slides = useMemo(() => ([
    { t: "DelishAfrica", s: "L’Afrique à table, avec une expérience mobile digne de sa grandeur." },
    { t: "Découvre • Ressens • Commande", s: "Une UI vivante, rapide, et une histoire dans chaque plat." },
    { t: "Prêt pour Thieyp", s: "Démo V1 : parcours fluide, suivi élégant, actions claires." },
  ]), []);

  const [idx, setIdx] = useState(0);
  const cur = slides[idx];

  return (
    <Animated.View entering={FadeIn.duration(250)} style={{ flex: 1, backgroundColor: T.colors.bg, padding: 18, justifyContent: "center" }}>
      <DelishCard>
        <Animated.View entering={FadeInUp.duration(350)} style={{ gap: 10 }}>
          <Text style={{ color: T.colors.brand2, fontWeight: "900", fontSize: 13, letterSpacing: 2 }}>
            ONBOARDING • V1
          </Text>
          <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 28, lineHeight: 32 }}>
            {cur.t}
          </Text>
          <Text style={{ color: T.colors.subtext, fontSize: 16, lineHeight: 22 }}>
            {cur.s}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  height: 6,
                  width: i === idx ? Math.min(64, W * 0.16) : 16,
                  borderRadius: 999,
                  backgroundColor: i === idx ? T.colors.brand : T.colors.border,
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            <DelishButton
              variant="ghost"
              title="Passer"
              onPress={onDone}
              style={{ flex: 1 }}
            />
            <DelishButton
              title={idx === slides.length - 1 ? "Entrer" : "Suivant"}
              onPress={() => {
                if (idx === slides.length - 1) onDone();
                else setIdx((v) => v + 1);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>
      </DelishCard>
    </Animated.View>
  );
}
TS

done

# 3) Ensure deps exist (reanimated + haptics)
echo "== 3) Ensure deps (expo-haptics, reanimated) =="
cd "$ROOT"
# We do a best-effort install; if already present, it’s fine.
pnpm -w -s add -D react-native-reanimated >/dev/null 2>&1 || true
pnpm -w -s add expo-haptics >/dev/null 2>&1 || true

echo "== DONE. UI Foundation injected =="
echo "Backup saved at: $BACKUP"
