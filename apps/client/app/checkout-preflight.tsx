import { daOrdersFetch, daAccountStorageKey, daAccountScopeId } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { cartItemSummary, clearCart, formatCartEuro, getCartSnapshot, waitForCartPersistence } from "../utils/daCart";
import { deliveryZoneSummary, validateDeliveryZone } from "../utils/daDeliveryZones";
import { daAttestIdentityProof, daResolveAddress, DaIdentityProof, DaResolvedAddress } from "../utils/daTrustNetwork";
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
  allergenFlags?: string[];
  dietaryTags?: string[];
  foodSafetyNote?: string;
  foodSafetyConfirmedAt?: string;
  consent: boolean;
  giftDelivery?: boolean;
  addressTruth?: DaResolvedAddress["address"];
  territory?: DaResolvedAddress["territory"];
  proofs?: { phone?: DaIdentityProof; email?: DaIdentityProof };
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
  message?: string | Record<string, unknown>;
  quote?: Record<string, unknown>;
};

type CartSnapshot = ReturnType<typeof getCartSnapshot>;

type PendingPaymentCommit = {
  version: 1;
  orderId: string;
  paymentIntentId: string | null;
  clientMutationId: string;
  cartFingerprint: string;
  profile: ClientProfileLite;
  cart: CartSnapshot;
  paidAt: string;
};

