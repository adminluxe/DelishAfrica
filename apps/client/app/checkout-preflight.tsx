import React, { useEffect, useMemo, useState } from "react";
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
import { cartItemSummary, clearCart, formatCartEuro, getCartSnapshot } from "../utils/daCart";
import { deliveryZoneSummary, validateDeliveryZone } from "../utils/daDeliveryZones";
declare const require: any;

type ClientProfileLite = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  instructions: string;
  consent: boolean;
  updatedAt: string;
};

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

const PROFILE_KEY = "__DELISHAFRICA_CLIENT_PROFILE_LITE_V1__";

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

function globalBag(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

function readProfile(): ClientProfileLite | null {
  const value = globalBag()[PROFILE_KEY];
  if (!value || typeof value !== "object") return null;
  return value as ClientProfileLite;
}

function clean(value?: string): string {
  return String(value || "").trim();
}

function isValidEmail(value?: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function missingFields(profile: ClientProfileLite | null): string[] {
  if (!profile) return ["vos informations client"];
  const missing: string[] = [];
  if (!clean(profile.firstName)) missing.push("prénom");
  if (!clean(profile.phone)) missing.push("téléphone");
  if (!isValidEmail(profile.email)) missing.push("email");
  if (!clean(profile.address)) missing.push("adresse");
  if (!clean(profile.city)) missing.push("ville");
  if (!profile.consent) missing.push("consentement client");
  return missing;
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
        error: "Module de paiement trouvé mais fonctions de validation indisponibles.",
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

async function readJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Réponse non JSON (${res.status}): ${text.slice(0, 240)}`);
  }
}

async function createPaymentIntent(orderId: string, profile: ClientProfileLite, amount: number) {
  const res = await fetch(`${API_BASE_URL}/payments/create-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      orderId,
      amount,
      currency: "eur",
      metadata: {
        app: "client",
        flow: "checkout-payment-order-v1",
        clientId: profile.id,
        clientName: `${profile.firstName} ${profile.lastName}`.trim(),
        clientEmail: profile.email,
        city: profile.city,
        restaurant: "DelishAfrica",
        cartAmount: String(amount),
      },
    }),
  });

  const json = (await readJsonResponse(res)) as CreateIntentResponse;

  if (!res.ok || !json.ok) {
    throw new Error(json.error || json.message || `HTTP ${res.status}`);
  }

  if (!json.clientSecret || !json.publishableKey) {
    throw new Error("La configuration de paiement est indisponible pour le moment. Réessayez dans quelques instants.");
  }

  return json;
}

