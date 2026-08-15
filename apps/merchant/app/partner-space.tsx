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
import { router } from 'expo-router';
import { daInspectProfileTrust, DaProfileTrustResult } from '../utils/daProfileTrust';
import { loadPartnerPresence, readPartnerPresenceCache, savePartnerPresence } from '../utils/daPresenceStore';
import {
  DaAddressSuggestion,
  DaIdentityChannel,
  DaIdentityProof,
  DaResolvedAddress,
  DaTerritoryContext,
  daAutocompleteAddress,
  daCheckIdentityProof,
  daDescribeLocationError,
  daNewIdentityRequestId,
  daResolveAddress,
  daResolveTerritory,
  daStartIdentityProof,
} from '../utils/daTrustNetwork';


import { Link as DaLegalLink } from "expo-router";
type PartnerProfileLite = {
  id: string;
  restaurantName: string;
  managerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  specialty: string;
  prepTime: string;
  pickupInstructions: string;
  serviceOpen: boolean;
  addressTruth?: DaResolvedAddress['address'];
  territory?: DaResolvedAddress['territory'];
  proofs?: { phone?: DaIdentityProof; email?: DaIdentityProof };
  trust?: { status: 'screened'; score: number; checkedAt: string; emailDomain: string };
  updatedAt: string;
};

