#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backup_phase2a_cta_${TS}"
mkdir -p "$BACKUP"

echo "== DelishAfrica | Phase 2A | CTA Button Fix (wrap + press feedback) =="
echo "Backup: $BACKUP"
echo

write_button() {
  local app="$1"
  local f="$ROOT/apps/$app/ui/components/DelishButton.tsx"

  if [[ ! -f "$f" ]]; then
    echo "⚠️  [$app] DelishButton not found at: $f (skip)"
    return 0
  fi

  mkdir -p "$BACKUP/$app"
  cp -a "$f" "$BACKUP/$app/DelishButton.tsx"

  cat > "$f" <<'TSX'
import React, { useMemo, useRef } from "react";
import { Animated, Pressable, StyleProp, Text, TextStyle, ViewStyle } from "react-native";
import { getTheme } from "../theme";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export default function DelishButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style,
  textStyle,
  testID,
}: Props) {
  const t = getTheme();

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const palette = useMemo(() => {
    const base = {
      radius: 18,
      padV: 14,
      padH: 18,
      border: "rgba(255,255,255,0.10)",
      shadow: "rgba(0,0,0,0.45)",
    };

    if (variant === "secondary") {
      return {
        ...base,
        bg: "rgba(255,255,255,0.05)",
        text: t.colors.text,
        border: "rgba(255,255,255,0.14)",
      };
    }

    if (variant === "ghost") {
      return {
        ...base,
        bg: "transparent",
        text: t.colors.text,
        border: "rgba(255,255,255,0.12)",
      };
    }

    // primary
    return {
      ...base,
      bg: t.colors.accent,
      text: "#04110B",
      border: "rgba(0,0,0,0.12)",
    };
  }, [t, variant]);

  const pressIn = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.985, duration: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.92, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={{ width: "100%" }}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Animated.View
        style={[
          {
            transform: [{ scale }],
            opacity: disabled ? 0.55 : opacity,
            backgroundColor: palette.bg,
            borderRadius: palette.radius,
            paddingVertical: palette.padV,
            paddingHorizontal: palette.padH,
            borderWidth: 1,
            borderColor: palette.border,
            shadowColor: palette.shadow,
            shadowOpacity: 0.35,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        <Text
          // ✅ KEY FIX: multiline-safe + centered + stable height feel
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.88}
          style={[
            {
              color: palette.text,
              fontSize: 18,
              lineHeight: 22,
              fontWeight: "800",
              textAlign: "center",
              includeFontPadding: false,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
TSX

  echo "✅ [$app] Patched: ui/components/DelishButton.tsx"
}

write_button "client"
write_button "merchant"
write_button "courier"

echo
echo "== DONE =="
echo "Backups saved at: $BACKUP"
echo "Next: press 'r' in the 3 Metro windows"
