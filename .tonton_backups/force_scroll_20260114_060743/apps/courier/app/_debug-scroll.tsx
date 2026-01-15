import React from "react";
import { ScrollView, Text, View } from "react-native";

export default function DebugScroll() {
  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
      <Text style={{ fontSize: 28, fontWeight: "800", marginBottom: 12 }}>
        Debug Scroll
      </Text>

      {Array.from({ length: 60 }).map((_, i) => (
        <View
          key={i}
          style={{
            padding: 16,
            borderRadius: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            Item #{i + 1}
          </Text>
          <Text style={{ opacity: 0.8, marginTop: 6 }}>
            Si tu peux scroller ici, le scroll “de base” marche.
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
