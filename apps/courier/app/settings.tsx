/* DA_J8UX_S1A_S2A_SETTINGS_CANONICAL_PILOT */
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { Screen } from "../ui/da/Screen";
import { DAHeader } from "../ui/da/DAHeader";
import { DAInlineNotice } from "../ui/da/DAInlineNotice";
import { DAListItem } from "../ui/da/DAListItem";
import { StatusPill } from "../ui/da/StatusPill";
import type { DAApp } from "../ui/da/tokens";
import { getDATheme } from "../ui/da/theme";

const APP: DAApp = "courier";

function go(path: string) {
  router.push(path as any);
}

export default function SettingsScreen() {
  const t = getDATheme(APP);

  return (
    <Screen app={APP} pad="lg" scroll>
      <DAHeader
        app={APP}
        title="Paramètres"
        subtitle="Profil, session, véhicule et informations légales."
      />

      <DAInlineNotice
        app={APP}
        kind="info"
        title="Accès vérifiés"
        body="Seules les fonctions reliées à un écran ou service réel sont actionnables."
      />

      <View style={{ gap: t.space.x3, marginTop: t.space.x4 }}>
        <DAListItem
          app={APP}
          title="Profil coursier"
          subtitle="Identité, disponibilité et informations du compte."
          onPress={() => go("/courier-space")}
          right={<StatusPill app={APP} status="ONLINE" label="Actif" />}
        />

        <DAListItem
          app={APP}
          title="Session"
          subtitle="Vérifier la session Courier sécurisée et l’accès au compte."
          onPress={() => go("/auth-session")}
          right={<StatusPill app={APP} status="ONLINE" label="Disponible" />}
        />

        <DAListItem
          app={APP}
          title="Véhicule"
          subtitle="Les informations véhicule seront activées avec leur contrat métier réel."
          right={<StatusPill app={APP} status="WARN" label="À venir" />}
        />

        <DAListItem
          app={APP}
          title="Confidentialité · Conditions · Assistance"
          subtitle="Consulter les informations légales et les canaux d’assistance disponibles."
          onPress={() => go("/legal")}
          right={<StatusPill app={APP} status="ONLINE" label="Disponible" />}
        />
      </View>
    </Screen>
  );
}
