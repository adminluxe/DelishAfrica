import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";

export default function ThieypScreen() {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1 }} style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 28, fontWeight: "900" }}>
          Thieyp
        </Text>
        <Text style={{ color: "#9AA6C0", marginTop: 8, lineHeight: 20 }}>
          Le goût authentique, une UX premium — commande rapide et suivi clair.
        </Text>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1 }} style={{ height: 16 }} />

        <Pressable
          onPress={() => router.push("/orders")}
          style={{
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderRadius: 18,
            backgroundColor: "rgba(57,217,138,0.90)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#04110A", fontSize: 16, fontWeight: "900" }}>
            Commander
          </Text>
        </Pressable>

        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ flexGrow: 1 }} style={{ height: 10 }} />

        <Pressable
          onPress={() => router.back()}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 18,
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
    </ScrollView>
  );
}
