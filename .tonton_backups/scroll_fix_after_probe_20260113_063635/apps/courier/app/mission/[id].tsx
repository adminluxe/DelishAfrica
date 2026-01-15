import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

type MissionStep = "reçu" | "en_route" | "photo" | "terminée";

export default function MissionScreen() {
  const params = useLocalSearchParams();
  const id = typeof params?.id === "string" ? params.id : "mission";

  const steps: MissionStep[] = ["reçu", "en_route", "photo", "terminée"];
  const [step, setStep] = useState<MissionStep>("reçu");

  const stepIndex = useMemo(() => steps.indexOf(step), [step]);

  const next = () => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 26, fontWeight: "800" }}>
          Mission
        </Text>
        <Text style={{ color: "#9AA6C0", marginTop: 6 }}>
          ID: {id}
        </Text>

        <View
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <Text style={{ color: "#9AA6C0", fontSize: 13 }}>
            Étape en cours
          </Text>
          <Text style={{ color: "#E9EDF7", fontSize: 18, fontWeight: "800", marginTop: 6 }}>
            {step}
          </Text>

          <View style={{ height: 12 }} />

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {steps.map((s, idx) => {
              const active = idx <= stepIndex;
              return (
                <View
                  key={s}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? "rgba(57,217,138,0.45)" : "rgba(255,255,255,0.10)",
                    backgroundColor: active ? "rgba(57,217,138,0.10)" : "rgba(255,255,255,0.03)",
                  }}
                >
                  <Text style={{ color: active ? "#39D98A" : "#9AA6C0", fontWeight: "700" }}>
                    {s}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ height: 16 }} />

        <Pressable
          onPress={next}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 16,
            backgroundColor: "rgba(57,217,138,0.90)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#04110A", fontSize: 16, fontWeight: "900" }}>
            Étape suivante
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={() => router.back()}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.06)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#E9EDF7", fontSize: 16, fontWeight: "800" }}>
            Retour
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
