/* DA_V5_1_PAGE */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";

import { Link as DaLegalLink } from "expo-router";
function RowBtn({
  title,
  desc,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  desc: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = !!disabled || !!loading;
  return (
    <Pressable
      disabled={off}
      onPress={onPress}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        opacity: off ? 0.45 : 0.95,
        gap: 4,
      }}
    >
      {/* DA_J7B_LEGAL_LINK */}
      <DaLegalLink
        href={"/legal" as any}
        style={{ alignSelf: "flex-start", marginBottom: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, overflow: "hidden", backgroundColor: "#FFF4E8", color: "#7A421D", fontWeight: "800" }}
      >
        Confidentialité · Conditions · Assistance
      </DaLegalLink>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {loading ? <ActivityIndicator /> : null}
        <Text style={{ fontWeight: "900" }}>{title}</Text>
      </View>
      <Text style={{ opacity: 0.85 }}>{desc}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [busy, setBusy] = useState(false);

  const fakeSave = () => {
    setBusy(true);
    setTimeout(() => setBusy(false), 700);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Paramètres</Text>
      <Text style={{ opacity: 0.9 }}>
        Profil, véhicule, et diagnostics (sans exposer de données sensibles).
      </Text>

      <View style={{ gap: 10 }}>
        <RowBtn title="Profil (bientôt)" desc="Nom, téléphone, zone." onPress={() => {}} disabled />
        <RowBtn title="Véhicule (bientôt)" desc="Type, plaque, assurance." onPress={() => {}} disabled />
        <RowBtn title="Diagnostics" desc="Vérifier la configuration." onPress={fakeSave} loading={busy} />
        <RowBtn title="Déconnexion (bientôt)" desc="Fermer la session sur cet appareil." onPress={() => {}} disabled />
      </View>
    </ScrollView>
  );
}
