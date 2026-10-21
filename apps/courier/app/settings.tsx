/* DA_J8UX_S1A_S2A_SETTINGS_CANONICAL_PILOT — RELEASE-CANDIDATE WORDING */
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
        title="Accès à votre espace"
        body="Consultez votre dossier et votre session. Les missions exigent une habilitation professionnelle confirmée par le serveur."
      />

      <View style={{ gap: t.space.x3, marginTop: t.space.x4 }}>
        <DAListItem
          app={APP}
          title="Profil coursier"
          subtitle="Identité et dossier de candidature. L'accès aux missions dépend de la décision professionnelle."
          onPress={() => go("/courier-space")}
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
          subtitle="Renseigner votre moyen de transport dans le dossier coursier."
          onPress={() => go("/courier-space")}
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