const clean = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();
const sessionToken = () => `merchant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

// DA_SPRINT16_PRESENCE_CONTINUITY_V1
export default function PartnerSpaceScreen() {
  const existing = readPartnerPresenceCache<PartnerProfileLite>();
  const [restaurantName, setRestaurantName] = useState(existing?.restaurantName || '');
  const [managerName, setManagerName] = useState(existing?.managerName || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [address, setAddress] = useState(existing?.address || '');
  const [city, setCity] = useState(existing?.city || '');
  const [specialty, setSpecialty] = useState(existing?.specialty || '');
  const [prepTime, setPrepTime] = useState(existing?.prepTime || '');
  const [pickupInstructions, setPickupInstructions] = useState(existing?.pickupInstructions || '');
  const [serviceOpen, setServiceOpen] = useState(existing?.serviceOpen ?? false);
  const [addressTruth, setAddressTruth] = useState<DaResolvedAddress['address'] | null>(existing?.addressTruth || null);
  const [territory, setTerritory] = useState<DaResolvedAddress['territory'] | null>(existing?.territory || null);
  const [deviceTerritory, setDeviceTerritory] = useState<DaTerritoryContext | null>(null);
  const [suggestions, setSuggestions] = useState<DaAddressSuggestion[]>([]);
  const [addressSession, setAddressSession] = useState(sessionToken());
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressProviderBlocked, setAddressProviderBlocked] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [phoneProof, setPhoneProof] = useState<DaIdentityProof | null>(existing?.proofs?.phone || null);
  const [emailProof, setEmailProof] = useState<DaIdentityProof | null>(existing?.proofs?.email || null);
  const [proofBusy, setProofBusy] = useState<DaIdentityChannel | null>(null);
  const proofFlightRef = useRef(false);
  const [phoneClientRequestId, setPhoneClientRequestId] = useState('');
  const [emailClientRequestId, setEmailClientRequestId] = useState('');
  const [phoneAttemptExpiresAt, setPhoneAttemptExpiresAt] = useState('');
  const [emailAttemptExpiresAt, setEmailAttemptExpiresAt] = useState('');
  const [phoneAttemptToken, setPhoneAttemptToken] = useState('');
  const [emailAttemptToken, setEmailAttemptToken] = useState('');
  const [phoneAlternateAvailable, setPhoneAlternateAvailable] = useState(false);
  const [phoneProvider, setPhoneProvider] = useState('');
  const [trust, setTrust] = useState<DaProfileTrustResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [profileId, setProfileId] = useState(existing?.id || '');

  const proofFresh = (proof: DaIdentityProof | null, destination: string) =>
    Boolean(proof && proof.destination === destination && Date.parse(proof.expiresAt) > Date.now());
  const phoneVerified = proofFresh(phoneProof, clean(phone));
  const emailVerified = proofFresh(emailProof, clean(email).toLowerCase());
  const addressVerified = Boolean(addressTruth?.deliverable && addressTruth.formattedAddress === clean(address));
  const activationReady = phoneVerified && emailVerified && addressVerified;


async function persistActivationDraft(patch: Partial<PartnerProfileLite> = {}) {
  const current = await loadPartnerPresence<PartnerProfileLite>();
  const draft: PartnerProfileLite = {
    id: profileId || current?.id || `da_partner_draft_${Date.now().toString(36)}`,
    restaurantName: clean(restaurantName),
    managerName: clean(managerName),
    phone: clean(phone),
    email: clean(email).toLowerCase(),
    address: clean(address),
    city: clean(city),
    specialty: clean(specialty),
    prepTime: clean(prepTime),
    pickupInstructions: clean(pickupInstructions),
    serviceOpen: false,
    addressTruth: addressTruth || undefined,
    territory: territory || undefined,
    proofs: {
      phone: phoneProof || undefined,
      email: emailProof || undefined,
    },
    trust: current?.trust,
    updatedAt: new Date().toISOString(),
    ...patch,
  };
  await savePartnerPresence(draft);
  setProfileId(draft.id);
  return draft;
}

  useEffect(() => {
    let active = true;
    void loadPartnerPresence<PartnerProfileLite>().then((profile) => {
      if (!active || !profile) return;
      setProfileId(profile.id || '');
      setRestaurantName(profile.restaurantName || '');
      setManagerName(profile.managerName || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
      setAddress(profile.address || '');
      setCity(profile.city || '');
      setSpecialty(profile.specialty || '');
      setPrepTime(profile.prepTime || '');
      setPickupInstructions(profile.pickupInstructions || '');
      setServiceOpen(Boolean(profile.serviceOpen));
      setAddressTruth(profile.addressTruth || null);
      setTerritory(profile.territory || null);
      setPhoneProof(profile.proofs?.phone || null);
      setEmailProof(profile.proofs?.email || null);
    });
    return () => { active = false; };
  }, []);

  const basics = useMemo(() => {
    const items: string[] = [];
    if (!clean(restaurantName)) items.push('Nom de l’établissement requis.');
    if (!clean(managerName)) items.push('Responsable requis.');
    if (!clean(phone)) items.push('Téléphone requis.');
    if (!clean(email)) items.push('Email requis.');
    if (!addressVerified) items.push('Adresse réelle à sélectionner.');
    if (!clean(city)) items.push('Ville non résolue.');
    if (!clean(prepTime)) items.push('Temps de préparation requis.');
    return items;
  }, [addressVerified, city, email, managerName, phone, prepTime, restaurantName]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const context = await daResolveTerritory(current.coords.latitude, current.coords.longitude);
        if (active) setDeviceTerritory(context);
      } catch {
        // Le formulaire reste utilisable sans position automatique.
      }
    })();
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
        const result = await daAutocompleteAddress({
          text: query,
          sessionToken: addressSession,
          latitude: deviceTerritory?.coordinates.latitude,
          longitude: deviceTerritory?.coordinates.longitude,
          countryCodes: deviceTerritory?.territory.countryCode ? [deviceTerritory.territory.countryCode] : [],
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
  }, [address, addressProviderBlocked, addressVerified, deviceTerritory]);

  const invalidate = () => setTrust(null);
  const changePhone = (value: string) => {
    setPhone(value);
    setPhoneProof(null);
    setPhoneSent(false);
    setPhoneCode('');
    setPhoneAttemptToken('');
    setPhoneClientRequestId('');
    setPhoneAttemptExpiresAt('');
    setPhoneAlternateAvailable(false);
    setPhoneProvider('');
    invalidate();
  };
  const changeEmail = (value: string) => {
    setEmail(value);
    setEmailProof(null);
    setEmailSent(false);
    setEmailCode('');
    setEmailAttemptToken('');
    setEmailClientRequestId('');
    setEmailAttemptExpiresAt('');
    invalidate();
  };
  const changeAddress = (value: string) => {
    setAddress(value); setAddressTruth(null); setTerritory(null); setCity(''); setServiceOpen(false); setSuggestions([]); if (!addressProviderBlocked) setAddressError(null); invalidate();
  };

  function retryAddressProvider() {
    setAddressProviderBlocked(false);
    setAddressError(null);
    setAddressSession(sessionToken());
  }

  async function detectTerritory() {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Position non autorisée', 'Saisissez puis sélectionnez l’adresse de l’établissement.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const context = await daResolveTerritory(current.coords.latitude, current.coords.longitude);
      setDeviceTerritory(context);
      Alert.alert('Zone détectée', `${context.territory.city} · ${context.territory.country}`);
    } catch (error: any) {
      Alert.alert('Zone indisponible', error?.message || 'Réessayez dans un instant.');
    } finally {
      setLocationBusy(false);
    }
  }

  async function chooseAddress(item: DaAddressSuggestion) {
    setAddressBusy(true);
    try {
      const result = await daResolveAddress(item.placeId, addressSession);
      if (!result.address.deliverable) {
        Alert.alert('Adresse insuffisamment précise', result.message);
        return;
      }
      await persistActivationDraft({
        address: result.address.formattedAddress,
        addressTruth: result.address,
        territory: result.territory,
        city: result.territory.city,
        serviceOpen: false,
        trust: undefined,
      });
      setAddress(result.address.formattedAddress);
      setAddressTruth(result.address);
      setTerritory(result.territory);
      setCity(result.territory.city);
      setSuggestions([]);
      setAddressError(null);
      setAddressProviderBlocked(false);
      setAddressSession(sessionToken());
      invalidate();
    } catch (error: any) {
      Alert.alert('Adresse non confirmée', error?.message || 'Choisissez une autre proposition.');
    } finally {
      setAddressBusy(false);
    }
  }

  async function sendProof(channel: DaIdentityChannel, route: 'auto' | 'alternate' = 'auto') {
    if (proofFlightRef.current) return;
    const destination = channel === 'sms' ? clean(phone) : clean(email).toLowerCase();
    if (!destination) {
      Alert.alert('Coordonnée manquante', channel === 'sms' ? 'Ajoutez votre téléphone.' : 'Ajoutez votre email.');
      return;
    }
    const alreadySent = channel === 'sms' ? phoneSent : emailSent;
    const explicitResend = route === 'alternate' || alreadySent;
    const currentRequestId = channel === 'sms' ? phoneClientRequestId : emailClientRequestId;
    const requestId = explicitResend || !currentRequestId
      ? daNewIdentityRequestId('merchant-' + channel)
      : currentRequestId;
    if (channel === 'sms') setPhoneClientRequestId(requestId); else setEmailClientRequestId(requestId);

    proofFlightRef.current = true;
    setProofBusy(channel);
    try {
      const result = await daStartIdentityProof({
        channel,
        role: 'merchant',
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
      Alert.alert(
        result.reused ? 'Code déjà envoyé' : route === 'alternate' ? 'Route de secours activée' : 'Code envoyé',
        `${result.notice || 'Un code a été envoyé.'}
