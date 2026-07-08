/* DA_V5_1_PAGE */
import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
function CardBtn({
  title,
  desc,
  to,
  disabled,
}: {
  title: string;
  desc: string;
  to: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={!!disabled}
      onPress={() => router.push(to)}
      style={{
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        opacity: disabled ? 0.45 : 0.95,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "800" }}>{title}</Text>
      <Text style={{ opacity: 0.85, marginTop: 2 }}>{desc}</Text>
      <Text style={{ opacity: 0.65, marginTop: 6 }}>{to}</Text>
    </Pressable>
  );
}

export default function CourierV51Hub() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Documents & conformité</Text>
      <Text style={{ opacity: 0.9 }}>
        Tes documents, ton statut, et les infos utiles pour rouler en sécurité.
      </Text>

      <View style={{ gap: 10, marginTop: 6 }}>
        <CardBtn title="Profil coursier" desc="Déposer les pièces + suivre le statut" to="/kyc" />
        <CardBtn title="Documents" desc="Guides, procédures, checklists" to="/documents" />
        <CardBtn title="Support" desc="Incident, paiement, blocage, urgence" to="/support" />
        <CardBtn title="Paramètres" desc="Profil, véhicule, diagnostics" to="/settings" />
      </View>

      <View style={{ marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1, opacity: 0.95 }}>
        <Text style={{ fontWeight: "800" }}>Conseil OPS</Text>
        <Text style={{ opacity: 0.85, marginTop: 4 }}>
          Avant de commencer une mission : vérifie que ton KYC est “Validé” et que tes documents sont lisibles.
        </Text>
      </View>
    </ScrollView>
  );
}