async function createDemoOrderAfterPayment(params: {
  orderId: string;
  profile: ClientProfileLite;
  paymentIntentId?: string;
  cart: ReturnType<typeof getCartSnapshot>;
}) {
  const { orderId, profile, paymentIntentId, cart } = params;

  const body = {
    orderId,
    clientId: profile.id,
    customer: {
      id: profile.id,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      city: profile.city,
      instructions: profile.instructions,
    },
    customerName: `${profile.firstName} ${profile.lastName}`.trim(),
    customerPhone: profile.phone,
    customerEmail: profile.email,
    deliveryAddress: `${profile.address}, ${profile.city}`,
    deliveryInstructions: profile.instructions,
    restaurantId: cart.restaurantId || cart.restaurantSlug || "thieyp",
 restaurantName: cart.restaurantName || "Restaurant DelishAfrica",
 merchantName: cart.restaurantName || "Restaurant DelishAfrica",
 partnerSlug: cart.restaurantSlug || cart.restaurantId || "thieyp",
 merchantSlug: cart.restaurantSlug || cart.restaurantId || "thieyp",
    items: cart.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.unitPrice / 100,
      amount: item.unitPrice,
    })),
    subtotal: cart.subtotal,
    deliveryFee: cart.deliveryFee,
    total: cart.total,
    amount: cart.total,
    currency: "eur",
    payment: {
      provider: "stripe",
      mode: "test",
      status: "paid",
      paymentIntentId,
      paidAt: new Date().toISOString(),
    },
    source: "client-ios-checkout-payment-order-v1",
  };

  const res = await fetch(`${API_BASE_URL}/orders/demo/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
  }

  return json;
}

export default function CheckoutPreflightScreen() {
  const [profile, setProfile] = useState<ClientProfileLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("En attente.");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastPaymentIntentId, setLastPaymentIntentId] = useState<string | null>(null);

  useEffect(() => {
    setProfile(readProfile());
  }, []);

  const missing = useMemo(() => missingFields(profile), [profile]);
  const ready = missing.length === 0;
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "—";
  const cartSnapshot = getCartSnapshot();
const deliveryZone = profile
? validateDeliveryZone({ address: profile.address, city: profile.city }, cartSnapshot.serviceAreaLabel)
: validateDeliveryZone(null, cartSnapshot.serviceAreaLabel);
  const cartReady = cartSnapshot.items.length > 0;
  const cartSummary = cartReady
    ? `${cartItemSummary(cartSnapshot)} · Paiement sécurisé · Livraison Bruxelles`
    : `Panier à compléter · Paiement sécurisé · ${deliveryZoneSummary(deliveryZone)}`;

  function refresh() {
    setProfile(readProfile());
    setPhase("Profil rafraîchi.");
  }

  async function payAndCreateOrder() {
    if (!profile) {
      Alert.alert("Profil requis", "Complète d'abord ton espace Client.");
      router.push("/client-space" as any);
      return;
    }

    const missingNow = missingFields(profile);
    if (missingNow.length > 0) {
      Alert.alert("Profil incomplet", `À compléter : ${missingNow.join(", ")}`);
      router.push("/client-space" as any);
      return;
    }

    const activeCart = getCartSnapshot();
const activeZone = validateDeliveryZone(
profile ? { address: profile.address, city: profile.city } : null,
activeCart.serviceAreaLabel,
);

if (!activeZone.ok) {
Alert.alert(activeZone.title, activeZone.message);
return;
}
    if (!activeCart.items.length) {
      Alert.alert("Panier vide", "Ajoutez au moins un article depuis le menu du restaurant choisi.");
      router.push("/menu" as any);
      return;
    }

    const stripe = loadStripeNative();
    if (!stripe.ok || !stripe.module) {
      Alert.alert("Paiement indisponible", stripe.error || "Le module de paiement sécurisé est indisponible.");
      setPhase(`Paiement indisponible : ${stripe.error || "erreur inconnue"}`);
      return;
    }

    const orderId = `DA-${Date.now().toString(36).slice(-6).toUpperCase()}`;

    setLoading(true);
    setLastOrderId(orderId);
    setLastPaymentIntentId(null);

    try {
      setPhase("Préparation du paiement sécurisé...");
      const intent = await createPaymentIntent(orderId, profile, activeCart.total);
      setLastPaymentIntentId(intent.paymentIntentId || null);

      setPhase("Préparation de la validation bancaire...");
      if (typeof stripe.module.initStripe === "function") {
        await stripe.module.initStripe({
          publishableKey: intent.publishableKey!,
          urlScheme: "delishafricaclient",
        });
      }

      const initResult = await stripe.module.initPaymentSheet?.({
        merchantDisplayName: "DelishAfrica",
        paymentIntentClientSecret: intent.clientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          name: fullName,
          email: profile.email,
          phone: profile.phone,
          address: {
            line1: profile.address,
            city: profile.city,
            country: "BE",
          },
        },
        style: "alwaysDark",
      });

      if (initResult?.error) {
        throw new Error(initResult.error.message || initResult.error.code || "Erreur d’initialisation bancaire");
      }

      setPhase("Ouverture de la validation bancaire...");
      const result = await stripe.module.presentPaymentSheet?.();

      if (result?.error) {
        setPhase(`Paiement non finalisé : ${result.error.message || result.error.code || "annulé"}`);
        Alert.alert(
          "Paiement non finalisé",
          result.error.message || "Le paiement a été annulé ou refusé."
        );
        return;
      }

      setPhase("Paiement confirmé. Envoi de la commande au restaurant...");
      await createDemoOrderAfterPayment({
        orderId,
        profile,
        paymentIntentId: intent.paymentIntentId,
        cart: activeCart,
      });

      clearCart();

      setPhase("Commande payée et envoyée au restaurant. Ouverture du suivi live.");

      Alert.alert(
        "Commande envoyée",
        `Paiement confirmé. Commande ${orderId} transmise à ${activeCart.restaurantName || "restaurant"}.`,
        [
          {
            text: "Suivre",
            onPress: () => router.push("/order-tracking" as any),
          },
        ]
      );
    } catch (error: any) {
      const msg = error?.message || String(error);
      setPhase(`Erreur : ${msg}`);
      Alert.alert("Checkout interrompu", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.title}>Validation de commande</Text>
          <Text style={styles.subtitle}>
            Vérifiez vos informations, validez le paiement, puis suivez la commande en direct.
          </Text>
        </View>

        <View style={[styles.hero, ready ? styles.heroReady : styles.heroMissing]}>
          <Text style={styles.heroKicker}>RESTAURANT SÉLECTIONNÉ</Text>
          <Text style={styles.heroTitle}>
            {ready ? "Tout est prêt pour commander." : "Votre espace client"}
          </Text>
          <Text style={styles.heroText}>
            {cartSummary}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>État client</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Profil</Text>
            <Text style={[styles.pill, ready ? styles.goodPill : styles.warnPill]}>
              {ready ? "OK" : "À compléter"}
            </Text>
          </View>

          {ready ? (
            <>
              <Text style={styles.bigName}>{fullName}</Text>
              <Text style={styles.line}>{profile?.phone}</Text>
              <Text style={styles.line}>{profile?.email}</Text>
              <Text style={styles.line}>
                {profile?.address}, {profile?.city}
              </Text>
              {profile?.instructions ? (
                <Text style={styles.instructions}>{profile.instructions}</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.line}>À compléter :</Text>
              {missing.map((item) => (
                <Text key={item} style={styles.missingItem}>
                  • {item}
                </Text>
              ))}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Parcours protégé</Text>
          <Text style={styles.step}>1. Espace Client validé</Text>
          <Text style={styles.step}>2. Paiement sécurisé préparé</Text>
          <Text style={styles.step}>3. Validation bancaire sécurisée</Text>
          <Text style={styles.step}>4. Commande transmise au restaurant</Text>
          <Text style={styles.step}>5. Suivi Client → Merchant → Courier</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Suivi de validation</Text>
          <Text style={styles.line}>{phase}</Text>
          {lastOrderId ? <Text style={styles.line}>Référence commande : {lastOrderId}</Text> : null}
          {lastPaymentIntentId ? <Text style={styles.line}>Paiement sécurisé préparé.</Text> : null}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Traitement en cours...</Text>
          </View>
        ) : null}

        {!ready ? (
          <Pressable style={styles.primaryButton} onPress={() => router.push("/client-space" as any)}>
            <Text style={styles.primaryButtonText}>Compléter mon espace Client</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={payAndCreateOrder}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {cartReady ? "Payer et envoyer la commande" : "Choisir des plats"}
            </Text>
          </Pressable>
        )}

        <Pressable style={styles.secondaryButton} onPress={refresh}>
          <Text style={styles.secondaryButtonText}>Rafraîchir le profil</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push("/client-space" as any)}>
          <Text style={styles.secondaryButtonText}>Voir mon espace Client</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => router.push("/order-tracking" as any)}>
          <Text style={styles.secondaryButtonText}>Voir le suivi live</Text>
        </Pressable>

        <Pressable style={styles.backButton} onPress={() => router.replace("/" as any)}>
          <Text style={styles.backText}>Retour à l’accueil</Text>
        </Pressable>

        <Text style={styles.note}>
          La commande est envoyée au restaurant après validation du paiement. Vous pourrez suivre chaque étape en direct.
        </Text>
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
    paddingBottom: 70,
  },
  header: {
    marginBottom: 22,
  },
  brand: {
    color: "#F8D17A",
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: 8,
    marginBottom: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "900",
  },
  subtitle: {
    color: "#C4CAD8",
    fontSize: 17,
    lineHeight: 26,
    marginTop: 12,
    fontWeight: "600",
  },
  hero: {
    borderRadius: 30,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
  },
  heroReady: {
    backgroundColor: "#112719",
    borderColor: "rgba(156,248,176,0.38)",
  },
  heroMissing: {
    backgroundColor: "#302414",
    borderColor: "rgba(248,209,122,0.38)",
  },
  heroKicker: {
    color: "#F8D17A",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 5,
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: 10,
  },
  heroText: {
    color: "#C9CFDE",
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#182031",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 26,
    padding: 18,
    marginBottom: 18,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    color: "#C4CAD8",
    fontSize: 18,
    fontWeight: "800",
  },
  pill: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "900",
  },
  goodPill: {
    color: "#08220F",
    backgroundColor: "#9CF8B0",
  },
  warnPill: {
    color: "#241400",
    backgroundColor: "#F8D17A",
  },
  bigName: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  line: {
    color: "#D8DDEE",
    fontSize: 17,
    lineHeight: 26,
    fontWeight: "700",
  },
  mono: {
    color: "#D8DDEE",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Courier",
    marginTop: 6,
  },
  instructions: {
    color: "#F8D17A",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    marginTop: 12,
  },
  missingItem: {
    color: "#F8D17A",
    fontSize: 17,
    lineHeight: 27,
    fontWeight: "800",
  },
  step: {
    color: "#D8DDEE",
    fontSize: 17,
    lineHeight: 29,
    fontWeight: "800",
  },
  loadingBox: {
    backgroundColor: "#111A31",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  primaryButton: {
    backgroundColor: "#F8D17A",
    borderRadius: 22,
    paddingVertical: 19,
    paddingHorizontal: 22,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  disabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#071026",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "#111A31",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 22,
    alignItems: "center",
    marginBottom: 14,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  backButton: {
    paddingVertical: 20,
    alignItems: "center",
  },
  backText: {
    color: "#F8D17A",
    fontSize: 18,
    fontWeight: "900",
  },
  note: {
    color: "#8D95AA",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
  },
});
