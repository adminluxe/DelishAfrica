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
