/* DA_V5_1_PAGE */
import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
function SupportBtn({
  label,
  hint,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  hint: string;
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {loading ? <ActivityIndicator /> : null}
        <Text style={{ fontWeight: "900" }}>{label}</Text>
      </View>
      <Text style={{ opacity: 0.85 }}>{hint}</Text>
    </Pressable>
  );
}

export default function SupportScreen() {
  const [busy, setBusy] = useState(false);

  const fakeSend = () => {
    setBusy(true);
    setTimeout(() => setBusy(false), 700);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "900" }}>Support</Text>
      <Text style={{ opacity: 0.9 }}>
        Si tu es bloqué, on préfère une info courte + précise (commande, lieu, problème).
      </Text>

      <View style={{ gap: 10 }}>
        <SupportBtn
          label="Signaler un incident"
          hint="Retard, adresse, restaurant fermé, client injoignable…"
          onPress={fakeSend}
          loading={busy}
        />
        <SupportBtn
          label="Paiement / solde"
          hint="Question sur gains, ajustement, justificatif."
          onPress={() => {}}
          disabled
        />
        <SupportBtn
          label="Urgence (bientôt)"
          hint="Canal prioritaire OPS / hotline."
          onPress={() => {}}
          disabled
        />
      </View>

      <View style={{ marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, opacity: 0.9 }}>
        <Text style={{ fontWeight: "900" }}>Règle d’or</Text>
        <Text style={{ opacity: 0.85, marginTop: 4 }}>
          Ne partage jamais tes identifiants. Si un doute : stop mission + contact OPS.
        </Text>
      </View>
    </ScrollView>
  );
}
