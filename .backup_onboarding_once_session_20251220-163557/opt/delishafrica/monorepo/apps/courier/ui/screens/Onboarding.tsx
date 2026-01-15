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