type OrderReadResponse = {
  ok?: boolean;
  order?: Record<string, any> | null;
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
const PENDING_PAYMENT_COMMIT_KEY = "__DELISHAFRICA_PENDING_PAYMENT_COMMIT_V1__";
// DA_SPRINT31_PAYMENT_COMMIT_TRUTH_V1

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

function normalizeApiBase(value: string): string {
  const cleanValue = String(value || "").replace(/\/+$/, "");
  if (cleanValue.endsWith("/api/v1")) return cleanValue;
  if (cleanValue === "https://api.delishafrica.me") return `${cleanValue}/api/v1`;
  return cleanValue;
}

const API_BASE_URL = normalizeApiBase(RAW_API);

function globalBag(): Record<string, unknown> {
  return globalThis as unknown as Record<string, unknown>;
}

async function restoreClientProfile(): Promise<ClientProfileLite | null> {
  try {
    const scope = await daAccountScopeId();
    const scopedKey = await daAccountStorageKey(PROFILE_KEY);
    const memoryKey = `${PROFILE_KEY}.${scope}`;
    const cached = globalBag()[memoryKey];
    if (cached && typeof cached === "object") return cached as ClientProfileLite;
    const raw = await SecureStore.getItemAsync(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientProfileLite;
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    globalBag()[memoryKey] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function writeClientProfileSnapshot(profile: ClientProfileLite): Promise<void> {
  const scope = await daAccountScopeId();
  const scopedKey = await daAccountStorageKey(PROFILE_KEY);
  globalBag()[`${PROFILE_KEY}.${scope}`] = profile;
  await SecureStore.setItemAsync(scopedKey, JSON.stringify(profile), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function restorePendingPaymentCommit(): Promise<PendingPaymentCommit | null> {
  try {
    const scope = await daAccountScopeId();
    const memoryKey = `${PENDING_PAYMENT_COMMIT_KEY}.${scope}`;
    const cached = globalBag()[memoryKey];
    if (cached && typeof cached === "object") {
      const commit = cached as PendingPaymentCommit;
      if (commit.version === 1 && commit.orderId && commit.clientMutationId) return commit;
    }
    const scopedKey = await daAccountStorageKey(PENDING_PAYMENT_COMMIT_KEY);
    const raw = await SecureStore.getItemAsync(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPaymentCommit;
    if (parsed.version !== 1 || !parsed.orderId || !parsed.clientMutationId) return null;
    globalBag()[memoryKey] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function writePendingPaymentCommit(commit: PendingPaymentCommit): Promise<void> {
  const scope = await daAccountScopeId();
  const scopedKey = await daAccountStorageKey(PENDING_PAYMENT_COMMIT_KEY);
  globalBag()[`${PENDING_PAYMENT_COMMIT_KEY}.${scope}`] = commit;
  await SecureStore.setItemAsync(scopedKey, JSON.stringify(commit), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function clearPendingPaymentCommit(): Promise<void> {
  const scope = await daAccountScopeId();
  delete globalBag()[`${PENDING_PAYMENT_COMMIT_KEY}.${scope}`];
  const scopedKey = await daAccountStorageKey(PENDING_PAYMENT_COMMIT_KEY);
  await SecureStore.deleteItemAsync(scopedKey);
}

function cartFingerprint(cart: CartSnapshot): string {
  return [
    cart.restaurantId || cart.restaurantSlug || "restaurant",
    cart.total,
    ...cart.items
      .map((item) => `${item.id}:${item.quantity}:${item.unitPrice}`)
      .sort(),
  ].join("|");
}

function sleep(waitMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, waitMs));
}

function clean(value?: string): string {
  return String(value || "").trim();
}

function isValidEmail(value?: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function proofFresh(proof: DaIdentityProof | undefined, destination: string): boolean {
  if (!proof?.token || proof.destination !== destination) return false;
  const expiresAt = Date.parse(proof.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function missingFields(profile: ClientProfileLite | null): string[] {
  if (!profile) return ["vos informations client"];
  const missing: string[] = [];
  if (!clean(profile.firstName)) missing.push("prénom");
  if (!clean(profile.phone)) missing.push("téléphone");
  if (!isValidEmail(profile.email)) missing.push("email");
  if (!clean(profile.address)) missing.push("adresse");
  if (!clean(profile.city)) missing.push("ville");
  if (!profile.addressTruth?.deliverable || !profile.addressTruth?.placeId) missing.push("adresse réelle confirmée");
  if (!proofFresh(profile.proofs?.phone, clean(profile.phone))) missing.push("téléphone vérifié");
  if (!proofFresh(profile.proofs?.email, clean(profile.email).toLowerCase())) missing.push("email vérifié");
  if (!profile.consent) missing.push("consentement client");
  const hasFoodSafetySignal = Boolean(
    profile.allergenFlags?.length ||
    profile.dietaryTags?.length ||
    clean(profile.foodSafetyNote),
  );
  if (hasFoodSafetySignal && !profile.foodSafetyConfirmedAt) {
    missing.push("confirmation des informations alimentaires");
  }
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

function checkoutApiError(json: any, status: number): string {
  const detail = json?.message && typeof json.message === "object" ? json.message : json;
  const code = String(detail?.code || json?.code || "");
  if (code === "item_not_available_today") {
    const itemName = String(detail?.itemName || "Un plat de votre panier");
    const scheduledDay = String(detail?.scheduledDay || "un autre jour");
    return `${itemName} n’est pas disponible aujourd’hui. Disponibilité prévue : ${scheduledDay}.`;
  }
  if (code === "catalog_item_not_found") {
    return "Un plat de votre panier a changé. Revenez au menu pour actualiser votre sélection.";
  }
  if (code === "minimum_order_not_met") {
    return "Le minimum de commande n’est plus atteint. Revenez au panier pour ajuster votre sélection.";
  }
  if (code === "payment_not_succeeded") {
    return "La confirmation bancaire est encore en cours. Aucun nouveau débit ne sera lancé : réessayez la réconciliation dans quelques instants.";
  }
  if (
    code === "payment_intent_required" ||
    code === "payment_intent_not_found" ||
    code === "payment_metadata_mismatch" ||
    code === "payment_quote_mismatch" ||
    code === "payment_principal_mismatch" ||
    code === "payment_order_mismatch" ||
    code === "payment_mutation_mismatch" ||
    code === "payment_cart_mismatch"
  ) {
    return "Le paiement ne correspond pas exactement à cette commande. Aucun nouveau débit ne sera lancé.";
  }
  const message = typeof json?.message === "string" ? json.message : "";
  const error = typeof json?.error === "string" ? json.error : "";
  return message || error || `Paiement indisponible (HTTP ${status}).`;
}

async function createPaymentIntent(params: {
  orderId: string;
  profile: ClientProfileLite;
  amount: number;
  clientMutationId: string;
  cartFingerprint: string;
}) {
  const { orderId, profile, amount, clientMutationId, cartFingerprint: fingerprint } = params;
  const cart = getCartSnapshot();
  const res = await daOrdersFetch(`${API_BASE_URL}/payments/create-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": clientMutationId,
      "X-DelishAfrica-Mutation-Id": clientMutationId,
    },
    body: JSON.stringify({
      orderId,
      amount,
      currency: "eur",
      partnerSlug: cart.restaurantSlug || cart.restaurantId || "",
      restaurantId: cart.restaurantId || cart.restaurantSlug || "",
      minimumOrderAmount: cart.minimumOrderAmount || 0,
      items: cart.items.map((item) => ({
        id: item.id,
        sku: item.sku || item.id,
        quantity: item.quantity,
      })),
      clientMutationId,
      cartFingerprint: fingerprint,
      metadata: {
        app: "client",
        flow: "checkout-payment-order-commit-v1",
        clientMutationId,
        cartFingerprint: fingerprint,
        clientId: profile.id,
        clientName: `${profile.firstName} ${profile.lastName}`.trim(),
        clientEmail: profile.email,
        city: profile.city,
        territory: profile.territory?.key || "unresolved",
        addressPlaceId: profile.addressTruth?.placeId || "missing",
        giftDelivery: profile.giftDelivery ? "yes" : "no",
        restaurant: cart.restaurantName || "Restaurant DelishAfrica",
        cartAmount: String(amount),
      },
    }),
  });

  const json = (await readJsonResponse(res)) as CreateIntentResponse;

  if (!res.ok || !json.ok) {
    throw new Error(checkoutApiError(json, res.status));
  }

  if (!json.clientSecret || !json.publishableKey) {
    throw new Error(
      "La configuration de paiement est indisponible pour le moment. Réessayez dans quelques instants.",
    );
  }

  if (Number(json.amount) !== Math.round(amount)) {
    throw new Error(
      "Le catalogue ou le prix de votre panier a évolué. Revenez au panier avant de poursuivre.",
    );
  }

  return json;
}

async function createDemoOrderAfterPayment(params: {
  orderId: string;
  profile: ClientProfileLite;
  paymentIntentId?: string | null;
  clientMutationId: string;
  cartFingerprint: string;
  cart: CartSnapshot;
}) {
  const { orderId, profile, paymentIntentId, clientMutationId, cartFingerprint: fingerprint, cart } = params;
  const allergenFlags = Array.isArray(profile.allergenFlags) ? profile.allergenFlags : [];
  const dietaryTags = Array.isArray(profile.dietaryTags) ? profile.dietaryTags : [];
  const foodSafetyNote = clean(profile.foodSafetyNote);
  const requiresMerchantAcknowledgement = allergenFlags.length > 0 || Boolean(foodSafetyNote);

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
      allergenFlags,
      dietaryTags,
      foodSafetyNote,
    },
    customerName: `${profile.firstName} ${profile.lastName}`.trim(),
    customerPhone: profile.phone,
    customerEmail: profile.email,
    deliveryAddress: `${profile.address}, ${profile.city}`,
    deliveryInstructions: profile.instructions,
    allergenFlags,
    dietaryTags,
    foodSafetyNote,
    safety: {
      allergenFlags,
      dietaryTags,
      note: foodSafetyNote,
      requiresMerchantAcknowledgement,
      confirmedAt: profile.foodSafetyConfirmedAt || profile.updatedAt,
      source: "client_declared",
    },
    notes: {
      delivery: profile.instructions,
      kitchen: foodSafetyNote,
    },
    restaurantId: cart.restaurantId || cart.restaurantSlug || "delishafrica-partner",
    restaurantName: cart.restaurantName || "Restaurant DelishAfrica",
    merchantName: cart.restaurantName || "Restaurant DelishAfrica",
    partnerSlug: cart.restaurantSlug || cart.restaurantId || "delishafrica-partner",
    merchantSlug: cart.restaurantSlug || cart.restaurantId || "delishafrica-partner",
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
      paymentIntentId,
      clientMutationId,
      cartFingerprint: fingerprint,
      clientPresentedAt: new Date().toISOString(),
    },
    clientMutationId,
    cartFingerprint: fingerprint,
    source: "client-ios-checkout-payment-order-commit-v1",
  };

  const res = await daOrdersFetch(`${API_BASE_URL}/orders/demo/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": clientMutationId,
      "X-DelishAfrica-Mutation-Id": clientMutationId,
    },
    body: JSON.stringify(body),
  });

  const json = await readJsonResponse(res);

  if (!res.ok) {
    throw new Error(checkoutApiError(json, res.status));
  }

  return json;
}

async function readOrder(orderId: string): Promise<Record<string, any> | null> {
  const res = await daOrdersFetch(`${API_BASE_URL}/orders/demo/get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ orderId }),
  });
  const json = (await readJsonResponse(res)) as OrderReadResponse;
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json.ok && json.order ? json.order : null;
}

function orderMatchesCommit(order: Record<string, any> | null, commit: PendingPaymentCommit): boolean {
  if (!order) return false;
  const orderId = String(order.orderId || order.id || "");
  const payment = order.payment && typeof order.payment === "object" ? order.payment : {};
  const amount = Number(order.total ?? order.amount ?? -1);
  const restaurantId = String(order.restaurantId || order.partnerSlug || order.merchantSlug || "");
  const expectedRestaurant = String(
    commit.cart.restaurantId || commit.cart.restaurantSlug || "delishafrica-partner",
  );
  return (
    orderId === commit.orderId &&
    amount === commit.cart.total &&
    restaurantId === expectedRestaurant &&
    String(payment.status || "").toLowerCase() === "paid" &&
    (!commit.paymentIntentId || String(payment.paymentIntentId || "") === commit.paymentIntentId)
  );
}

async function confirmCommittedOrder(commit: PendingPaymentCommit): Promise<Record<string, any> | null> {
  for (const waitMs of [0, 450, 1200]) {
    if (waitMs) await sleep(waitMs);
    const order = await readOrder(commit.orderId);
    if (orderMatchesCommit(order, commit)) return order;
  }
  return null;
}

export default function CheckoutPreflightScreen() {
  const [profile, setProfile] = useState<ClientProfileLite | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("En attente.");
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastPaymentIntentId, setLastPaymentIntentId] = useState<string | null>(null);
  const [pendingCommit, setPendingCommit] = useState<PendingPaymentCommit | null>(null);
  const paymentCommitRef = useRef(false);

  const hydrateProfile = useCallback(async () => {
    const restored = await restoreClientProfile();
    setProfile(restored);
    return restored;
  }, []);

  useEffect(() => {
    void hydrateProfile();
    void restorePendingPaymentCommit().then((recovered) => {
      if (!recovered) return;
      setPendingCommit(recovered);
      setLastOrderId(recovered.orderId);
      setLastPaymentIntentId(recovered.paymentIntentId);
      setPhase("Paiement confirmé. Commande à réconcilier sans nouveau débit.");
    });
  }, [hydrateProfile]);

  useFocusEffect(
    useCallback(() => {
      void hydrateProfile();
    }, [hydrateProfile]),
  );

  const missing = useMemo(() => missingFields(profile), [profile]);
  const profileReady = missing.length === 0;
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "—";
  const cartSnapshot = getCartSnapshot();
  const deliveryZone = profile
    ? validateDeliveryZone(
        { address: profile.address, city: profile.city },
        cartSnapshot.serviceAreaLabel,
      )
    : validateDeliveryZone(null, cartSnapshot.serviceAreaLabel);
  const cartReady = cartSnapshot.items.length > 0;
  const orderReady = profileReady && cartReady && deliveryZone.ok;
  const restaurantName = cartSnapshot.restaurantName || "Votre partenaire DelishAfrica";
  const checkoutAllergens = Array.isArray(profile?.allergenFlags) ? profile!.allergenFlags! : [];
  const checkoutDietaryTags = Array.isArray(profile?.dietaryTags) ? profile!.dietaryTags! : [];
  const checkoutFoodSafetyNote = clean(profile?.foodSafetyNote);
  const hasFoodSafetySignal = checkoutAllergens.length > 0 || checkoutDietaryTags.length > 0 || Boolean(checkoutFoodSafetyNote);
  const phaseVisible = phase !== "En attente." || Boolean(lastOrderId) || Boolean(lastPaymentIntentId);

  async function refresh() {
    await hydrateProfile();
    setPhase("Informations client actualisées depuis l’espace sécurisé.");
  }

  function primaryActionLabel(): string {
    if (pendingCommit) return "Réconcilier la commande";
    if (!cartReady) return "Retour à la marketplace";
    if (!profileReady) return "Compléter mes informations";
    if (!deliveryZone.ok) return "Vérifier mon adresse";
    return `Payer ${formatCartEuro(cartSnapshot.total)}`;
  }

  async function publishConfirmedOrder(orderId: string, restaurant: string) {
    await clearPendingPaymentCommit();
    setPendingCommit(null);
    clearCart();
    await waitForCartPersistence();
    setPhase("Commande payée, relue et transmise. Ouverture du suivi live.");
    Alert.alert(
      "Commande confirmée",
      `Paiement et commande ${orderId} confirmés pour ${restaurant || "votre restaurant"}.`,
      [{ text: "Suivre", onPress: () => router.push("/live-tracking" as any) }],
    );
  }

  async function reconcilePaidCommit(commit: PendingPaymentCommit) {
    setPhase("Relecture de la commande déjà payée...");
    let confirmed = await confirmCommittedOrder(commit);
    if (!confirmed) {
      setPhase("Commande absente. Réémission idempotente sans nouveau paiement...");
      await createDemoOrderAfterPayment({
        orderId: commit.orderId,
        profile: commit.profile,
        paymentIntentId: commit.paymentIntentId,
        clientMutationId: commit.clientMutationId,
        cartFingerprint: commit.cartFingerprint,
        cart: commit.cart,
      });
      confirmed = await confirmCommittedOrder(commit);
    }
    if (!confirmed) {
      throw new Error(
        "Le paiement est confirmé, mais la commande n’est pas encore relue. Aucun nouveau débit ne sera lancé : touchez Réconcilier la commande.",
      );
    }
    await publishConfirmedOrder(commit.orderId, commit.cart.restaurantName || "votre restaurant");
  }

  async function payAndCreateOrder() {
    if (paymentCommitRef.current) return;
    paymentCommitRef.current = true;
    setLoading(true);

    try {
      const recoveredCommit = pendingCommit || (await restorePendingPaymentCommit());
      if (recoveredCommit) {
        await reconcilePaidCommit(recoveredCommit);
        return;
      }

      if (!cartReady) {
        router.replace("/" as any);
        return;
      }

      const checkoutProfile = await restoreClientProfile();
      setProfile(checkoutProfile);
      if (!checkoutProfile) {
        Alert.alert("Profil requis", "Complétez d'abord votre espace Client.");
        router.push("/client-space" as any);
        return;
      }

      const missingNow = missingFields(checkoutProfile);
      if (missingNow.length > 0) {
        Alert.alert("Profil à revalider", `À compléter : ${missingNow.join(", ")}`);
        router.push("/client-space" as any);
        return;
      }

      const activeCart = getCartSnapshot();
      const activeFingerprint = cartFingerprint(activeCart);
      const minimumOrderAmount = Number(activeCart.minimumOrderAmount || 0);
      if (minimumOrderAmount > 0 && activeCart.total < minimumOrderAmount) {
        const missingAmount = Math.max(0, minimumOrderAmount - activeCart.total);
        Alert.alert(
          "Minimum de commande",
          `Ajoutez encore ${formatCartEuro(missingAmount)} pour atteindre le minimum de ${formatCartEuro(minimumOrderAmount)} chez ${activeCart.restaurantName || "ce restaurant"}.`,
        );
        router.replace("/cart" as any);
        return;
      }
      const activeZone = validateDeliveryZone(
        { address: checkoutProfile.address, city: checkoutProfile.city },
        activeCart.serviceAreaLabel,
      );

      if (!activeZone.ok) {
        Alert.alert(activeZone.title, activeZone.message);
        router.push("/client-space" as any);
        return;
      }

      setPhase("Vérification de l’adresse et des contacts...");
      const [phoneAttestation, emailAttestation, addressRecheck] = await Promise.all([
        daAttestIdentityProof({
          channel: "sms",
          role: "client",
          destination: checkoutProfile.phone,
          proofToken: checkoutProfile.proofs!.phone!.token,
        }),
        daAttestIdentityProof({
          channel: "email",
          role: "client",
          destination: checkoutProfile.email,
          proofToken: checkoutProfile.proofs!.email!.token,
        }),
        daResolveAddress(checkoutProfile.addressTruth!.placeId),
      ]);
      if (!phoneAttestation.valid || !emailAttestation.valid) {
        const invalidChannels = [
          !phoneAttestation.valid ? "téléphone" : null,
          !emailAttestation.valid ? "email" : null,
        ].filter(Boolean) as string[];
        const cleanedProfile: ClientProfileLite = {
          ...checkoutProfile,
          proofs: {
            phone: phoneAttestation.valid ? checkoutProfile.proofs?.phone : undefined,
            email: emailAttestation.valid ? checkoutProfile.proofs?.email : undefined,
          },
          updatedAt: new Date().toISOString(),
        };
        await writeClientProfileSnapshot(cleanedProfile);
        setProfile(cleanedProfile);
        throw new Error(`La preuve ${invalidChannels.join(" et ")} n’est plus valide. Revalidez uniquement ${invalidChannels.join(" et ")} dans Mon espace.`);
      }
      if (!addressRecheck.address.deliverable || addressRecheck.address.placeId !== checkoutProfile.addressTruth!.placeId) {
        throw new Error("L’adresse de livraison n’est plus confirmée. Sélectionnez-la à nouveau.");
      }
      if (activeFingerprint !== cartFingerprint(getCartSnapshot())) {
        throw new Error("Le panier a changé pendant la vérification. Revenez au panier avant de payer.");
      }

      const stripe = loadStripeNative();
      if (!stripe.ok || !stripe.module) {
        throw new Error(stripe.error || "Le module de paiement sécurisé est indisponible.");
      }

      const orderId = `DA-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      const clientMutationId = `client:${checkoutProfile.id}:${orderId}:${Date.now()}`;
      setLastOrderId(orderId);
      setLastPaymentIntentId(null);

      setPhase("Création transactionnelle du paiement...");
      const intent = await createPaymentIntent({
        orderId,
        profile: checkoutProfile,
        amount: activeCart.total,
        clientMutationId,
        cartFingerprint: activeFingerprint,
      });
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
          name: [checkoutProfile.firstName, checkoutProfile.lastName].filter(Boolean).join(" ") || "—",
          email: checkoutProfile.email,
          phone: checkoutProfile.phone,
          address: { line1: checkoutProfile.address, city: checkoutProfile.city },
        },
        style: "alwaysDark",
      });
      if (initResult?.error) {
        throw new Error(initResult.error.message || initResult.error.code || "Erreur d’initialisation bancaire");
      }

      setPhase("Validation bancaire en cours...");
      const result = await stripe.module.presentPaymentSheet?.();
      if (result?.error) {
        setPhase(`Paiement non finalisé : ${result.error.message || result.error.code || "annulé"}`);
        Alert.alert("Paiement non finalisé", result.error.message || "Le paiement a été annulé ou refusé.");
        return;
      }

      const commit: PendingPaymentCommit = {
        version: 1,
        orderId,
        paymentIntentId: intent.paymentIntentId || null,
        clientMutationId,
        cartFingerprint: activeFingerprint,
        profile: checkoutProfile,
        cart: activeCart,
        paidAt: new Date().toISOString(),
      };
      await writePendingPaymentCommit(commit);
      setPendingCommit(commit);

      setPhase("Paiement confirmé. Écriture puis relecture de la commande...");
      await createDemoOrderAfterPayment({
        orderId,
        profile: checkoutProfile,
        paymentIntentId: intent.paymentIntentId,
        clientMutationId,
        cartFingerprint: activeFingerprint,
        cart: activeCart,
      });
      const confirmed = await confirmCommittedOrder(commit);
      if (!confirmed) {
        throw new Error(
          "Paiement confirmé, mais confirmation de commande incomplète. Aucun nouveau débit ne sera lancé.",
        );
      }
      await publishConfirmedOrder(orderId, activeCart.restaurantName || "votre restaurant");
    } catch (error: any) {
      const message = error?.message || String(error);
      const paidCommit = await restorePendingPaymentCommit();
      if (paidCommit) {
        setPendingCommit(paidCommit);
        setPhase(`Paiement protégé · ${message}`);
        Alert.alert("Commande à réconcilier", message);
      } else {
        setPhase(`Checkout interrompu : ${message}`);
        Alert.alert("Checkout interrompu", message, [
          { text: "Mon espace", onPress: () => router.push("/client-space" as any) },
          { text: "Fermer", style: "cancel" },
        ]);
      }
    } finally {
      paymentCommitRef.current = false;
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>DELISHAFRICA® · CLIENT</Text>
            <Text style={styles.sectionName}>Validation essentielle</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.topButton, pressed && styles.pressFeedback]}
            onPress={() => router.replace("/cart" as any)}
            accessibilityRole="button"
            accessibilityLabel="Retour au panier"
            hitSlop={8}
          >
            <Text style={styles.topButtonText}>Panier</Text>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={styles.kicker}>PAIEMENT SÉCURISÉ</Text>
          <Text style={styles.title}>Payer. Envoyer. Suivre.</Text>
          <Text style={styles.subtitle}>
            Une dernière vérification, une seule action principale, puis la commande rejoint le restaurant.
          </Text>
        </View>

        <View style={[styles.orderCard, orderReady ? styles.orderCardReady : styles.orderCardPending]}>
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderText}>
              <Text style={styles.orderEyebrow}>COMMANDE À VALIDER</Text>
              <Text style={styles.restaurantName}>{restaurantName}</Text>
              <Text style={styles.orderSummary}>
                {cartReady ? cartItemSummary(cartSnapshot) : "Panier à compléter"}
              </Text>
            </View>
            <View style={[styles.statusPill, orderReady ? styles.statusReady : styles.statusPending]}>
              <Text style={[styles.statusText, orderReady ? styles.statusTextReady : styles.statusTextPending]}>
                {orderReady ? "PRÊTE" : "À VÉRIFIER"}
              </Text>
            </View>
          </View>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>TOTAL SÉCURISÉ</Text>
            <Text style={styles.amountValue}>{formatCartEuro(cartSnapshot.total)}</Text>
          </View>

          <View style={styles.stepRail}>
            <View style={styles.stepDone}>
              <Text style={styles.stepNumberDone}>1</Text>
              <Text style={styles.stepLabelDone}>Vérifier</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={orderReady ? styles.stepActive : styles.stepIdle}>
              <Text style={orderReady ? styles.stepNumberActive : styles.stepNumberIdle}>2</Text>
              <Text style={orderReady ? styles.stepLabelActive : styles.stepLabelIdle}>Payer</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepIdle}>
              <Text style={styles.stepNumberIdle}>3</Text>
              <Text style={styles.stepLabelIdle}>Suivre</Text>
            </View>
          </View>

          <View style={styles.truthGrid}>
            <View style={styles.truthItem}>
              <Text style={styles.truthLabel}>IDENTITÉ PROUVÉE</Text>
              <Text style={profileReady ? styles.truthGood : styles.truthWarn}>
                {profileReady ? fullName : "Adresse + SMS + email requis"}
              </Text>
            </View>
            <View style={styles.truthItem}>
              <Text style={styles.truthLabel}>LIVRAISON</Text>
              <Text style={deliveryZone.ok ? styles.truthGood : styles.truthWarn}>
                {deliveryZoneSummary(deliveryZone)}
              </Text>
            </View>
          </View>

          {profileReady ? (
            <View style={styles.addressBlock}>
              <View style={styles.addressCopy}>
                <Text style={styles.addressLabel}>ADRESSE DE REMISE</Text>
                <Text style={styles.addressValue}>
                  {profile?.address}, {profile?.city}
                </Text>
                <Text style={styles.addressMeta}>{profile?.phone}</Text>
                {profile?.instructions ? (
                  <Text style={styles.instructions}>{profile.instructions}</Text>
                ) : null}
              </View>
              <Pressable
                style={({ pressed }) => [styles.refreshButton, pressed && styles.pressFeedback]}
                onPress={refresh}
                accessibilityRole="button"
                accessibilityLabel="Actualiser les informations de livraison"
              >
                <Text style={styles.refreshButtonText}>Actualiser</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.missingBlock}>
              <Text style={styles.missingTitle}>Informations nécessaires</Text>
              <Text style={styles.missingText}>{missing.join(" · ")}</Text>
            </View>
          )}

          {profileReady && hasFoodSafetySignal ? (
            <View style={styles.foodSafetyBlock}>
              <Text style={styles.foodSafetyLabel}>INFORMATIONS CUISINE TRANSMISES</Text>
              {checkoutAllergens.length > 0 ? (
                <Text style={styles.foodSafetyAlert}>Allergènes : {checkoutAllergens.join(" · ")}</Text>
              ) : null}
              {checkoutDietaryTags.length > 0 ? (
                <Text style={styles.foodSafetyText}>Préférences : {checkoutDietaryTags.join(" · ")}</Text>
              ) : null}
              {checkoutFoodSafetyNote ? (
                <Text style={styles.foodSafetyText}>Cuisine : {checkoutFoodSafetyNote}</Text>
              ) : null}
              <Text style={styles.foodSafetyMeta}>Le paiement ne reçoit pas ces données. Elles sont jointes uniquement à la commande du restaurant.</Text>
            </View>
          ) : null}

          {phaseVisible ? (
            <View style={styles.phaseBlock}>
              <Text style={styles.phaseLabel}>ÉTAT DE VALIDATION</Text>
              <Text style={styles.phaseText}>{phase}</Text>
              {lastOrderId ? <Text style={styles.phaseMeta}>Commande {lastOrderId}</Text> : null}
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#082D1E" />
              <Text style={styles.loadingText}>Validation sécurisée en cours...</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.primaryButton, loading && styles.disabled, pressed && !loading && styles.pressFeedback]}
            onPress={payAndCreateOrder}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={primaryActionLabel()}
            accessibilityHint="Lance une transaction unique puis confirme la commande par relecture réseau sans double débit"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Text style={styles.primaryButtonText}>{primaryActionLabel()}</Text>
            <Text style={styles.primaryArrow}>→</Text>
          </Pressable>
        </View>

        <View style={styles.secondaryPanel}>
          <View style={styles.secondaryCopy}>
            <Text style={styles.secondaryKicker}>AJUSTER SI NÉCESSAIRE</Text>
            <Text style={styles.secondaryTitle}>Le parcours principal reste intact.</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressFeedback]}
            onPress={() => router.push("/client-space" as any)}
            accessibilityRole="button"
            accessibilityLabel="Modifier mes informations de livraison"
          >
            <Text style={styles.secondaryButtonText}>Modifier mes informations</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressFeedback]}
          onPress={() => router.replace("/" as any)}
          accessibilityRole="button"
          accessibilityLabel="Retour à la marketplace"
        >
          <Text style={styles.backText}>Retour à la marketplace</Text>
        </Pressable>

        <Text style={styles.note}>
          Le panier n’est vidé qu’après paiement, écriture et relecture confirmée de la commande.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#04150F" },
  page: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 70 },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 28,
  },
  brand: { color: "#77F0AD", fontSize: 14, fontWeight: "900", letterSpacing: 3.4 },
  sectionName: { color: "#EAF8EF", fontSize: 20, fontWeight: "900", marginTop: 7 },
  topButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(119,240,173,0.34)",
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: "rgba(119,240,173,0.06)",
  },
  topButtonText: { color: "#DDF9E8", fontWeight: "900", fontSize: 14 },
  intro: { marginBottom: 22 },
  kicker: { color: "#E5B762", fontSize: 11, lineHeight: 17, fontWeight: "900", letterSpacing: 2.6, marginBottom: 11 },
  title: { color: "#FFF9EC", fontSize: 42, lineHeight: 46, fontWeight: "900", letterSpacing: -1.6 },
  subtitle: { color: "#8EA297", fontSize: 16, lineHeight: 25, fontWeight: "700", marginTop: 15 },
  orderCard: { borderRadius: 30, padding: 20, overflow: "hidden" },
  orderCardReady: { backgroundColor: "#F6E8C8" },
  orderCardPending: { backgroundColor: "#F2E0C4" },
  orderHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  orderHeaderText: { flex: 1 },
  orderEyebrow: { color: "#267C52", fontSize: 12, fontWeight: "900", letterSpacing: 3.2 },
  restaurantName: { color: "#09291B", fontSize: 28, lineHeight: 33, fontWeight: "900", marginTop: 10 },
  orderSummary: { color: "#6B766E", fontSize: 15, lineHeight: 21, fontWeight: "800", marginTop: 6 },
  statusPill: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  statusReady: { backgroundColor: "#C5F5D6" },
  statusPending: { backgroundColor: "#F1C995" },
  statusText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.8 },
  statusTextReady: { color: "#17623E" },
  statusTextPending: { color: "#7A4827" },
  amountBlock: { marginTop: 24, borderRadius: 24, padding: 17, backgroundColor: "rgba(9,41,27,0.07)" },
  amountLabel: { color: "#657268", fontSize: 11, fontWeight: "900", letterSpacing: 2.5 },
  amountValue: { color: "#09291B", fontSize: 34, lineHeight: 39, fontWeight: "900", marginTop: 7 },
  stepRail: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 24, marginBottom: 22 },
  stepDone: { alignItems: "center", gap: 7 },
  stepActive: { alignItems: "center", gap: 7 },
  stepIdle: { alignItems: "center", gap: 7 },
  stepNumberDone: { width: 44, height: 44, borderRadius: 22, textAlign: "center", textAlignVertical: "center", color: "#052719", backgroundColor: "#B8EBCB", fontSize: 17, fontWeight: "900" },
  stepNumberActive: { width: 44, height: 44, borderRadius: 22, textAlign: "center", textAlignVertical: "center", color: "#052719", backgroundColor: "#64D69B", fontSize: 17, fontWeight: "900" },
  stepNumberIdle: { width: 44, height: 44, borderRadius: 22, textAlign: "center", textAlignVertical: "center", color: "#708075", backgroundColor: "rgba(9,41,27,0.08)", fontSize: 17, fontWeight: "900" },
  stepLabelDone: { color: "#30724F", fontSize: 12, fontWeight: "900" },
  stepLabelActive: { color: "#155C3B", fontSize: 12, fontWeight: "900" },
  stepLabelIdle: { color: "#758278", fontSize: 12, fontWeight: "900" },
  stepLine: { flex: 1, height: 3, backgroundColor: "rgba(9,41,27,0.10)", marginHorizontal: 8, marginBottom: 20 },
  truthGrid: { flexDirection: "row", gap: 10 },
  truthItem: { flex: 1, minHeight: 94, borderRadius: 20, padding: 14, backgroundColor: "rgba(255,255,255,0.42)" },
  truthLabel: { color: "#738077", fontSize: 10, fontWeight: "900", letterSpacing: 2.3, marginBottom: 8 },
  truthGood: { color: "#155C3B", fontSize: 14, lineHeight: 20, fontWeight: "900" },
  truthWarn: { color: "#8C4E2C", fontSize: 14, lineHeight: 20, fontWeight: "900" },
  addressBlock: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 22, padding: 16, backgroundColor: "rgba(9,41,27,0.07)", marginTop: 12 },
  addressCopy: { flex: 1 },
  addressLabel: { color: "#657268", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  addressValue: { color: "#09291B", fontSize: 17, lineHeight: 23, fontWeight: "900", marginTop: 7 },
  addressMeta: { color: "#637066", fontSize: 14, fontWeight: "800", marginTop: 5 },
  instructions: { color: "#8C5C31", fontSize: 14, lineHeight: 20, fontWeight: "800", marginTop: 7 },
  refreshButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(9,41,27,0.09)" },
  refreshButtonText: { color: "#294538", fontSize: 11, fontWeight: "900" },
  missingBlock: { borderRadius: 22, padding: 16, backgroundColor: "rgba(161,92,56,0.10)", marginTop: 12 },
  missingTitle: { color: "#7B4529", fontSize: 16, fontWeight: "900" },
  missingText: { color: "#8B5E42", fontSize: 14, lineHeight: 21, fontWeight: "700", marginTop: 5 },
  foodSafetyBlock: { borderRadius: 20, padding: 15, backgroundColor: "rgba(151,70,34,0.10)", borderWidth: 1, borderColor: "rgba(151,70,34,0.18)", marginTop: 12 },
  foodSafetyLabel: { color: "#7A4827", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  foodSafetyAlert: { color: "#7A2E18", fontSize: 14, lineHeight: 20, fontWeight: "900", marginTop: 8 },
  foodSafetyText: { color: "#704C38", fontSize: 13, lineHeight: 19, fontWeight: "800", marginTop: 6 },
  foodSafetyMeta: { color: "#806958", fontSize: 11, lineHeight: 17, marginTop: 9 },
  phaseBlock: { borderRadius: 20, padding: 15, backgroundColor: "rgba(9,41,27,0.07)", marginTop: 12 },
  phaseLabel: { color: "#657268", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  phaseText: { color: "#173B2A", fontSize: 15, lineHeight: 22, fontWeight: "800", marginTop: 7 },
  phaseMeta: { color: "#267C52", fontSize: 13, fontWeight: "900", marginTop: 5 },
  loadingBox: { borderRadius: 20, padding: 15, marginTop: 12, flexDirection: "row", gap: 12, alignItems: "center", backgroundColor: "rgba(100,214,155,0.20)" },
  loadingText: { color: "#173B2A", fontSize: 15, fontWeight: "900" },
  primaryButton: { minHeight: 60, borderRadius: 20, paddingHorizontal: 20, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#082D1E" },
  disabled: { opacity: 0.55 },
  primaryButtonText: { color: "#FFF7E8", fontSize: 18, fontWeight: "900" },
  primaryArrow: { color: "#70E9A8", fontSize: 29, fontWeight: "700" },
  secondaryPanel: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 24, borderWidth: 1, borderColor: "rgba(119,240,173,0.20)", padding: 18, marginTop: 16, backgroundColor: "#082117" },
  secondaryCopy: { flex: 1 },
  secondaryKicker: { color: "#6EE5A4", fontSize: 10, fontWeight: "900", letterSpacing: 2.5 },
  secondaryTitle: { color: "#EEF9F1", fontSize: 18, lineHeight: 23, fontWeight: "900", marginTop: 7 },
  secondaryButton: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: "rgba(119,240,173,0.10)" },
  secondaryButtonText: { color: "#DDF9E8", fontSize: 12, fontWeight: "900", textAlign: "center" },
  backButton: { paddingVertical: 22, alignItems: "center" },
  backText: { color: "#E5B762", fontSize: 16, fontWeight: "900" },
  note: { color: "#708779", fontSize: 12, lineHeight: 19, textAlign: "center", fontWeight: "700" },
  pressFeedback: { opacity: 0.8, transform: [{ scale: 0.99 }] },
});
