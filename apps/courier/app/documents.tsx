/* DA_V5_1_PAGE */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";

function DocItem({
  title,
  subtitle,
  disabled,
}: {
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={!!disabled}
      onPress={() => {}}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        opacity: disabled ? 0.45 : 0.95,
        gap: 4,
      }}
    >
      <Text style={{ fontWeight: "900" }}>{title}</Text>
      <Text style={{ opacity: 0.85 }}>{subtitle}</Text>
      <Text style={{ opacity: 0.65 }}>(lien à brancher)</Text>
    </Pressable>
  );
}

export default function DocumentsScreen() {
  const [loading, setLoading] = useState(false);

  const fakeSync = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 700);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Documents</Text>
      <Text style={{ opacity: 0.9 }}>
        Guides et procédures (format court, actionnable).
      </Text>

      <Pressable
        onPress={fakeSync}
        disabled={loading}
        style={{
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          opacity: loading ? 0.45 : 0.95,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        {loading ? <ActivityIndicator /> : null}
        <Text style={{ fontWeight: "900" }}>Synchroniser (placeholder)</Text>
      </Pressable>

      <View style={{ gap: 10 }}>
        <DocItem title="Checklist départ" subtitle="Avant de se connecter et partir" disabled />
        <DocItem title="Checklist pickup" subtitle="Au moment du retrait" disabled />
        <DocItem title="Checklist dropoff" subtitle="À la livraison" disabled />
        <DocItem title="Charte qualité" subtitle="Température, hygiène, relation client" disabled />
      </View>
    </ScrollView>
  );
}
