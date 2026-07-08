/* DA_V5_1_PAGE */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
function ActionBtn({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
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
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      {loading ? <ActivityIndicator /> : null}
      <Text style={{ fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export default function KycScreen() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"Inconnu" | "En attente" | "Validé" | "Rejeté">("Inconnu");

  const fakeRefresh = () => {
    setBusy(true);
    setTimeout(() => {
      // placeholder simple : on passe à "En attente" si inconnu
      setStatus((s) => (s === "Inconnu" ? "En attente" : s));
      setBusy(false);
    }, 700);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Profil coursier</Text>
      <Text style={{ opacity: 0.9 }}>
        Dépose tes documents et suis le statut de vérification.
      </Text>

      <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, opacity: 0.95, gap: 6 }}>
        <Text style={{ fontWeight: "800" }}>Statut</Text>
        <Text style={{ opacity: 0.85 }}>KYC : {status}</Text>
        <Text style={{ opacity: 0.7 }}>
          (Le branchement API sera fait côté OPS : upload + status.)
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <ActionBtn label="Rafraîchir le statut" onPress={fakeRefresh} loading={busy} />
        <ActionBtn
          label="Déposer un document (bientôt)"
          onPress={() => {}}
          disabled
        />
      </View>

      <View style={{ marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, opacity: 0.9 }}>
        <Text style={{ fontWeight: "800" }}>À brancher</Text>
        <Text style={{ opacity: 0.85, marginTop: 4 }}>
          - Upload : /devenir-coursier/api/kyc/upload/&lt;app_id&gt;/&lt;doc_type&gt;{"\n"}
          - Status : /devenir-coursier/api/kyc/status/&lt;app_id&gt;
        </Text>
      </View>
    </ScrollView>
  );
}
