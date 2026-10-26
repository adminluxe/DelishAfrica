import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { router, useLocalSearchParams } from 'expo-router';
import { daInspectProfileTrust, DaProfileTrustResult } from '../utils/daProfileTrust';
import { useDaPkceAuth } from '../hooks/useDaPkceAuth';
import { daAccountScopeId, daAccountStorageKey, daSessionRehydrationStatus } from '../utils/daOrdersApi';
import { daCanonicalContact, daLocalProofFresh } from '../utils/daProofIdentity';
import { daProbeTerritoryTruth, type DaTerritoryTruthResult } from '../utils/daTerritoryTruth';
import {
  DaAddressSuggestion,
  DaIdentityChannel,
  DaIdentityProof,
  DaResolvedAddress,
  DaTerritoryContext,
  daAttestIdentityProof,
  daAutocompleteAddress,
  daCheckIdentityProof,
  daDescribeLocationError,
  daNewIdentityRequestId,
  daResolveAddress,
  daResolveTerritory,
  daStartIdentityProof,
} from '../utils/daTrustNetwork';


import { Link as DaLegalLink } from "expo-router";
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
  giftDelivery: boolean;
  addressTruth?: DaResolvedAddress['address'];
  territory?: DaResolvedAddress['territory'];
  proofs?: { phone?: DaIdentityProof; email?: DaIdentityProof };
  trust?: { status: 'screened'; score: number; checkedAt: string; emailDomain: string };
  updatedAt: string;
};

const PROFILE_KEY = '__DELISHAFRICA_CLIENT_PROFILE_LITE_V1__';
const bag = () => globalThis as unknown as Record<string, unknown>;
const clean = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();
const clientProfileMemory = new Map<string, ClientProfileLite>();

