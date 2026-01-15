import React from "react";
import { ScrollView, View, Text } from "react-native";
import { Screen, H1, P, Card, Badge, Button, theme } from "./_ui/ui";
import { useApiHealth } from "./_ui/useApiHealth";

export default function Home() {
  const { state, ping } = useApiHealth();

  const statusBadge = (() => {
    if (state.status === "loading" || state.status === "idle") return <Badge kind="warn" label="API: vérification…" />;
    if (state.status === "ok") return <Badge kind="ok" label={`API: OK • ${state.ms}ms`} />;
    return <Badge kind="bad" label={`API: KO • ${state.message}`} />;
  })();

  const apiLine = (() => {
    if (state.status === "ok" || state.status === "error") return state.apiBaseUrl;
    return "…";
  })();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <H1>DelishAfrica • Client</H1>
        <P>Découvrir. Commander. Suivre.</P>

        <View style={{ marginTop: 14 }}>
          {statusBadge}
          <Text style={{ color: theme.muted, marginTop: 8, fontSize: 12 }}>API: {apiLine}</Text>
        </View>

        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>Phase UX 1</Text>
          <Text style={{ color: theme.muted, marginTop: 8, lineHeight: 20 }}>
            • UI unifiée (cards, boutons, marges){'\n'}
            • États loading/erreur lisibles{'\n'}
            • Base solide pour le flow commande
          </Text>

          <View style={{ height: 12 }} />
          <Button title="Re-tester l’API" onPress={ping} />

          <View style={{ height: 10 }} />
          <Button title="Action principale (démo)" variant="ghost" onPress={() => {}} />
        </Card>

        <Card style={{ marginTop: 12, borderColor: "rgba(255,255,255,0.14)" }}>
          <Text style={{ color: theme.text, fontWeight: "900", fontSize: 15 }}>Prochain écran (Phase 2)</Text>
          <Text style={{ color: theme.muted, marginTop: 8, lineHeight: 20 }}>
            Ici on branchera le scénario “commande Thieyp” (création → suivi → côté merchant → côté courier).
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}