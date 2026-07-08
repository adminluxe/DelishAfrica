import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

declare const require: any;

type CreateIntentResponse = {
  ok?: boolean;
  mode?: string;
  provider?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  paymentIntentId?: string;
  clientSecret?: string;
  publishableKey?: string;
  status?: string;
  error?: string;
  message?: string;
};

type StripeNativeModule = {
  initStripe?: (params: {
    publishableKey: string;
    urlScheme?: string;
  }) => Promise<void>;
  initPaymentSheet?: (params: Record<string, unknown>) => Promise<{
    error?: { message?: string; code?: string };
  }>;
  presentPaymentSheet?: () => Promise<{
    error?: { message?: string; code?: string };
  }>;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

function normalizeApiBase(value: string): string {
  const clean = String(value || "").replace(/\/+$/, "");
  if (clean.endsWith("/api/v1")) return clean;
  if (clean === "https://api.delishafrica.me") return `${clean}/api/v1`;
  return clean;
}

const API_BASE_URL = normalizeApiBase(RAW_API);

function mask(value?: string | null): string {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function pretty(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function loadStripeNative(): {
  ok: boolean;
  module: StripeNativeModule | null;
  error: string | null;
} {
  try {
    const stripeModule = require("@stripe/stripe-react-native") as StripeNativeModule;

    if (
      !stripeModule ||
      typeof stripeModule.initPaymentSheet !== "function" ||
      typeof stripeModule.presentPaymentSheet !== "function"
    ) {
      return {
        ok: false,
        module: stripeModule || null,
        error:
          "Module JS trouvé, mais fonctions PaymentSheet introuvables. Vérifier la version @stripe/stripe-react-native.",
      };
    }

    return { ok: true, module: stripeModule, error: null };
  } catch (error: any) {
    return {
      ok: false,
      module: null,
      error: error?.message || String(error),
    };
  }
}

export default function PaymentReadinessScreen() {
  const [loading, setLoading] = useState(false);
  const [stripeLoaded, setStripeLoaded] = useState<boolean | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [intent, setIntent] = useState<CreateIntentResponse | null>(null);
  const [sheetReady, setSheetReady] = useState(false);
  const [lastResult, setLastResult] = useState<string>("En attente du test.");
  const [rawTrace, setRawTrace] = useState<string>("");

  const statusLabel = useMemo(() => {
    if (stripeLoaded === true) return "OK";
    if (stripeLoaded === false) return "Absent";
    return "Non testé";
  }, [stripeLoaded]);

  const statusStyle = useMemo(() => {
    if (stripeLoaded === true) return styles.goodPill;
    if (stripeLoaded === false) return styles.badPill;
    return styles.neutralPill;
  }, [stripeLoaded]);

  async function testNativeSdk() {
    const loaded = loadStripeNative();
    setStripeLoaded(loaded.ok);
    setStripeError(loaded.error);
    setLastResult(
      loaded.ok
        ? "Module bancaire sécurisé chargé. La validation peut être préparée."
        : `Paiement sécurisé indisponible: ${loaded.error || "erreur inconnue"}`
    );
    return loaded;
  }

  async function createIntent() {
    setLoading(true);
    setSheetReady(false);

    try {
      const res = await fetch(`${API_BASE_URL}/payments/create-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          orderId: `da_client_ios_sheet_${Date.now()}`,
          amount: 1290,
          currency: "eur",
          metadata: {
            app: "client",
            source: "payment-readiness-native-v1",
          },
        }),
      });

      const text = await res.text();
      let json: CreateIntentResponse;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Réponse non JSON (${res.status}): ${text.slice(0, 280)}`);
      }

      setIntent(json);
      setRawTrace(pretty({
        ...json,
        referencePaiement: json.paymentIntentId ? "Référence de paiement prête" : undefined,
        sessionBancaire: json.clientSecret ? "Session bancaire sécurisée prête" : undefined,
        configurationBancaire: json.publishableKey ? "Configuration bancaire prête" : undefined,
      }));

      if (!res.ok || !json.ok) {
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }

      if (!json.clientSecret || !json.publishableKey) {
        throw new Error("Réponse paiement incomplète. Merci de réessayer.");
      }

      setLastResult("Paiement sécurisé préparé. Vous pouvez ouvrir la validation bancaire.");
      return json;
    } catch (error: any) {
      const msg = error?.message || String(error);
      setLastResult(`Erreur préparation paiement : ${msg}`);
      Alert.alert("Erreur paiement sécurisé", msg);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function initSheet() {
    setLoading(true);

    try {
      const loaded = await testNativeSdk();
      if (!loaded.ok || !loaded.module) {
        throw new Error(loaded.error || "Module de paiement sécurisé indisponible.");
      }

      const currentIntent = intent || (await createIntent());
      if (!currentIntent?.clientSecret || !currentIntent?.publishableKey) {
        throw new Error("Paiement incomplet. Impossible d'ouvrir la validation bancaire.");
      }

      if (typeof loaded.module.initStripe === "function") {
        await loaded.module.initStripe({
          publishableKey: currentIntent.publishableKey,
          urlScheme: "delishafricaclient",
        });
      }

      const initResult = await loaded.module.initPaymentSheet?.({
        merchantDisplayName: "DelishAfrica",
        paymentIntentClientSecret: currentIntent.clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          name: "Client DelishAfrica®",
          email: "client@exemple.com",
        },
        style: "alwaysDark",
      });

      if (initResult?.error) {
        throw new Error(initResult.error.message || initResult.error.code || "Erreur initPaymentSheet");
      }

      setSheetReady(true);
      setLastResult("PaymentSheet initialisé. Tu peux ouvrir la fenêtre Stripe.");
    } catch (error: any) {
      const msg = error?.message || String(error);
      setSheetReady(false);
      setLastResult(`Erreur initPaymentSheet: ${msg}`);
      Alert.alert("Erreur PaymentSheet", msg);
    } finally {
      setLoading(false);
    }
  }

  async function openSheet() {
    setLoading(true);

    try {
      const loaded = loadStripeNative();
      if (!loaded.ok || !loaded.module?.presentPaymentSheet) {
        throw new Error(loaded.error || "Module de paiement sécurisé indisponible.");
      }

      if (!sheetReady) {
        await initSheet();
      }

      const result = await loaded.module.presentPaymentSheet();

      if (result?.error) {
        const msg = result.error.message || result.error.code || "Paiement annulé ou refusé.";
        setLastResult(`PaymentSheet fermé: ${msg}`);
        Alert.alert("Paiement non finalisé", msg);
        return;
      }

      setLastResult("Paiement sécurisé confirmé.");
      Alert.alert("Paiement confirmé", "La validation bancaire s'est terminée avec succès.");
    } catch (error: any) {
      const msg = error?.message || String(error);
      setLastResult(`Erreur confirmation paiement : ${msg}`);
      Alert.alert("Erreur validation bancaire", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.title}>Paiement sécurisé</Text>
          <Text style={styles.subtitle}>
            Validation bancaire sécurisée de votre commande DelishAfrica®.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sécurité bancaire</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Connexion bancaire</Text>
            <Text style={styles.value}>Service DelishAfrica® synchronisé</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Module bancaire sécurisé</Text>
            <Text style={[styles.pill, statusStyle]}>{statusLabel}</Text>
          </View>

          {stripeError ? (
            <Text style={styles.errorText}>{stripeError}</Text>
          ) : null}

          <Text style={styles.trace}>{lastResult}</Text>
        </View>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={testNativeSdk}
          disabled={loading}
        >
          <Text style={styles.buttonText}>1. Vérifier la sécurité bancaire</Text>
        </Pressable>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={createIntent}
          disabled={loading}
        >
          <Text style={styles.buttonText}>2. Préparer le paiement</Text>
        </Pressable>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={initSheet}
          disabled={loading}
        >
          <Text style={styles.buttonText}>3. Préparer la validation</Text>
        </Pressable>

        <Pressable
          style={[
            styles.button,
            styles.primaryButton,
            (loading || stripeLoaded === false) && styles.buttonDisabled,
          ]}
          onPress={openSheet}
          disabled={loading || stripeLoaded === false}
        >
          <Text style={styles.primaryButtonText}>4. Confirmer le paiement</Text>
        </Pressable>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Traitement bancaire...</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Préparation sécurisée</Text>
          <Text style={styles.mono}>Sécurité : {String(intent?.ok ?? "—")}</Text>
          <Text style={styles.mono}>Parcours : {intent?.mode || "—"}</Text>
          <Text style={styles.mono}>Opérateur : {intent?.provider || "—"}</Text>
          <Text style={styles.mono}>État : {intent?.status || "—"}</Text>
          <Text style={styles.mono}>Référence paiement : {mask(intent?.paymentIntentId)}</Text>
          <Text style={styles.mono}>Session bancaire sécurisée : prête</Text>
          <Text style={styles.mono}>Configuration bancaire : prête</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Validation interne sécurisée</Text>
          <Text style={styles.trace}>Validation interne disponible sans carte réelle.</Text>
          <Text style={styles.trace}>Parcours réservé aux contrôles avant mise en production.</Text>
          <Text style={styles.trace}>Aucune carte réelle nécessaire pendant les essais contrôlés.</Text>
          <Text style={styles.trace}>Validation bancaire sécurisée.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Journal sécurisé</Text>
          <Text style={styles.monoSmall}>{rawTrace || "Aucun diagnostic disponible pour l'instant."}</Text>
        </View>

        <Pressable style={styles.backButton} onPress={() => router.replace("/")}>
          <Text style={styles.backText}>Retour à l’accueil</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050B1D",
  },
  page: {
    padding: 22,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 22,
  },
  brand: {
    color: "#F8D17A",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 8,
    marginBottom: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
  },
  subtitle: {
    color: "#B9C0D4",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#182031",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 16,
  },
  row: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    color: "#C9CEDC",
    fontSize: 18,
    fontWeight: "700",
  },
  value: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  pill: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "900",
  },
  goodPill: {
    color: "#08220F",
    backgroundColor: "#9CF8B0",
  },
  badPill: {
    color: "#2C1103",
    backgroundColor: "#FFC49B",
  },
  neutralPill: {
    color: "#0A1024",
    backgroundColor: "#F8D17A",
  },
  errorText: {
    color: "#FFC49B",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: "700",
  },
  trace: {
    color: "#C8CEDD",
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "600",
  },
  mono: {
    color: "#DCE3F7",
    fontSize: 15,
    lineHeight: 24,
    fontFamily: "Courier",
  },
  monoSmall: {
    color: "#DCE3F7",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Courier",
  },
  button: {
    backgroundColor: "#F8D17A",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#081026",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  primaryButtonText: {
    color: "#081026",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  backButton: {
    paddingVertical: 22,
    alignItems: "center",
  },
  backText: {
    color: "#F8D17A",
    fontSize: 18,
    fontWeight: "900",
  },
});