async function loadClientProfile(): Promise<ClientProfileLite | null> {
  try {
    const scope = await daAccountScopeId();
    const cached = clientProfileMemory.get(scope);
    if (cached) return cached;
    const scopedKey = await daAccountStorageKey(PROFILE_KEY);
    const raw = await SecureStore.getItemAsync(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientProfileLite;
    if (!parsed || typeof parsed !== 'object' || !parsed.id) return null;
    clientProfileMemory.set(scope, parsed);
    bag()[scopedKey] = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function saveClientProfile(profile: ClientProfileLite): Promise<void> {
  const scope = await daAccountScopeId();
  const scopedKey = await daAccountStorageKey(PROFILE_KEY);
  await SecureStore.setItemAsync(scopedKey, JSON.stringify(profile), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  // A profile is cached only when encrypted persistence has succeeded.
  clientProfileMemory.set(scope, profile);
  bag()[scopedKey] = profile;
}

const sessionToken = () => `da-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const ALLERGEN_OPTIONS = [
  'Céréales contenant du gluten',
  'Crustacés',
  'Œufs',
  'Poisson',
  'Arachides',
  'Soja',
  'Lait / lactose',
  'Fruits à coque',
  'Céleri',
  'Moutarde',
  'Sésame',
  'Sulfites',
  'Lupin',
  'Mollusques',
] as const;

const DIETARY_OPTIONS = [
  'Végétarien',
  'Végétalien',
  'Halal',
  'Sans porc',
  'Sans alcool',
  'Préférence sans gluten',
  'Peu épicé',
] as const;

function toggleListValue(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export default function ClientSpaceScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const returnToCheckout = returnTo === 'checkout';
  const existing: ClientProfileLite | null = null;
  const [firstName, setFirstName] = useState(existing?.firstName || '');
  const [lastName, setLastName] = useState(existing?.lastName || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [city, setCity] = useState(existing?.city || '');
  const [instructions, setInstructions] = useState(existing?.instructions || '');
  const [allergenFlags, setAllergenFlags] = useState<string[]>(existing?.allergenFlags || []);
  const [dietaryTags, setDietaryTags] = useState<string[]>(existing?.dietaryTags || []);
  const [foodSafetyNote, setFoodSafetyNote] = useState(existing?.foodSafetyNote || '');
  const [foodSafetyConfirmed, setFoodSafetyConfirmed] = useState(Boolean(existing?.foodSafetyConfirmedAt));
  const [consent, setConsent] = useState(existing?.consent ?? false);
  const [giftDelivery, setGiftDelivery] = useState(existing?.giftDelivery ?? false);
  const [addressTruth, setAddressTruth] = useState<DaResolvedAddress['address'] | null>(existing?.addressTruth || null);
  const [deliveryTerritory, setDeliveryTerritory] = useState<DaResolvedAddress['territory'] | null>(existing?.territory || null);
  const [deviceTerritory, setDeviceTerritory] = useState<DaTerritoryContext | null>(null);
  const [suggestions, setSuggestions] = useState<DaAddressSuggestion[]>([]);
  const [addressSession, setAddressSession] = useState(sessionToken());
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressProviderBlocked, setAddressProviderBlocked] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [territoryTruth, setTerritoryTruth] = useState<DaTerritoryTruthResult | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [phoneAttemptToken, setPhoneAttemptToken] = useState('');
  const [emailAttemptToken, setEmailAttemptToken] = useState('');
  const [phoneAlternateAvailable, setPhoneAlternateAvailable] = useState(false);
  const [phoneProvider, setPhoneProvider] = useState('');
  const [phoneProof, setPhoneProof] = useState<DaIdentityProof | null>(existing?.proofs?.phone || null);
  const [emailProof, setEmailProof] = useState<DaIdentityProof | null>(existing?.proofs?.email || null);
  const [proofBusy, setProofBusy] = useState<DaIdentityChannel | null>(null);
  const proofFlightRef = useRef(false);
  const [phoneClientRequestId, setPhoneClientRequestId] = useState('');
  const [emailClientRequestId, setEmailClientRequestId] = useState('');
  const [phoneAttemptExpiresAt, setPhoneAttemptExpiresAt] = useState('');
  const [emailAttemptExpiresAt, setEmailAttemptExpiresAt] = useState('');
  const [trust, setTrust] = useState<DaProfileTrustResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [profileId, setProfileId] = useState(existing?.id || '');
  const [hydrating, setHydrating] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState(existing?.updatedAt || '');
  const [editing, setEditing] = useState(true);
  const [stage, setStage] = useState<'contacts' | 'delivery'>('contacts');
  const [showPreferences, setShowPreferences] = useState(false);
  const [inlineNotice, setInlineNotice] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const [enrollmentEnabled, setEnrollmentEnabled] = useState<boolean | null>(null);
  const auth = useDaPkceAuth();
  const accountConnected = auth.session.status === 'authenticated';

  useEffect(() => {
    let active = true;
    const raw = String(process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'https://api.delishafrica.me/api/v1');
    const base = raw.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    void fetch(base + '/api/v1/client-enrollment/readiness')
      .then((response) => response.json())
      .then((result) => { if (active) setEnrollmentEnabled(result?.enabled === true); })
      .catch(() => { if (active) setEnrollmentEnabled(false); });
    return () => { active = false; };
  }, []);

  const phoneVerified = daLocalProofFresh('sms', phoneProof, phone);
  const emailVerified = daLocalProofFresh('email', emailProof, email);
  const addressVerified = Boolean(addressTruth?.deliverable && addressTruth.formattedAddress === clean(address));
  const ownershipReady = phoneVerified && emailVerified;

  const basics = useMemo(() => {
    const issues: string[] = [];
    if (clean(firstName).length < 2) issues.push('Prénom requis.');
    if (!clean(phone)) issues.push('Téléphone requis.');
    if (!clean(email)) issues.push('Email requis.');
    if (!addressVerified) issues.push('Sélectionnez une adresse réelle dans les suggestions.');
    if (!clean(city)) issues.push('Ville non résolue.');
    if (!consent) issues.push('Consentement requis.');
    return issues;
  }, [addressVerified, city, consent, email, firstName, phone]);

  async function persistActivationDraft(patch: Partial<ClientProfileLite> = {}) {
    const current = await loadClientProfile();
    const draft: ClientProfileLite = {
      id: profileId || current?.id || `da_client_draft_${Date.now().toString(36)}`,
      firstName: clean(firstName),
      lastName: clean(lastName),
      phone: daCanonicalContact('sms', phone),
      email: daCanonicalContact('email', email),
      address: clean(address),
      city: clean(city),
      instructions: clean(instructions),
      allergenFlags,
      dietaryTags,
      foodSafetyNote: clean(foodSafetyNote),
      foodSafetyConfirmedAt: foodSafetyConfirmed
        ? current?.foodSafetyConfirmedAt || new Date().toISOString()
        : undefined,
      consent,
      giftDelivery,
      addressTruth: addressTruth || undefined,
      territory: deliveryTerritory || undefined,
      proofs: {
        phone: phoneProof || undefined,
        email: emailProof || undefined,
      },
      trust: current?.trust,
      updatedAt: new Date().toISOString(),
      ...patch,
    };
    await saveClientProfile(draft);
    setProfileId(draft.id);
    setLastSavedAt(draft.updatedAt);
    return draft;
  }

  useEffect(() => {
    let active = true;
    void loadClientProfile().then((profile) => {
      if (!active) return;
      if (profile) {
        setProfileId(profile.id || '');
        setFirstName(profile.firstName || '');
        setLastName(profile.lastName || '');
        setPhone(profile.phone || '');
        setEmail(profile.email || '');
        setAddress(profile.address || '');
        setCity(profile.city || '');
        setInstructions(profile.instructions || '');
        setAllergenFlags(Array.isArray(profile.allergenFlags) ? profile.allergenFlags : []);
        setDietaryTags(Array.isArray(profile.dietaryTags) ? profile.dietaryTags : []);
        setFoodSafetyNote(profile.foodSafetyNote || '');
        setFoodSafetyConfirmed(Boolean(profile.foodSafetyConfirmedAt));
        setConsent(Boolean(profile.consent));
        setGiftDelivery(Boolean(profile.giftDelivery));
        setAddressTruth(profile.addressTruth || null);
        setDeliveryTerritory(profile.territory || null);
        setPhoneProof(profile.proofs?.phone || null);
        setEmailProof(profile.proofs?.email || null);
        setLastSavedAt(profile.updatedAt || '');
        const bothVerified = daLocalProofFresh('sms', profile.proofs?.phone, profile.phone)
          && daLocalProofFresh('email', profile.proofs?.email, profile.email);
        const deliveryReady = Boolean(profile.addressTruth?.deliverable && profile.city && profile.consent);
        setEditing(!bothVerified || !deliveryReady);
        setStage(bothVerified ? 'delivery' : 'contacts');
        setShowPreferences(Boolean(profile.allergenFlags?.length || profile.dietaryTags?.length || profile.foodSafetyNote));
      } else {
        setEditing(true);
        setStage('contacts');
      }
      setHydrating(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void daProbeTerritoryTruth({ requestPermission: false }).then((result) => {
      if (!active) return;
      setTerritoryTruth(result);
      if (result.ok && result.context) setDeviceTerritory(result.context);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const query = clean(address);
    if (addressVerified || query.length < 3 || addressProviderBlocked) {
      setSuggestions([]);
      setAddressBusy(false);
      if (query.length < 3 && !addressProviderBlocked) setAddressError(null);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setAddressBusy(true);
      try {
        const territory = deviceTerritory?.territory;
        const result = await daAutocompleteAddress({
          text: query,
          sessionToken: addressSession,
          latitude: deviceTerritory?.coordinates.latitude,
          longitude: deviceTerritory?.coordinates.longitude,
          countryCodes: !giftDelivery && territory?.countryCode ? [territory.countryCode] : [],
        });
        if (active) {
          const nextSuggestions = result.suggestions || [];
          setAddressSession(result.sessionToken || addressSession);
          setSuggestions(nextSuggestions);
          setAddressProviderBlocked(false);
          setAddressError(
            nextSuggestions.length > 0
              ? null
              : 'Aucune adresse pr\u00e9cise trouv\u00e9e. Ajoutez le num\u00e9ro, la rue et la ville.',
          );
        }
      } catch (error: unknown) {
        if (active) {
          const state = daDescribeLocationError(error);
          setSuggestions([]);
          setAddressProviderBlocked(state.blocked);
          setAddressError(state.message);
        }
      } finally {
        if (active) setAddressBusy(false);
      }
    }, 520);
    return () => { active = false; clearTimeout(timer); };
  }, [address, addressProviderBlocked, addressVerified, deviceTerritory, giftDelivery]);

  const invalidateTrust = () => setTrust(null);
  const changePhone = (value: string) => {
    const changed = daCanonicalContact('sms', phone) !== daCanonicalContact('sms', value);
    setPhone(value);
    if (!changed) return; // A formatting-only edit must preserve its valid proof.
    setPhoneProof(null);
    setPhoneSent(false);
    setPhoneCode('');
    setPhoneAttemptToken('');
    setPhoneClientRequestId('');
    setPhoneAttemptExpiresAt('');
    setPhoneAlternateAvailable(false);
    setPhoneProvider('');
    invalidateTrust();
  };
  const changeEmail = (value: string) => {
    const changed = daCanonicalContact('email', email) !== daCanonicalContact('email', value);
    setEmail(value);
    if (!changed) return; // Letter case and outer spaces do not change ownership.
    setEmailProof(null);
    setEmailSent(false);
    setEmailCode('');
    setEmailAttemptToken('');
    setEmailClientRequestId('');
    setEmailAttemptExpiresAt('');
    invalidateTrust();
  };
  const changeAddress = (value: string) => {
    setAddress(value);
    setAddressTruth(null);
    setDeliveryTerritory(null);
    setCity('');
    setSuggestions([]);
    if (!addressProviderBlocked) setAddressError(null);
    invalidateTrust();
  };

  function retryAddressProvider() {
    setAddressProviderBlocked(false);
    setAddressError(null);
    setAddressSession(sessionToken());
  };

  async function detectTerritory() {
    setLocationBusy(true);
    try {
      const result = await daProbeTerritoryTruth({ requestPermission: true });
      setTerritoryTruth(result);
      if (!result.ok || !result.context) {
        Alert.alert('Territoire non confirmé', result.message);
        return;
      }
      setDeviceTerritory(result.context);
      Alert.alert('Territoire détecté', result.message);
    } finally {
      setLocationBusy(false);
    }
  }

  async function chooseAddress(suggestion: DaAddressSuggestion) {
    setAddressBusy(true);
    try {
      const result = await daResolveAddress(suggestion.placeId, addressSession);
      if (!result.address.deliverable) {
        Alert.alert('Adresse insuffisamment précise', result.message);
        return;
      }
      await persistActivationDraft({
        address: result.address.formattedAddress,
        addressTruth: result.address,
        territory: result.territory,
        city: result.territory.city,
        trust: undefined,
      });
      setAddress(result.address.formattedAddress);
      setAddressTruth(result.address);
      setDeliveryTerritory(result.territory);
      setCity(result.territory.city);
      setSuggestions([]);
      setAddressError(null);
      setAddressProviderBlocked(false);
      setAddressSession(sessionToken());
      invalidateTrust();
    } catch (error: any) {
      Alert.alert('Adresse non confirmée', error?.message || 'Choisissez une autre proposition.');
    } finally {
      setAddressBusy(false);
    }
  }

  async function sendProof(channel: DaIdentityChannel, route: 'auto' | 'alternate' = 'auto') {
    if (proofFlightRef.current) return;
    const destination = channel === 'sms' ? daCanonicalContact('sms', phone) : daCanonicalContact('email', email);
    if (!destination) {
      Alert.alert('Coordonnée manquante', channel === 'sms' ? 'Ajoutez votre téléphone.' : 'Ajoutez votre email.');
      return;
    }
    const alreadySent = channel === 'sms' ? phoneSent : emailSent;
    const explicitResend = route === 'alternate' || alreadySent;
    const currentRequestId = channel === 'sms' ? phoneClientRequestId : emailClientRequestId;
    const requestId = explicitResend || !currentRequestId
      ? daNewIdentityRequestId('client-' + channel)
      : currentRequestId;
    if (channel === 'sms') setPhoneClientRequestId(requestId); else setEmailClientRequestId(requestId);

    proofFlightRef.current = true;
    setProofBusy(channel);
    try {
      const result = await daStartIdentityProof({
        channel,
        role: 'client',
        destination,
        route,
        clientRequestId: requestId,
        resend: explicitResend,
      });
      const effectiveRequestId = result.clientRequestId || requestId;
      const expiresAt = result.expiresAt || new Date(Date.now() + Math.max(30, Number(result.validForSeconds || 180)) * 1000).toISOString();
      if (channel === 'sms') {
        setPhoneSent(true);
        setPhoneCode('');
        setPhoneAttemptToken(result.attemptToken || '');
        setPhoneClientRequestId(effectiveRequestId);
        setPhoneAttemptExpiresAt(expiresAt);
        setPhoneAlternateAvailable(Boolean(result.alternateAvailable));
        setPhoneProvider(result.provider || '');
      } else {
        setEmailSent(true);
        setEmailCode('');
        setEmailAttemptToken(result.attemptToken || '');
        setEmailClientRequestId(effectiveRequestId);
        setEmailAttemptExpiresAt(expiresAt);
      }
      // A positive status is non-blocking. The code field appears below the contact.
      setInlineNotice(result.reused
        ? 'Code déjà envoyé. Utilisez le plus récent.'
        : route === 'alternate'
          ? 'Code envoyé par notre service de secours.'
          : 'Code envoyé. Entrez-le juste en dessous.');
    } catch (error: any) {
      Alert.alert('Envoi indisponible', error?.message || 'Le fournisseur de vérification est indisponible.');
    } finally {
      proofFlightRef.current = false;
      setProofBusy(null);
    }
  }

  async function verifyProof(channel: DaIdentityChannel) {
    if (proofFlightRef.current) return;
    const destination = channel === 'sms' ? daCanonicalContact('sms', phone) : daCanonicalContact('email', email);
    const code = channel === 'sms' ? phoneCode : emailCode;
    const attemptToken = channel === 'sms' ? phoneAttemptToken : emailAttemptToken;
    const attemptExpiresAt = channel === 'sms' ? phoneAttemptExpiresAt : emailAttemptExpiresAt;
    if (!attemptToken) {
      Alert.alert('Tentative manquante', 'Demandez un nouveau code avant de valider.');
      return;
    }
    if (!/^\d{4,10}$/.test(clean(code))) {
      Alert.alert('Code incomplet', 'Saisissez le code reçu, entre 4 et 10 chiffres.');
      return;
    }
    if (attemptExpiresAt && Date.parse(attemptExpiresAt) <= Date.now()) {
      if (channel === 'sms') {
        setPhoneSent(false);
        setPhoneCode('');
        setPhoneAttemptToken('');
        setPhoneClientRequestId('');
        setPhoneAttemptExpiresAt('');
        setPhoneAlternateAvailable(false);
        setPhoneProvider('');
      } else {
        setEmailSent(false);
        setEmailCode('');
        setEmailAttemptToken('');
        setEmailClientRequestId('');
        setEmailAttemptExpiresAt('');
      }
      Alert.alert('Code expiré', 'Demandez un nouveau code et utilisez uniquement le plus récent.');
      return;
    }

    proofFlightRef.current = true;
    setProofBusy(channel);
    try {
      const result = await daCheckIdentityProof({ channel, role: 'client', destination, code, attemptToken });
      if (result.expired || result.reasonCode === 'expired') {
        if (channel === 'sms') {
          setPhoneSent(false);
          setPhoneCode('');
          setPhoneAttemptToken('');
          setPhoneClientRequestId('');
          setPhoneAttemptExpiresAt('');
          setPhoneAlternateAvailable(false);
          setPhoneProvider('');
        } else {
          setEmailSent(false);
          setEmailCode('');
          setEmailAttemptToken('');
          setEmailClientRequestId('');
          setEmailAttemptExpiresAt('');
        }
        Alert.alert('Code expiré', result.message || 'Demandez un nouveau code et utilisez uniquement le plus récent.');
        return;
      }
      if (!result.approved || !result.proofToken || !result.verifiedAt || !result.expiresAt) {
        Alert.alert('Code non validé', result.message || 'Vérifiez le code puis réessayez.');
        return;
      }
      const proof: DaIdentityProof = { token: result.proofToken, verifiedAt: result.verifiedAt, expiresAt: result.expiresAt, destination };
      const attestation = await daAttestIdentityProof({
        channel,
        role: 'client',
        destination,
        proofToken: proof.token,
      });
      if (!attestation.valid) {
        Alert.alert(
          'Preuve non conservée',
          'Le code a été accepté, mais la preuve ne peut pas être relue par le checkout. Demandez un nouveau code.',
        );
        return;
      }
      await persistActivationDraft({
        phone: channel === 'sms' ? destination : daCanonicalContact('sms', phone),
        email: channel === 'email' ? destination : daCanonicalContact('email', email),
        proofs: {
          phone: channel === 'sms' ? proof : phoneProof || undefined,
          email: channel === 'email' ? proof : emailProof || undefined,
        },
        trust: undefined,
      });
      if (channel === 'sms') setPhoneProof(proof); else setEmailProof(proof);
      if (channel === 'sms') {
        setPhoneAttemptToken('');
        setPhoneClientRequestId('');
        setPhoneAttemptExpiresAt('');
        setPhoneCode('');
      } else {
        setEmailAttemptToken('');
        setEmailClientRequestId('');
        setEmailAttemptExpiresAt('');
        setEmailCode('');
      }
      // Keep the verified proof in SecureStore; never ask the customer to confirm
      // a success pop-up or repeat a code. Move on once BOTH are verified.
      const otherContactVerified = channel === 'sms' ? emailVerified : phoneVerified;
      if (otherContactVerified) {
        setInlineNotice('Téléphone et e-mail confirmés ✓. Passons à votre adresse.');
        setStage('delivery');
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        });
      } else {
        setInlineNotice(channel === 'sms'
          ? 'Téléphone confirmé ✓. Vérifiez maintenant votre e-mail.'
          : 'E-mail confirmé ✓. Vérifiez maintenant votre téléphone.');
      }
    } catch (error: any) {
      if (Number(error?.status || 0) === 409) {
        if (channel === 'sms') {
          setPhoneSent(false);
          setPhoneCode('');
          setPhoneAttemptToken('');
          setPhoneClientRequestId('');
          setPhoneAttemptExpiresAt('');
          setPhoneAlternateAvailable(false);
          setPhoneProvider('');
        } else {
          setEmailSent(false);
          setEmailCode('');
          setEmailAttemptToken('');
          setEmailClientRequestId('');
          setEmailAttemptExpiresAt('');
        }
      }
      Alert.alert('Vérification impossible', error?.message || 'Réessayez.');
    } finally {
      proofFlightRef.current = false;
      setProofBusy(null);
    }
  }

  async function saveProfile(continueToCheckout = false) {
    const hasFoodSafetySignal = allergenFlags.length > 0 || dietaryTags.length > 0 || Boolean(clean(foodSafetyNote));
    if (hasFoodSafetySignal && !foodSafetyConfirmed) {
      Alert.alert(
        'Confirmation requise',
        'Relisez puis confirmez vos préférences et informations alimentaires avant de les transmettre au restaurant.',
      );
      return;
    }
    if (basics.length > 0) {
      Alert.alert('Informations à compléter', basics.join('\n'));
      return;
    }
    if (continueToCheckout && !ownershipReady) {
      Alert.alert('Preuve de possession requise', 'Validez le téléphone par SMS et l’email par code avant de commander.');
      return;
    }
    setChecking(true);
    try {
      if (continueToCheckout) {
        const [phoneAttestation, emailAttestation] = await Promise.all([
          daAttestIdentityProof({
            channel: 'sms',
            role: 'client',
            destination: daCanonicalContact('sms', phone),
            proofToken: phoneProof!.token,
          }),
          daAttestIdentityProof({
            channel: 'email',
            role: 'client',
            destination: daCanonicalContact('email', email),
            proofToken: emailProof!.token,
          }),
        ]);
        if (!phoneAttestation.valid || !emailAttestation.valid) {
          await persistActivationDraft({
            proofs: {
              phone: phoneAttestation.valid ? phoneProof! : undefined,
              email: emailAttestation.valid ? emailProof! : undefined,
            },
            trust: undefined,
          });
          if (!phoneAttestation.valid) setPhoneProof(null);
          if (!emailAttestation.valid) setEmailProof(null);
          Alert.alert(
            'Contact à revalider',
            `${!phoneAttestation.valid ? 'Le téléphone' : ''}${!phoneAttestation.valid && !emailAttestation.valid ? ' et ' : ''}${!emailAttestation.valid ? "L’email" : ''} doit être vérifié à nouveau avant le checkout.`,
          );
          return;
        }
      }
      const result = await daInspectProfileTrust({
        role: 'client',
        name: `${firstName} ${lastName}`,
        phone,
        email,
        address,
        city,
      });
      setTrust(result);
      if (!result.ok) {
        Alert.alert('Informations non validées', result.issues.map((item) => `• ${item.message}`).join('\n'));
        return;
      }
      const profile: ClientProfileLite = {
        id: profileId || existing?.id || `client-${Date.now()}`,
        firstName: clean(firstName),
        lastName: clean(lastName),
        phone: result.normalized.phone,
        email: result.normalized.email,
        address: addressTruth!.formattedAddress,
        city: deliveryTerritory!.city,
        instructions: clean(instructions),
        allergenFlags,
        dietaryTags,
        foodSafetyNote: clean(foodSafetyNote),
        foodSafetyConfirmedAt: hasFoodSafetySignal && foodSafetyConfirmed
          ? existing?.foodSafetyConfirmedAt || new Date().toISOString()
          : undefined,
        consent: true,
        giftDelivery,
        addressTruth: addressTruth!,
        territory: deliveryTerritory!,
        proofs: {
          phone: phoneVerified ? phoneProof! : undefined,
          email: emailVerified ? emailProof! : undefined,
        },
        trust: { status: 'screened', score: result.score, checkedAt: result.checkedAt, emailDomain: result.email.domain },
        updatedAt: new Date().toISOString(),
      };
      await saveClientProfile(profile);
      setProfileId(profile.id);
      setLastSavedAt(profile.updatedAt);
      if (continueToCheckout) {
        const session = await daSessionRehydrationStatus().catch(() => ({ ok: false }));
        if (session.ok === true) {
          router.push('/checkout-preflight' as any);
        } else {
          // The saved profile and cart stay intact. An unauthenticated Client
          // is directed to account activation, not a second payment attempt.
          router.push({ pathname: '/activate-account', params: { returnTo: 'checkout' } } as any);
        }
      }
      else {
        setEditing(false);
        setInlineNotice('Vos modifications sont enregistrées sur cet appareil.');
      }
    } catch (error: any) {
      Alert.alert('Contrôle indisponible', error?.message || 'Réessayez dans un instant.');
    } finally {
      setChecking(false);
    }
  }

  const truthCount = Number(addressVerified) + Number(phoneVerified) + Number(emailVerified);
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.title}>Mon espace</Text>
          <Text style={styles.subtitle}>
            {accountConnected ? 'Bonjour ! Votre compte est connecté.' : 'Tout pour commander, en deux petites étapes.'}
          </Text>

          <View style={[styles.truthCard, accountConnected && styles.truthCardReady]}>
            <Text style={styles.truthKicker}>
              {accountConnected ? 'COMPTE CONNECTÉ' : 'VOTRE PROGRESSION'}
            </Text>
            <Text style={[styles.truthTitle, accountConnected && styles.truthTitleReady]}>
              {auth.session.reason === 'initializing' && !accountConnected
                ? 'On retrouve votre compte…'
                : accountConnected
                  ? 'Bienvenue chez DelishAfrica ✓'
                  : truthCount === 3
                    ? 'Vos coordonnées sont vérifiées ✓'
                    : 'Encore un petit effort !'}
            </Text>
            <Text style={[styles.truthText, accountConnected && styles.truthTextReady]}>
              {accountConnected
                ? 'Votre compte est bien créé et connecté. Aucune nouvelle inscription.'
                : 'Adresse ' + (addressVerified ? '✓' : '·') + '  ·  Téléphone ' + (phoneVerified ? '✓' : '·') + '  ·  E-mail ' + (emailVerified ? '✓' : '·')}
            </Text>
          </View>
          {inlineNotice ? <Text style={styles.successNotice}>{inlineNotice}</Text> : null}
          {!hydrating && !editing ? (
            <View style={styles.secureAccountCard}>
              <Text style={styles.secureAccountKicker}>VOTRE ESPACE</Text>
              <Text style={styles.secureAccountTitle}>
                {accountConnected ? 'Tout est prêt, ' + (firstName || 'bienvenue') + ' !' : 'Vos informations sont conservées ✓'}
              </Text>
              <Text style={styles.secureAccountText}>
                {accountConnected
                  ? (addressVerified && ownershipReady
                      ? 'Votre adresse et vos contacts sont prêts. Vous pouvez commander.'
                      : 'Compte connecté. Complétez vos coordonnées pour commander avec ce compte.')
                  : enrollmentEnabled === false
                    ? 'Vos coordonnées sont enregistrées sur cet appareil. Votre compte n’est pas encore créé : l’inscription serveur est temporairement fermée.'
                    : 'Vos coordonnées sont enregistrées. Il ne reste qu’à créer votre compte.'}
              </Text>
              {addressVerified ? <Text style={styles.summaryLine}>⌖ {address}</Text> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (accountConnected) {
                    if (!addressVerified || !ownershipReady) {
                      setStage(!ownershipReady ? 'contacts' : 'delivery');
                      setEditing(true);
                    } else {
                      router.push((returnToCheckout ? '/checkout-preflight' : '/restaurants') as any);
                    }
                  } else if (truthCount === 3) {
                    router.push({ pathname: '/activate-account', params: { returnTo: returnToCheckout ? 'checkout' : 'space' } } as any);
                  } else {
                    setStage(!ownershipReady ? 'contacts' : 'delivery');
                    setEditing(true);
                  }
                }}
                style={styles.secureAccountButton}
              >
                <Text style={styles.secureAccountButtonText}>
                  {accountConnected
                    ? (addressVerified && ownershipReady ? (returnToCheckout ? 'Reprendre ma commande' : 'Choisir un restaurant') : 'Compléter mes informations')
                    : truthCount === 3
                      ? (enrollmentEnabled ? 'Créer mon compte' : 'Voir l’état de mon inscription')
                      : 'Compléter mes informations'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => { setStage('contacts'); setEditing(true); }}
                style={styles.simpleLinkButton}
              >
                <Text style={styles.simpleLinkText}>Modifier mes informations</Text>
              </Pressable>
              {!accountConnected ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/secure-session', params: { returnTo: returnToCheckout ? 'checkout' : 'space' } } as any)}
                  style={styles.simpleLinkButton}
                >
                  <Text style={styles.simpleLinkText}>J’ai déjà un compte · Me connecter</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!hydrating && editing ? (
            <>
              <Text style={styles.stepHeading}>
                {stage === 'contacts' ? 'ÉTAPE 1 SUR 2 · MES COORDONNÉES' : 'ÉTAPE 2 SUR 2 · MA LIVRAISON'}
              </Text>
              {stage === 'contacts' ? (
                <>
                    <View style={styles.card}>
            <Text style={styles.cardTitle}>Identité</Text>
            <Text style={styles.label}>Prénom *</Text>
            <TextInput value={firstName} onChangeText={(v) => { setFirstName(v); invalidateTrust(); }} placeholder="Votre prénom" placeholderTextColor="#6F7685" style={styles.input} textContentType="givenName" />
            <Text style={styles.label}>Nom</Text>
            <TextInput value={lastName} onChangeText={(v) => { setLastName(v); invalidateTrust(); }} placeholder="Votre nom" placeholderTextColor="#6F7685" style={styles.input} textContentType="familyName" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contacts vérifiés</Text>
            <Text style={styles.label}>Téléphone international *</Text>
            <TextInput value={phone} onChangeText={changePhone} placeholder="+32 4…" placeholderTextColor="#6F7685" style={styles.input} keyboardType="phone-pad" textContentType="telephoneNumber" />
            <View style={styles.proofRow}>
              <Pressable onPress={() => sendProof('sms')} disabled={proofBusy !== null || phoneVerified} style={[styles.miniButton, phoneVerified && styles.miniButtonReady]}>
                {proofBusy === 'sms' ? <ActivityIndicator color="#07130E" /> : <Text style={styles.miniButtonText}>{phoneVerified ? 'SMS confirmé' : phoneSent ? 'Renvoyer le code' : 'Envoyer le code'}</Text>}
              </Pressable>
              {phoneSent && !phoneVerified ? <TextInput value={phoneCode} onChangeText={setPhoneCode} placeholder="Code SMS" placeholderTextColor="#6F7685" style={styles.codeInput} keyboardType="number-pad" maxLength={10} returnKeyType="done" onSubmitEditing={() => verifyProof('sms')} editable={proofBusy === null} /> : null}
              {phoneSent && !phoneVerified ? <Pressable onPress={() => verifyProof('sms')} disabled={proofBusy !== null} style={styles.checkButton}><Text style={styles.checkButtonText}>Valider</Text></Pressable> : null}
              {phoneSent && !phoneVerified && phoneAlternateAvailable ? (
                <Pressable onPress={() => sendProof('sms', 'alternate')} disabled={proofBusy !== null} style={styles.alternateButton}>
                  <Text style={styles.alternateButtonText}>Je n’ai rien reçu · route de secours</Text>
                </Pressable>
              ) : null}
            </View>
            {phoneProvider ? <Text style={styles.providerHint}>Route sécurisée : {phoneProvider}</Text> : null}
              {phoneSent && !phoneVerified ? <Text style={styles.providerHint}>Utilisez uniquement le code le plus récent.</Text> : null}

            <Text style={styles.label}>Email *</Text>
            <TextInput value={email} onChangeText={changeEmail} placeholder="vous@fournisseur.com" placeholderTextColor="#6F7685" style={styles.input} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoCapitalize="none" autoCorrect={false} />
            <View style={styles.proofRow}>
              <Pressable onPress={() => sendProof('email')} disabled={proofBusy !== null || emailVerified} style={[styles.miniButton, emailVerified && styles.miniButtonReady]}>
                {proofBusy === 'email' ? <ActivityIndicator color="#07130E" /> : <Text style={styles.miniButtonText}>{emailVerified ? 'Email confirmé' : emailSent ? 'Renvoyer le code' : 'Envoyer le code'}</Text>}
              </Pressable>
              {emailSent && !emailVerified ? <TextInput value={emailCode} onChangeText={setEmailCode} placeholder="Code email" placeholderTextColor="#6F7685" style={styles.codeInput} keyboardType="number-pad" maxLength={10} returnKeyType="done" onSubmitEditing={() => verifyProof('email')} editable={proofBusy === null} /> : null}
              {emailSent && !emailVerified ? <Pressable onPress={() => verifyProof('email')} disabled={proofBusy !== null} style={styles.checkButton}><Text style={styles.checkButtonText}>Valider</Text></Pressable> : null}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={proofBusy !== null}
            onPress={() => {
              if (!clean(firstName) || !clean(email) || !clean(phone)) {
                Alert.alert('Encore une petite chose', 'Ajoutez votre prénom, votre téléphone et votre e-mail.');
                return;
              }
              if (!ownershipReady) {
                Alert.alert('Confirmez vos contacts', 'Entrez les codes reçus par SMS et e-mail. Cette étape n’est à faire qu’une fois.');
                return;
              }
              void persistActivationDraft().then(() => setStage('delivery')).catch(() =>
                Alert.alert('Enregistrement impossible', 'Réessayez dans un instant.'));
            }}
            style={[styles.primaryButton, proofBusy !== null && styles.disabled]}
          >
            <Text style={styles.primaryText}>Continuer · Mon adresse →</Text>
          </Pressable>
                </>
              ) : (
                <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mon adresse de livraison</Text>
            <Pressable onPress={detectTerritory} disabled={locationBusy} style={styles.locationButton}>
              {locationBusy ? <ActivityIndicator color="#FFF8EA" /> : <Text style={styles.locationButtonText}>{deviceTerritory?.detected ? `${deviceTerritory.territory.city} · ${deviceTerritory.territory.country}` : 'Détecter mon territoire'}</Text>}
            </Pressable>
            {territoryTruth ? (
              <Text style={styles.fieldHint}>
                {territoryTruth.ok
                  ? `Position confirmée · ${territoryTruth.message}${territoryTruth.accuracyMeters ? ` · ±${Math.round(territoryTruth.accuracyMeters)} m` : ''}`
                  : `Diagnostic ${territoryTruth.code} · ${territoryTruth.message}${territoryTruth.locality ? ` · position lue près de ${territoryTruth.locality}` : ''}`}
              </Text>
            ) : null}
            <View style={styles.giftRow}>
              <View style={styles.giftCopy}><Text style={styles.giftTitle}>Livrer quelqu’un d’autre</Text><Text style={styles.giftText}>Ouvre la recherche mondiale sans supprimer la vérification d’adresse.</Text></View>
              <Switch value={giftDelivery} onValueChange={(value) => { setGiftDelivery(value); changeAddress(''); }} />
            </View>
            <Text style={styles.label}>Adresse *</Text>
            <TextInput value={address} onChangeText={changeAddress} placeholder="Commencez à saisir puis choisissez…" placeholderTextColor="#6F7685" style={styles.input} textContentType="fullStreetAddress" />
            {addressBusy ? <ActivityIndicator style={styles.addressSpinner} color="#E7B85F" /> : null}
            {addressError ? (
              <View style={styles.addressNotice}>
                <Text style={styles.addressNoticeText}>{addressError}</Text>
                {addressProviderBlocked ? (
                  <Pressable onPress={retryAddressProvider} disabled={addressBusy} style={[styles.addressRetry, addressBusy && styles.disabled]} accessibilityRole="button" accessibilityLabel="Relancer la vérification d’adresse">
                    <Text style={styles.addressRetryText}>Réessayer</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {suggestions.map((item) => (
              <Pressable key={item.placeId} onPress={() => chooseAddress(item)} style={styles.suggestion}>
                <Text style={styles.suggestionPrimary}>{item.primaryText}</Text>
                <Text style={styles.suggestionSecondary}>{item.secondaryText}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Ville résolue</Text>
            <TextInput value={city} editable={false} placeholder="Choisissez une adresse confirmée" placeholderTextColor="#6F7685" style={[styles.input, styles.inputLocked]} />
            {addressVerified ? <Text style={styles.confirmedLine}>✓ {addressTruth?.precision} · {deliveryTerritory?.countryCode} · coordonnées confirmées</Text> : <Text style={styles.fieldHint}>Aucune saisie libre ne peut déclencher une commande.</Text>}
            <Text style={styles.label}>Instructions livreur</Text>
            <TextInput value={instructions} onChangeText={setInstructions} placeholder="Étage, sonnette, repère utile…" placeholderTextColor="#6F7685" style={[styles.input, styles.multiline]} multiline />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPreferences((current) => !current)}
            style={styles.preferencesToggle}
          >
            <Text style={styles.preferencesToggleText}>
              {showPreferences ? 'Masquer les préférences' : 'Allergies et préférences · Facultatif +'}
            </Text>
          </Pressable>
          {showPreferences ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allergies et préférences</Text>
            <Text style={styles.foodSafetyIntro}>
              Ces informations seront jointes à la commande et visibles dans la fiche cuisine du restaurant.
            </Text>

            <Text style={styles.label}>Allergènes à signaler</Text>
            <View style={styles.chipGrid}>
              {ALLERGEN_OPTIONS.map((option) => {
                const selected = allergenFlags.includes(option);
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      setAllergenFlags((current) => toggleListValue(current, option));
                      setFoodSafetyConfirmed(false);
                    }}
                    style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                  >
                    <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Préférences alimentaires</Text>
            <View style={styles.chipGrid}>
              {DIETARY_OPTIONS.map((option) => {
                const selected = dietaryTags.includes(option);
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      setDietaryTags((current) => toggleListValue(current, option));
                      setFoodSafetyConfirmed(false);
                    }}
                    style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                  >
                    <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Message pour la cuisine</Text>
            <TextInput
              value={foodSafetyNote}
              onChangeText={(value) => { setFoodSafetyNote(value); setFoodSafetyConfirmed(false); }}
              placeholder="Ex. allergie sévère, éviter la contamination croisée, préférence de cuisson…"
              placeholderTextColor="#6F7685"
              style={[styles.input, styles.multiline]}
              multiline
            />

            {allergenFlags.length > 0 ? (
              <View style={styles.safetyWarning}>
                <Text style={styles.safetyWarningTitle}>Signal cuisine prioritaire</Text>
                <Text style={styles.safetyWarningText}>
                  Le restaurant verra ce signal avant la préparation. En cas d’allergie sévère, contactez aussi directement l’établissement.
                </Text>
              </View>
            ) : null}

            <View style={styles.foodConfirmRow}>
              <View style={styles.foodConfirmCopy}>
                <Text style={styles.foodConfirmTitle}>Informations relues et exactes</Text>
                <Text style={styles.foodConfirmText}>Toute modification désactive cette confirmation jusqu’à une nouvelle relecture.</Text>
              </View>
              <Switch
                value={foodSafetyConfirmed}
                onValueChange={setFoodSafetyConfirmed}
                disabled={allergenFlags.length === 0 && dietaryTags.length === 0 && !clean(foodSafetyNote)}
              />
            </View>
          </View>

          ) : null}

          <View style={styles.consentCard}>
            <View style={styles.consentCopy}><Text style={styles.consentTitle}>Utilisation des données *</Text><Text style={styles.consentText}>Uniquement pour sécuriser, préparer, livrer et suivre la commande.</Text></View>
            <Switch value={consent} onValueChange={(v) => { setConsent(v); invalidateTrust(); }} />
          </View>

          <Pressable
            disabled={checking}
            accessibilityRole="button"
            onPress={() => { void saveProfile(returnToCheckout || !accountConnected); }}
            style={[styles.primaryButton, checking && styles.disabled]}
          >
            {checking
              ? <ActivityIndicator color="#07130E" />
              : <Text style={styles.primaryText}>
                  {returnToCheckout ? 'Reprendre ma commande' : accountConnected ? 'Enregistrer et terminer' : 'Continuer vers mon compte'}
                </Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setStage('contacts')}
            style={styles.simpleLinkButton}
          >
            <Text style={styles.simpleLinkText}>← Revoir mes coordonnées</Text>
          </Pressable>
                </>
              )}
            </>
          ) : null}
          <Pressable onPress={() => router.replace('/' as any)} style={styles.backButton}>
            <Text style={styles.backText}>Retour aux restaurants</Text>
          </Pressable>
          <DaLegalLink href={"/legal" as any} style={styles.legalLink}>
            Confidentialité · Conditions · Assistance
          </DaLegalLink>
          {trust?.issues?.length && editing ? <Text style={styles.note}>{trust.issues[0].message}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stepHeading: { color: '#E7B85F', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 15, marginTop: 8 },
  simpleLinkButton: { paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  simpleLinkText: { color: '#F3D59A', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  summaryLine: { marginTop: 14, color: '#C8D8CB', fontSize: 14, lineHeight: 22 },
  successNotice: { backgroundColor: '#173E29', borderRadius: 14, marginBottom: 12, padding: 12, color: '#B8F0CC', fontWeight: '800' },
  preferencesToggle: { minHeight: 50, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: '#123E2E', justifyContent: 'center' },
  preferencesToggleText: { color: '#F4D69B', fontSize: 15, fontWeight: '900' },
  legalLink: { color: '#D7C1A1', alignSelf: 'center', padding: 12, marginTop: 5, fontSize: 12, fontWeight: '700' },
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#04150E' }, page: { padding: 22, paddingBottom: 72 },
  brand: { color: '#E7B85F', fontSize: 18, fontWeight: '900', letterSpacing: 6, marginTop: 8 }, title: { color: '#FFF8EA', fontSize: 42, lineHeight: 48, fontWeight: '900', marginTop: 14 }, subtitle: { color: '#9BA79F', fontSize: 17, lineHeight: 25, marginTop: 10, marginBottom: 20 },
  truthCard: { padding: 18, borderRadius: 24, backgroundColor: '#0A2418', borderWidth: 1, borderColor: 'rgba(231,184,95,0.28)', marginBottom: 10 },
  secureAccountCard: { marginBottom: 16, padding: 18, borderRadius: 24, backgroundColor: '#102D20', borderWidth: 1, borderColor: 'rgba(231,184,95,0.28)' },
  secureAccountCopy: { gap: 5 },
  secureAccountKicker: { color: '#E7B85F', fontSize: 11, fontWeight: '900', letterSpacing: 2.5 },
  secureAccountTitle: { color: '#FFF8EA', fontSize: 22, fontWeight: '900' },
  secureAccountText: { color: '#A5B1AA', fontSize: 13, lineHeight: 20 },
  secureAccountButton: { marginTop: 14, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7B85F' },
  secureAccountButtonText: { color: '#07130E', fontSize: 14, fontWeight: '900' },
 truthCardReady: { backgroundColor: '#EAF8EF', borderColor: '#9BD8B0' }, truthKicker: { color: '#C38D35', fontSize: 11, fontWeight: '900', letterSpacing: 3 }, truthTitle: { color: '#FFF8EA', fontSize: 21, fontWeight: '900', marginTop: 5 }, truthTitleReady: { color: '#0A2418' }, truthText: { color: '#A5B1AA', fontSize: 14, lineHeight: 21, marginTop: 5 }, truthTextReady: { color: '#3C5C49' }, continuityHint: { color: '#91A39A', fontSize: 12, lineHeight: 18, marginBottom: 16, textAlign: 'center' },
  card: { padding: 18, borderRadius: 26, backgroundColor: '#0A2418', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 }, cardTitle: { color: '#FFF8EA', fontSize: 24, fontWeight: '900', marginBottom: 8 }, label: { color: '#E7B85F', fontSize: 12, fontWeight: '900', letterSpacing: 2.2, textTransform: 'uppercase', marginTop: 12, marginBottom: 7 },
  input: { minHeight: 56, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#03110B', borderWidth: 1, borderColor: 'rgba(231,184,95,0.22)', color: '#FFF8EA', fontSize: 17, fontWeight: '700' }, inputLocked: { opacity: 0.72 }, multiline: { minHeight: 88, textAlignVertical: 'top' }, fieldHint: { color: '#7F9187', fontSize: 12, lineHeight: 18, marginTop: 7 }, confirmedLine: { color: '#9CF7B8', fontSize: 12, fontWeight: '800', marginTop: 8 }, addressNotice: { padding: 13, borderRadius: 14, backgroundColor: '#102D20', borderWidth: 1, borderColor: 'rgba(231,184,95,0.24)', marginTop: 8 }, addressNoticeText: { color: '#D5DDD8', fontSize: 12, lineHeight: 18, fontWeight: '700' }, addressRetry: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#E7B85F', marginTop: 9 }, addressRetryText: { color: '#07130E', fontSize: 12, fontWeight: '900' },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }, miniButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7B85F' }, miniButtonReady: { backgroundColor: '#9CF7B8' }, miniButtonText: { color: '#07130E', fontWeight: '900' }, codeInput: { minHeight: 44, minWidth: 110, flex: 1, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#03110B', borderWidth: 1, borderColor: 'rgba(231,184,95,0.22)', color: '#FFF8EA', fontWeight: '800' }, checkButton: { minHeight: 44, paddingHorizontal: 13, borderRadius: 14, justifyContent: 'center', backgroundColor: '#163B2A' }, checkButtonText: { color: '#FFF8EA', fontWeight: '900' }, alternateButton: { width: '100%', minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#102D20', borderWidth: 1, borderColor: 'rgba(231,184,95,0.18)' }, alternateButtonText: { color: '#D9C28B', fontSize: 12, fontWeight: '900' }, providerHint: { color: '#7F9187', fontSize: 11, marginTop: 7 },
  locationButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#163B2A', marginTop: 6 }, locationButtonText: { color: '#FFF8EA', fontWeight: '900' }, giftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }, giftCopy: { flex: 1 }, giftTitle: { color: '#FFF8EA', fontSize: 16, fontWeight: '900' }, giftText: { color: '#83958B', fontSize: 12, lineHeight: 18, marginTop: 3 }, addressSpinner: { marginVertical: 8 }, suggestion: { padding: 13, borderRadius: 14, backgroundColor: '#102D20', marginTop: 7 }, suggestionPrimary: { color: '#FFF8EA', fontSize: 15, fontWeight: '900' }, suggestionSecondary: { color: '#8FA198', fontSize: 12, lineHeight: 17, marginTop: 3 },
  foodSafetyIntro: { color: '#91A39A', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  choiceChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#03110B', borderWidth: 1, borderColor: 'rgba(231,184,95,0.20)' },
  choiceChipSelected: { backgroundColor: '#E7B85F', borderColor: '#E7B85F' },
  choiceChipText: { color: '#D4DED8', fontSize: 12, fontWeight: '800' },
  choiceChipTextSelected: { color: '#07130E', fontWeight: '900' },
  safetyWarning: { borderRadius: 18, padding: 15, backgroundColor: '#3A1C12', borderWidth: 1, borderColor: 'rgba(255,170,112,0.36)', marginTop: 14 },
  safetyWarningTitle: { color: '#FFD0A8', fontSize: 14, fontWeight: '900' },
  safetyWarningText: { color: '#E8C3A5', fontSize: 12, lineHeight: 19, marginTop: 5 },
  foodConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  foodConfirmCopy: { flex: 1 },
  foodConfirmTitle: { color: '#FFF8EA', fontSize: 15, fontWeight: '900' },
  foodConfirmText: { color: '#91A39A', fontSize: 12, lineHeight: 18, marginTop: 4 },
  consentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 22, backgroundColor: '#102D20', marginBottom: 16 }, consentCopy: { flex: 1 }, consentTitle: { color: '#FFF8EA', fontSize: 17, fontWeight: '900' }, consentText: { color: '#91A39A', fontSize: 13, lineHeight: 19, marginTop: 4 }, primaryButton: { minHeight: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7B85F', marginTop: 2 }, primaryText: { color: '#07130E', fontSize: 17, fontWeight: '900' }, secondaryButton: { minHeight: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#163B2A', marginTop: 12 }, secondaryText: { color: '#FFF8EA', fontSize: 16, fontWeight: '900' }, disabled: { opacity: 0.45 }, backButton: { alignItems: 'center', padding: 16 }, backText: { color: '#8FA198', fontSize: 14, fontWeight: '800' }, note: { color: '#74877D', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 4 },
});