${result.maskedDestination}
Utilisez uniquement le code le plus récent.`,
      );
    } catch (error: any) {
      Alert.alert('Envoi indisponible', error?.message || 'Le fournisseur de vérification est indisponible.');
    } finally {
      proofFlightRef.current = false;
      setProofBusy(null);
    }
  }

  async function verifyProof(channel: DaIdentityChannel) {
    if (proofFlightRef.current) return;
    const destination = channel === 'sms' ? clean(phone) : clean(email).toLowerCase();
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
      const result = await daCheckIdentityProof({ channel, role: 'merchant', destination, code, attemptToken });
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
      await persistActivationDraft({
        phone: channel === 'sms' ? destination : clean(phone),
        email: channel === 'email' ? destination : clean(email).toLowerCase(),
        serviceOpen: false,
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
      Alert.alert('Contact confirmé', `${channel === 'sms' ? 'Téléphone vérifié.' : 'Email vérifié.'} La preuve est mémorisée sur cet appareil.`);
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

  function toggleService(value: boolean) {
    if (value && !activationReady) {
      Alert.alert('Activation verrouillée', 'Confirmez l’adresse, le téléphone et l’email avant de passer en ligne.');
      return;
    }
    setServiceOpen(value);
  }

  async function save() {
    if (basics.length) {
      Alert.alert('Espace à compléter', basics.join('\n'));
      return;
    }
    if (serviceOpen && !activationReady) {
      Alert.alert('Activation verrouillée', 'Les trois preuves sont obligatoires pour ouvrir le service.');
      return;
    }
    setChecking(true);
    try {
      const result = await daInspectProfileTrust({ role: 'merchant', name: `${managerName} · ${restaurantName}`, phone, email, address, city });
      setTrust(result);
      if (!result.ok) {
        Alert.alert('Informations non validées', result.issues.map((item) => `• ${item.message}`).join('\n'));
        return;
      }
      const profile: PartnerProfileLite = {
        id: profileId || `da_partner_${Date.now().toString(36)}`,
        restaurantName: clean(restaurantName), managerName: clean(managerName),
        phone: result.normalized.phone, email: result.normalized.email,
        address: addressTruth!.formattedAddress, city: territory!.city,
        specialty: clean(specialty), prepTime: clean(prepTime), pickupInstructions: clean(pickupInstructions),
        serviceOpen: activationReady ? serviceOpen : false,
        addressTruth: addressTruth!, territory: territory!,
        proofs: { phone: phoneVerified ? phoneProof! : undefined, email: emailVerified ? emailProof! : undefined },
        trust: { status: 'screened', score: result.score, checkedAt: result.checkedAt, emailDomain: result.email.domain },
        updatedAt: new Date().toISOString(),
      };
      await savePartnerPresence(profile);
      setProfileId(profile.id);
      Alert.alert('Établissement enregistré', activationReady ? 'Identité et adresse confirmées.' : 'Le service restera hors ligne jusqu’aux trois preuves.', [{ text: 'Retour au service', onPress: () => router.replace('/') }]);
    } catch (error: any) {
      Alert.alert('Contrôle indisponible', error?.message || 'Réessayez dans un instant.');
    } finally {
      setChecking(false);
    }
  }

  const truthCount = Number(addressVerified) + Number(phoneVerified) + Number(emailVerified);
  return (
    <SafeAreaView style={styles.safe}>
      {/* DA_J7B_LEGAL_LINK */}
      <DaLegalLink
        href={"/legal" as any}
        style={{ alignSelf: "flex-start", marginBottom: 16, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, overflow: "hidden", backgroundColor: "#FFF4E8", color: "#7A421D", fontWeight: "800" }}
      >
        Confidentialité · Conditions · Assistance
      </DaLegalLink>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>DELISHAFRICA® · MERCHANT</Text>
          <Text style={styles.title}>Mon établissement</Text>
          <Text style={styles.subtitle}>Enregistrer une fois. Prouver. Passer en ligne d’un geste.</Text>

          <View style={[styles.truthCard, truthCount === 3 && styles.truthReady]}>
            <Text style={styles.truthKicker}>ACTIVATION RÉELLE</Text>
            <Text style={[styles.truthTitle, truthCount === 3 && styles.truthTitleReady]}>{truthCount}/3 preuves</Text>
            <Text style={[styles.truthText, truthCount === 3 && styles.truthTextReady]}>Adresse {addressVerified ? '✓' : '·'} · SMS {phoneVerified ? '✓' : '·'} · Email {emailVerified ? '✓' : '·'}</Text>
          </View>
          <Text style={styles.continuityHint}>Les étapes confirmées sont sauvegardées dans le stockage sécurisé de cet appareil.</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Identité</Text>
            <Text style={styles.label}>Établissement *</Text><TextInput value={restaurantName} onChangeText={(v) => { setRestaurantName(v); invalidate(); }} placeholder="Nom public" placeholderTextColor="#91796B" style={styles.input} />
            <Text style={styles.label}>Responsable *</Text><TextInput value={managerName} onChangeText={(v) => { setManagerName(v); invalidate(); }} placeholder="Nom du responsable" placeholderTextColor="#91796B" style={styles.input} />
            <Text style={styles.label}>Téléphone international *</Text><TextInput value={phone} onChangeText={changePhone} placeholder="+32…" placeholderTextColor="#91796B" style={styles.input} keyboardType="phone-pad" />
            <View style={styles.proofRow}>
              <Pressable onPress={() => sendProof('sms')} disabled={proofBusy !== null || phoneVerified} style={[styles.miniButton, phoneVerified && styles.miniButtonReady]}>
                {proofBusy === 'sms' ? <ActivityIndicator color="#220D05" /> : <Text style={styles.miniButtonText}>{phoneVerified ? 'SMS confirmé' : phoneSent ? 'Renvoyer le code' : 'Envoyer le code'}</Text>}
              </Pressable>
              {phoneSent && !phoneVerified ? <TextInput value={phoneCode} onChangeText={setPhoneCode} placeholder="Code" placeholderTextColor="#91796B" style={styles.codeInput} keyboardType="number-pad" maxLength={10} returnKeyType="done" onSubmitEditing={() => verifyProof('sms')} editable={proofBusy === null} /> : null}
              {phoneSent && !phoneVerified ? <Pressable onPress={() => verifyProof('sms')} disabled={proofBusy !== null} style={styles.checkButton}><Text style={styles.checkText}>Valider</Text></Pressable> : null}
              {phoneSent && !phoneVerified && phoneAlternateAvailable ? (
                <Pressable onPress={() => sendProof('sms', 'alternate')} disabled={proofBusy !== null} style={styles.alternateButton}>
                  <Text style={styles.alternateButtonText}>Je n’ai rien reçu · route de secours</Text>
                </Pressable>
              ) : null}
              {phoneSent && !phoneVerified && phoneProvider ? <Text style={styles.providerHint}>Route sécurisée : {phoneProvider}</Text> : null}
              {phoneSent && !phoneVerified ? <Text style={styles.providerHint}>Utilisez uniquement le code le plus récent.</Text> : null}
            </View>
            <Text style={styles.label}>Email professionnel *</Text><TextInput value={email} onChangeText={changeEmail} placeholder="contact@restaurant.com" placeholderTextColor="#91796B" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <View style={styles.proofRow}><Pressable onPress={() => sendProof('email')} disabled={proofBusy !== null || emailVerified} style={[styles.miniButton, emailVerified && styles.miniButtonReady]}>{proofBusy === 'email' ? <ActivityIndicator color="#220D05" /> : <Text style={styles.miniButtonText}>{emailVerified ? 'Email confirmé' : emailSent ? 'Renvoyer le code' : 'Envoyer le code'}</Text>}</Pressable>{emailSent && !emailVerified ? <TextInput value={emailCode} onChangeText={setEmailCode} placeholder="Code" placeholderTextColor="#91796B" style={styles.codeInput} keyboardType="number-pad" maxLength={10} returnKeyType="done" onSubmitEditing={() => verifyProof('email')} editable={proofBusy === null} /> : null}{emailSent && !emailVerified ? <Pressable onPress={() => verifyProof('email')} disabled={proofBusy !== null} style={styles.checkButton}><Text style={styles.checkText}>Valider</Text></Pressable> : null}</View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Adresse & service</Text>
            <Pressable onPress={detectTerritory} disabled={locationBusy} style={styles.locationButton}>{locationBusy ? <ActivityIndicator color="#FFF8F0" /> : <Text style={styles.locationText}>{deviceTerritory?.detected ? `${deviceTerritory.territory.city} · ${deviceTerritory.territory.country}` : 'Détecter la zone'}</Text>}</Pressable>
            <Text style={styles.label}>Adresse *</Text><TextInput value={address} onChangeText={changeAddress} placeholder="Commencez à saisir puis choisissez…" placeholderTextColor="#91796B" style={styles.input} />
            {addressBusy ? <ActivityIndicator style={styles.spinner} color="#F0A35C" /> : null}
            {addressError ? <View style={styles.addressNotice}><Text style={styles.addressNoticeText}>{addressError}</Text>{addressProviderBlocked ? <Pressable onPress={retryAddressProvider} disabled={addressBusy} style={[styles.addressRetry, addressBusy && styles.disabled]} accessibilityRole="button" accessibilityLabel="Relancer la vérification d’adresse"><Text style={styles.addressRetryText}>Réessayer</Text></Pressable> : null}</View> : null}
            {suggestions.map((item) => <Pressable key={item.placeId} onPress={() => chooseAddress(item)} style={styles.suggestion}><Text style={styles.suggestionPrimary}>{item.primaryText}</Text><Text style={styles.suggestionSecondary}>{item.secondaryText}</Text></Pressable>)}
            <Text style={styles.label}>Ville résolue</Text><TextInput value={city} editable={false} placeholder="Adresse confirmée requise" placeholderTextColor="#91796B" style={[styles.input, styles.locked]} />
            {addressVerified ? <Text style={styles.confirmed}>✓ Adresse géolocalisée · {territory?.countryCode}</Text> : <Text style={styles.hint}>Aucune adresse libre ne peut ouvrir un service.</Text>}
            <Text style={styles.label}>Spécialité</Text><TextInput value={specialty} onChangeText={setSpecialty} placeholder="Signature culinaire" placeholderTextColor="#91796B" style={styles.input} />
            <Text style={styles.label}>Préparation moyenne *</Text><TextInput value={prepTime} onChangeText={setPrepTime} placeholder="Ex. 25 min" placeholderTextColor="#91796B" style={styles.input} />
            <Text style={styles.label}>Instructions de retrait</Text><TextInput value={pickupInstructions} onChangeText={setPickupInstructions} placeholder="Entrée, comptoir, appel…" placeholderTextColor="#91796B" style={[styles.input, styles.multiline]} multiline />
          </View>

          <View style={styles.toggle}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>Service en ligne</Text><Text style={styles.toggleText}>{activationReady ? 'Prêt à recevoir des commandes.' : 'Verrouillé jusqu’aux trois preuves.'}</Text></View><Switch value={serviceOpen} onValueChange={toggleService} /></View>
          <Pressable disabled={checking} onPress={save} style={[styles.primary, checking && styles.disabled]}>{checking ? <ActivityIndicator color="#220D05" /> : <Text style={styles.primaryText}>Enregistrer l’établissement</Text>}</Pressable>
          <Pressable onPress={() => router.push('/orders' as any)} style={styles.secondary}><Text style={styles.secondaryText}>Voir les commandes</Text></Pressable>
          <Pressable onPress={() => router.replace('/')} style={styles.back}><Text style={styles.backText}>Retour au service</Text></Pressable>
          <Text style={styles.note}>{trust?.issues?.[0]?.message || 'Le service ne peut plus passer en ligne avec une adresse ou un contact non prouvé.'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#170A05' }, page: { padding: 22, paddingBottom: 72 }, brand: { color: '#F0A35C', fontSize: 15, fontWeight: '900', letterSpacing: 4, marginTop: 8 }, title: { color: '#FFF8F0', fontSize: 40, lineHeight: 46, fontWeight: '900', marginTop: 14 }, subtitle: { color: '#C7AEA0', fontSize: 17, lineHeight: 25, marginTop: 10, marginBottom: 20 },
  truthCard: { padding: 18, borderRadius: 24, backgroundColor: '#35160D', borderWidth: 1, borderColor: 'rgba(240,163,92,0.28)', marginBottom: 16 }, truthReady: { backgroundColor: '#FFF0E0' }, truthKicker: { color: '#D37A35', fontSize: 11, fontWeight: '900', letterSpacing: 2.5 }, truthTitle: { color: '#FFF8F0', fontSize: 21, fontWeight: '900', marginTop: 6 }, truthTitleReady: { color: '#2A110A' }, truthText: { color: '#C8AFA1', fontSize: 14, lineHeight: 20, marginTop: 5 }, truthTextReady: { color: '#76503B' },
  continuityHint: { color: 'rgba(255,255,255,0.52)', fontSize: 10, lineHeight: 15, marginTop: -4, marginBottom: 14, paddingHorizontal: 3 },
  card: { padding: 18, borderRadius: 26, backgroundColor: '#2A110A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 }, cardTitle: { color: '#FFF8F0', fontSize: 24, fontWeight: '900', marginBottom: 8 }, label: { color: '#F0A35C', fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginTop: 12, marginBottom: 7 }, input: { minHeight: 56, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#150804', borderWidth: 1, borderColor: 'rgba(240,163,92,0.22)', color: '#FFF8F0', fontSize: 17, fontWeight: '700' }, locked: { opacity: 0.72 }, multiline: { minHeight: 86, textAlignVertical: 'top' },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }, miniButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center', backgroundColor: '#F0A35C' }, miniButtonReady: { backgroundColor: '#FFD2A8' }, miniButtonText: { color: '#220D05', fontWeight: '900' }, codeInput: { minHeight: 44, minWidth: 100, flex: 1, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#150804', borderWidth: 1, borderColor: 'rgba(240,163,92,0.22)', color: '#FFF8F0', fontWeight: '900' }, checkButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center', backgroundColor: '#4A2112' }, checkText: { color: '#FFF8F0', fontWeight: '900' },
  alternateButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 14, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }, alternateButtonText: { color: '#FFD0A8', fontSize: 11, fontWeight: '900' }, providerHint: { width: '100%', color: '#A88B7A', fontSize: 11, marginTop: 2 },
  locationButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A2112', marginTop: 6 }, locationText: { color: '#FFF8F0', fontWeight: '900' }, spinner: { marginVertical: 8 }, suggestion: { padding: 13, borderRadius: 14, backgroundColor: '#3B190E', marginTop: 7 }, suggestionPrimary: { color: '#FFF8F0', fontSize: 15, fontWeight: '900' }, suggestionSecondary: { color: '#B99F91', fontSize: 12, lineHeight: 17, marginTop: 3 }, confirmed: { color: '#FFD2A8', fontSize: 12, fontWeight: '900', marginTop: 8 }, hint: { color: '#9C8275', fontSize: 12, lineHeight: 18, marginTop: 8 }, addressNotice: { padding: 13, borderRadius: 14, backgroundColor: '#3B190E', borderWidth: 1, borderColor: 'rgba(240,163,92,0.24)', marginTop: 8 }, addressNoticeText: { color: '#E2CFC4', fontSize: 12, lineHeight: 18, fontWeight: '700' }, addressRetry: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F0A35C', marginTop: 9 }, addressRetryText: { color: '#220D05', fontSize: 12, fontWeight: '900' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 22, backgroundColor: '#3B190E', marginBottom: 16 }, toggleCopy: { flex: 1 }, toggleTitle: { color: '#FFF8F0', fontSize: 17, fontWeight: '900' }, toggleText: { color: '#B99F91', fontSize: 13, lineHeight: 19, marginTop: 4 }, primary: { minHeight: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0A35C' }, primaryText: { color: '#220D05', fontSize: 17, fontWeight: '900' }, disabled: { opacity: 0.48 }, secondary: { minHeight: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A2112', marginTop: 12 }, secondaryText: { color: '#FFF8F0', fontSize: 16, fontWeight: '900' }, back: { alignItems: 'center', padding: 16 }, backText: { color: '#B99F91', fontWeight: '800' }, note: { color: '#9C8275', fontSize: 12, lineHeight: 19, textAlign: 'center' },
});
