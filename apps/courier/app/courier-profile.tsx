import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  DaAuthSession,
  daAuthApiBaseUrl,
  daDevLogin,
  daLogout,
  daMe,
  daSessionLabel,
} from "../utils/daAuthBridge";

const ROLE = "courier" as const;
const ACCENT = "#15803D";

export default function LiteSpaceScreen() {
  const router = useRouter();
  const [session, setSession] = useState<DaAuthSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<string>("Initialisation espace Lite");

  const active = Boolean(session?.authenticated);
  const pill = useMemo(() => daSessionLabel(session, ROLE), [session]);

  const refresh = async () => {
    try {
      const next = await daMe();
      setSession(next);
      setTrace(next.authenticated ? "Session synchronisée via /auth/me." : "Session prête, non obligatoire.");
      return next;
    } catch (error: any) {
      setTrace(error?.message || "Session locale non chargée.");
      return null;
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const activate = async () => {
    setBusy(true);
    try {
      const next = await daDevLogin({ role: ROLE });
      setSession(next);
      setTrace("Session activée : dev-login + auto /auth/me.");
    } catch (error: any) {
      setTrace(error?.message || "Activation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await daLogout();
 setSession({
 ok: true,
 authenticated: false,
 required: false,
 reason: "logged_out",
 user: null,
 });
      setTrace("Session locale désactivée.");
    } finally {
      setBusy(false);
    }
  };

  const go = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.safe}>
<View pointerEvents="none" style={styles.aquaVeil} />
<View pointerEvents="none" style={styles.aquaDrop} />
<View pointerEvents="none" style={styles.aquaRipple} />
<View pointerEvents="none" style={styles.aquaFoam} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>DELISHAFRICA® · COURIER</Text>
          <Text style={styles.title}>Profil coursier terrain</Text>
          <Text style={styles.subtitle}>Identité terrain, disponibilité, zone active, véhicule et contact opérationnel.</Text>

          <View style={[styles.sessionPill, active ? styles.pillActive : styles.pillReady]}>
            <Text style={[styles.sessionPillText, active ? styles.pillActiveText : styles.pillReadyText]}>
              {pill}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Session sécurisée</Text>
          <Text style={styles.row}>Authentifié : {active ? "oui" : "non"}</Text>
          <Text style={styles.row}>Rôle : {session?.user?.role || ROLE}</Text>
          <Text style={styles.row}>Profil : {session?.user?.name || session?.user?.email || "Non activé"}</Text>
          <Text style={styles.row}>Connexion sécurisée active</Text>
          <Text style={styles.hint}>
            Session progressive : elle améliore l’expérience coursier sans bloquer le service.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable disabled={busy} style={[styles.primary, busy && styles.disabled]} onPress={activate}>
            {busy ? <ActivityIndicator /> : <Text style={styles.primaryText}>Activer session</Text>}
          </Pressable>

          <Pressable disabled={busy} style={styles.secondary} onPress={refresh}>
            <Text style={styles.secondaryText}>Rafraîchir</Text>
          </Pressable>
        </View>

        <Pressable disabled={busy} style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Désactiver localement</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Identité</Text>
          <Text style={styles.row}>• Coursier DelishAfrica®.</Text>
          <Text style={styles.row}>• Session coursier reliée à l’espace sécurisé.</Text>
          <Text style={styles.row}>• Disponibilité, zone active et informations terrain centralisées.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accès rapides</Text>
          <Pressable style={styles.action} onPress={() => go("/orders-demo")}>
            <Text style={styles.actionTitle}>Voir les missions</Text>
            <Text style={styles.actionHint}>Retour vers le cockpit terrain.</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => go("/auth-session")}>
            <Text style={styles.actionTitle}>Session sécurisée</Text>
            <Text style={styles.actionHint}>Consulter l’état de connexion du coursier.</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={() => go("/")}>
            <Text style={styles.actionTitle}>Accueil Courier</Text>
            <Text style={styles.actionHint}>Revenir à l’entrée coursier.</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{trace}</Text>
        </View>
      
<Pressable
onPress={() => router.push("/courier-eta")}
style={{
marginTop: 18,
borderRadius: 24,
paddingVertical: 18,
paddingHorizontal: 18,
backgroundColor: "#B4F7C1",
}}
>
<Text
style={{
color: "#052013",
fontSize: 18,
fontWeight: "900",
textAlign: "center",
}}
>
ETA mission
</Text>
</Pressable>

</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
aquaVeil: { position: "absolute", top: -84, right: -132, width: 168, height: 168, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(200, 255, 232, 0.052)", transform: [{ scaleX: 1.24 }] },
aquaDrop: { position: "absolute", top: 126, left: -34, width: 44, height: 44, borderRadius: 999, backgroundColor: "rgba(255, 255, 255, 0.014)", borderWidth: 1, borderColor: "rgba(210, 255, 238, 0.042)" },
aquaRipple: { position: "absolute", top: 226, right: -28, width: 126, height: 22, borderRadius: 999, backgroundColor: "rgba(111, 255, 210, 0.022)", borderWidth: 1, borderColor: "rgba(220, 255, 240, 0.052)", transform: [{ rotate: "-14deg" }, { scaleX: 1.22 }] },
aquaFoam: { position: "absolute", top: 408, left: -118, width: 126, height: 126, borderRadius: 999, backgroundColor: "rgba(212, 255, 236, 0.014)", borderWidth: 1, borderColor: "rgba(224, 255, 241, 0.040)" },
  safe: {
    flex: 1,
    backgroundColor: "#09090B",
  },
  container: {
    padding: 20,
    gap: 14,
  },
  hero: {
    borderRadius: 30,
    padding: 22,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  kicker: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 10,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  sessionPill: {
    alignSelf: "flex-start",
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: "rgba(22,163,74,0.16)",
    borderColor: "rgba(22,163,74,0.52)",
  },
  pillReady: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  sessionPillText: {
    fontSize: 12,
    fontWeight: "900",
  },
  pillActiveText: {
    color: "#BBF7D0",
  },
  pillReadyText: {
    color: "rgba(255,255,255,0.74)",
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  row: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 22,
  },
  hint: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  primary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  secondary: {
    minWidth: 118,
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  secondaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  logout: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 13,
    fontWeight: "800",
  },
  action: {
    borderRadius: 18,
    padding: 15,
    marginTop: 10,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
  actionHint: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  footer: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  footerText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 18,
  },
  disabled: {
    opacity: 0.65,
  },
});
