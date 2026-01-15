import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { DAHeader, DACard, DAButton, DAPill, DAScreen, DAText } from "@delishafrica/ui";

const API = process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me";

export default function Home() {
  const [health, setHealth] = useState<"loading" | "ok" | "nok">("loading");

  useEffect(() => {
    let mounted = true;
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then(() => mounted && setHealth("ok"))
      .catch(() => mounted && setHealth("nok"));
    return () => { mounted = false; };
  }, []);

  const pill = useMemo(() => {
    if (health === "loading") return <DAPill tone="neutral" label="API: vérification..." />;
    if (health === "ok") return <DAPill tone="ok" label="API: OK" />;
    return <DAPill tone="bad" label="API: KO (fallback)" />;
  }, [health]);

  return (
    <DAScreen>
      <DAHeader
        title="DelishAfrica"
        subtitle="Commandez afro premium • Démo Thieyp"
        right={pill}
      />

      <DACard style={{ marginBottom: 16 }}>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Partenaire mis en avant</DAText>
        <View style={{ height: 10 }} />
        <DAText muted>Thieyp • Cuisine sénégalaise • Bruxelles</DAText>
        <View style={{ height: 14 }} />
        <DAButton label="Découvrir Thieyp" onPress={() => { /* TODO: router push */ }} />
        <View style={{ height: 10 }} />
        <DAButton variant="ghost" label="Voir les autres partenaires" onPress={() => {}} />
      </DACard>

      <DACard>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Actions rapides</DAText>
        <View style={{ height: 12 }} />
        <DAButton label="Commander (démo)" onPress={() => {}} />
        <View style={{ height: 10 }} />
        <DAButton variant="ghost" label="Suivre une commande" onPress={() => {}} />
      </DACard>
    </DAScreen>
  );
}
