import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

type Step = "créée" | "préparation" | "pickup" | "livrée";

export default function OrdersScreen() {
  const steps: Step[] = ["créée", "préparation", "pickup", "livrée"];
  const [step, setStep] = useState<Step>("créée");
  const idx = useMemo(() => steps.indexOf(step), [step]);

  const next = () => {
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 26, fontWeight: "900" }}>
          Commande
        </Text>
        <Text style={{ color: "#9AA6C0", marginTop: 6 }}>
          Restaurant : Thieyp
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
            Statut actuel
          </Text>
          <Text style={{ color: "#39D98A", fontSize: 18, fontWeight: "900", marginTop: 6 }}>
            {step}
          </Text>

          <View style={{ height: 12 }} />

          {steps.map((s, i) => {
            const active = i <= idx;
            return (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    marginRight: 10,
                    backgroundColor: active ? "rgba(57,217,138,0.95)" : "rgba(255,255,255,0.15)",
                  }}
                />
                <Text style={{ color: active ? "#E9EDF7" : "#9AA6C0", fontWeight: "800" }}>
                  {s}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 14 }} />

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
            Avancer statut
          </Text>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          onPress={() => setStep("créée")}
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
            Réinitialiser
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
