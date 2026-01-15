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
    if (health === "loading") return <DAPill tone="neutral" label="API: ping..." />;
    if (health === "ok") return <DAPill tone="ok" label="API: OK" />;
    return <DAPill tone="bad" label="API: KO" />;
  }, [health]);

  return (
    <DAScreen>
      <DAHeader
        title="Courier"
        subtitle="Missions • vitesse • précision"
        right={pill}
      />

      <DACard style={{ marginBottom: 16 }}>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Mission du moment (démo)</DAText>
        <View style={{ height: 10 }} />
        <DAText muted>📍 Thieyp → Client • Bruxelles</DAText>
        <View style={{ height: 14 }} />
        <DAButton label="Démarrer la mission" onPress={() => {}} />
        <View style={{ height: 10 }} />
        <DAButton variant="ghost" label="Voir toutes les missions" onPress={() => {}} />
      </DACard>

      <DACard>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>États</DAText>
        <View style={{ height: 10 }} />
        <DAText muted>À venir : preuve de livraison + feedback “Mission accomplie”.</DAText>
      </DACard>
    </DAScreen>
  );
}
