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
import { loadCourierPresence, readCourierPresenceCache, saveCourierPresence } from '../utils/daPresenceStore';
import {
  DaIdentityChannel,
  DaIdentityProof,
  DaTerritoryContext,
  daCheckIdentityProof,
  daNewIdentityRequestId,
  daResolveTerritory,
  daStartIdentityProof,
} from '../utils/daTrustNetwork';

type CourierProfileLite = {
  id: string;
  riderName: string;
  phone: string;
  email: string;
  activeZone: string;
  vehicle: string;
  capacity: string;
  emergencyContact: string;
  notes: string;
  available: boolean;
  territory?: DaTerritoryContext['territory'];
  territoryEvidence?: { latitude: number; longitude: number; detectedAt: string; source: string };
  proofs?: { phone?: DaIdentityProof; email?: DaIdentityProof };
  trust?: { status: 'screened'; score: number; checkedAt: string; emailDomain: string };
  updatedAt: string;
};

const clean = (value: string) => String(value || '').replace(/\s+/g, ' ').trim();

// DA_SPRINT16_PRESENCE_CONTINUITY_V1
export default function CourierSpaceScreen() {
  const existing = readCourierPresenceCache<CourierProfileLite>();
  const [riderName, setRiderName] = useState(existing?.riderName || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [email, setEmail] = useState(existing?.email || '');
  const [activeZone, setActiveZone] = useState(existing?.activeZone || '');
  const [vehicle, setVehicle] = useState(existing?.vehicle || '');
  const [capacity, setCapacity] = useState(existing?.capacity || '');
  const [emergencyContact, setEmergencyContact] = useState(existing?.emergencyContact || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [available, setAvailable] = useState(existing?.available ?? false);
  const [territory, setTerritory] = useState<DaTerritoryContext | null>(
    existing?.territory && existing?.territoryEvidence
      ? {
          ok: true,
          detected: true,
          coordinates: {
            latitude: existing.territoryEvidence.latitude,
            longitude: existing.territoryEvidence.longitude,
          },
          territory: existing.territory,
          formattedAddress: '',
          source: existing.territoryEvidence.source,
          notice: '',
        }
      : null,
  );
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
  const territoryVerified = Boolean(territory?.detected && territory.territory.countryCode && territory.territory.city);
  const activationReady = phoneVerified && emailVerified && territoryVerified;


async function persistActivationDraft(patch: Partial<CourierProfileLite> = {}) {
  const current = await loadCourierPresence<CourierProfileLite>();
  const draft: CourierProfileLite = {
    id: profileId || current?.id || `da_courier_draft_${Date.now().toString(36)}`,
    riderName: clean(riderName),
    phone: clean(phone),
    email: clean(email).toLowerCase(),
    activeZone: clean(activeZone),
    vehicle: clean(vehicle),
    capacity: clean(capacity),
    emergencyContact: clean(emergencyContact),
    notes: clean(notes),
    available: false,
    territory: territory?.territory,
    territoryEvidence: territory ? {
      latitude: territory.coordinates.latitude,
      longitude: territory.coordinates.longitude,
      detectedAt: new Date().toISOString(),
      source: territory.source,
    } : undefined,
    proofs: {
      phone: phoneProof || undefined,
      email: emailProof || undefined,
    },
    trust: current?.trust,
    updatedAt: new Date().toISOString(),
    ...patch,
  };
  await saveCourierPresence(draft);
  setProfileId(draft.id);
  return draft;
}

  useEffect(() => {
    let active = true;
    void loadCourierPresence<CourierProfileLite>().then((profile) => {
      if (!active || !profile) return;
      setProfileId(profile.id || '');
      setRiderName(profile.riderName || '');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
      setActiveZone(profile.activeZone || '');
      setVehicle(profile.vehicle || '');
      setCapacity(profile.capacity || '');
      setEmergencyContact(profile.emergencyContact || '');
      setNotes(profile.notes || '');
      setAvailable(Boolean(profile.available));
      setTerritory(profile.territory && profile.territoryEvidence ? {
        ok: true,
        detected: true,
        coordinates: {
          latitude: Number(profile.territoryEvidence.latitude),
          longitude: Number(profile.territoryEvidence.longitude),
        },
        territory: profile.territory,
        formattedAddress: profile.activeZone || profile.territory.city,
        source: profile.territoryEvidence.source || 'device',
        notice: 'Territoire restauré depuis le stockage sécurisé.',
      } : null);
      setPhoneProof(profile.proofs?.phone || null);
      setEmailProof(profile.proofs?.email || null);
    });
    return () => { active = false; };
  }, []);

  const basics = useMemo(() => {
    const items: string[] = [];
    if (clean(riderName).length < 2) items.push('Nom coursier incomplet.');
    if (!clean(phone)) items.push('Téléphone requis.');
    if (!clean(email)) items.push('Email requis.');
    if (!territoryVerified) items.push('Territoire terrain à détecter.');
    if (!clean(vehicle)) items.push('Véhicule requis.');
    return items;
  }, [email, phone, riderName, territoryVerified, vehicle]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const context = await daResolveTerritory(current.coords.latitude, current.coords.longitude);
        if (active && context.detected) {
          setTerritory(context);
          setActiveZone(`${context.territory.city} · ${context.territory.country}`);
        }
      } catch {
        // Le bouton de détection reste disponible.
      }
    })();
    return () => { active = false; };
  }, []);

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
    setAvailable(false);
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
    setAvailable(false);
    invalidate();
  };

  async function detectTerritory() {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Position requise', 'La mise en ligne terrain exige une zone réellement détectée.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const context = await daResolveTerritory(current.coords.latitude, current.coords.longitude);
      if (!context.detected) {
        Alert.alert('Territoire non résolu', 'Déplacez-vous dans une zone couverte ou réessayez.');
        return;
      }
      const nextZone = `${context.territory.city} · ${context.territory.country}`;
      await persistActivationDraft({
        activeZone: nextZone,
        available: false,
        territory: context.territory,
        territoryEvidence: {
          latitude: context.coordinates.latitude,
          longitude: context.coordinates.longitude,
          detectedAt: new Date().toISOString(),
          source: context.source,
        },
        trust: undefined,
      });
      setTerritory(context);
      setActiveZone(nextZone);
      setAvailable(false);
      Alert.alert('Terrain confirmé', `${context.territory.city} · ${context.territory.country}`);
    } catch (error: any) {
      Alert.alert('Terrain indisponible', error?.message || 'Réessayez dans un instant.');
    } finally {
      setLocationBusy(false);
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
      ? daNewIdentityRequestId('courier-' + channel)
      : currentRequestId;
    if (channel === 'sms') setPhoneClientRequestId(requestId); else setEmailClientRequestId(requestId);

    proofFlightRef.current = true;
    setProofBusy(channel);
    try {
      const result = await daStartIdentityProof({
        channel,
        role: 'courier',
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
      const result = await daCheckIdentityProof({ channel, role: 'courier', destination, code, attemptToken });
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
        available: false,
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

  function toggleAvailable(value: boolean) {
    if (value && !activationReady) {
      Alert.alert('Mise en ligne verrouillée', 'Confirmez le terrain, le téléphone et l’email.');
      return;
    }
    setAvailable(value);
  }

  async function save() {
    if (basics.length) {
      Alert.alert('Profil à compléter', basics.join('\n'));
      return;
    }
    if (available && !activationReady) {
      Alert.alert('Mise en ligne verrouillée', 'Les trois preuves sont obligatoires.');
      return;
    }
    setChecking(true);
    try {
      const result = await daInspectProfileTrust({ role: 'courier', name: riderName, phone, email, city: activeZone });
      setTrust(result);
      if (!result.ok) {
        Alert.alert('Informations non validées', result.issues.map((item) => `• ${item.message}`).join('\n'));
        return;
      }
      const profile: CourierProfileLite = {
        id: profileId || `da_courier_${Date.now().toString(36)}`,
        riderName: clean(riderName), phone: result.normalized.phone, email: result.normalized.email,
        activeZone: clean(activeZone), vehicle: clean(vehicle), capacity: clean(capacity),
        emergencyContact: clean(emergencyContact), notes: clean(notes),
        available: activationReady ? available : false,
        territory: territory!.territory,
        territoryEvidence: {
          latitude: territory!.coordinates.latitude,
          longitude: territory!.coordinates.longitude,
          detectedAt: new Date().toISOString(),
          source: territory!.source,
        },
        proofs: { phone: phoneVerified ? phoneProof! : undefined, email: emailVerified ? emailProof! : undefined },
        trust: { status: 'screened', score: result.score, checkedAt: result.checkedAt, emailDomain: result.email.domain },
        updatedAt: new Date().toISOString(),
      };
      await saveCourierPresence(profile);
      setProfileId(profile.id);
      Alert.alert('Profil terrain enregistré', activationReady ? 'Le coursier peut passer en ligne.' : 'La mise en ligne reste verrouillée.', [{ text: 'Retour au terrain', onPress: () => router.replace('/') }]);
    } catch (error: any) {
      Alert.alert('Contrôle indisponible', error?.message || 'Réessayez dans un instant.');
    } finally {
      setChecking(false);
    }
  }

  const truthCount = Number(territoryVerified) + Number(phoneVerified) + Number(emailVerified);
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
          <Text style={styles.title}>Mon terrain</Text>
          <Text style={styles.subtitle}>Être identifié. Être localisé. Passer en ligne d’un geste.</Text>

          <View style={[styles.truthCard, truthCount === 3 && styles.truthReady]}>
            <Text style={styles.truthKicker}>ACTIVATION TERRAIN</Text>
            <Text style={[styles.truthTitle, truthCount === 3 && styles.truthTitleReady]}>{truthCount}/3 preuves</Text>
            <Text style={[styles.truthText, truthCount === 3 && styles.truthTextReady]}>Terrain {territoryVerified ? '✓' : '·'} · SMS {phoneVerified ? '✓' : '·'} · Email {emailVerified ? '✓' : '·'}</Text>
          </View>
          <Text style={styles.continuityHint}>Les étapes confirmées sont sauvegardées dans le stockage sécurisé de cet appareil.</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Identité</Text>
            <Text style={styles.label}>Nom coursier *</Text><TextInput value={riderName} onChangeText={(v) => { setRiderName(v); invalidate(); }} placeholder="Nom complet" placeholderTextColor="#6C9078" style={styles.input} />
            <Text style={styles.label}>Téléphone international *</Text><TextInput value={phone} onChangeText={changePhone} placeholder="+32…" placeholderTextColor="#6C9078" style={styles.input} keyboardType="phone-pad" />
            <View style={styles.proofRow}>
              <Pressable onPress={() => sendProof('sms')} disabled={proofBusy !== null || phoneVerified} style={[styles.miniButton, phoneVerified && styles.miniButtonReady]}>
                {proofBusy === 'sms' ? <ActivityIndicator color="#00160D" /> : <Text style={styles.miniButtonText}>{phoneVerified ? 'SMS confirmé' : phoneSent ? 'Renvoyer le code' : 'Envoyer le code'}</Text>}
              </Pressable>
              {phoneSent && !phoneVerified ? <TextInput value={phoneCode} onChangeText={setPhoneCode} placeholder="Code" placeholderTextColor="#6C9078" style={styles.codeInput} keyboardType="number-pad" maxLength={10} returnKeyType="done" onSubmitEditing={() => verifyProof('sms')} editable={proofBusy === null} /> : null}
              {phoneSent && !phoneVerified ? <Pressable onPress={() => verifyProof('sms')} disabled={proofBusy !== null} style={styles.checkButton}><Text style={styles.checkText}>Valider</Text></Pressable> : null}
              {phoneSent && !phoneVerified && phoneAlternateAvailable ? (
                <Pressable onPress={() => sendProof('sms', 'alternate')} disabled={proofBusy !== null} style={styles.alternateButton}>
                  <Text style={styles.alternateButtonText}>Je n’ai rien reçu · route de secours</Text>
                </Pressable>
              ) : null}
              {phoneSent && !phoneVerified && phoneProvider ? <Text style={styles.providerHint}>Route sécurisée : {phoneProvider}</Text> : null}
              {phoneSent && !phoneVerified ? <Text style={styles.providerHint}>Utilisez uniquement le code le plus récent.</Text> : null}
            </View>
            <Text style={styles.label}>Email *</Text><TextInput value={email} onChangeText={changeEmail} placeholder="vous@fournisseur.com" placeholderTextColor="#6C9078" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <View style={styles.proofRow}><Pressable onPress={() => sendProof('email')} disabled={proofBusy !== null || emailVerified} style={[styles.miniButton, emailVerified && styles.miniButtonReady]}>{proofBusy === 'email' ? <ActivityIndicator color="#00160D" /> : <Text style={styles.miniButtonText}>{emailVerified ? 'Email confirmé' : emailSent ? 'Renvoyer le code' : 'Envoyer le code'}</Text>}</Pressable>{emailSent && !emailVerified ? <TextInput value={emailCode} onChangeText={setEmailCode} placeholder="Code" placeholderTextColor="#6C9078" style={styles.codeInput} keyboardType="number-pad" maxLength={10} returnKeyType="done" onSubmitEditing={() => verifyProof('email')} editable={proofBusy === null} /> : null}{emailSent && !emailVerified ? <Pressable onPress={() => verifyProof('email')} disabled={proofBusy !== null} style={styles.checkButton}><Text style={styles.checkText}>Valider</Text></Pressable> : null}</View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Terrain</Text>
            <Pressable onPress={detectTerritory} disabled={locationBusy} style={styles.locationButton}>{locationBusy ? <ActivityIndicator color="#F4FFF7" /> : <Text style={styles.locationText}>{territoryVerified ? activeZone : 'Détecter mon territoire'}</Text>}</Pressable>
            <Text style={styles.label}>Zone active vérifiée *</Text><TextInput value={activeZone} editable={false} placeholder="Position requise" placeholderTextColor="#6C9078" style={[styles.input, styles.locked]} />
            <Text style={styles.hint}>{territoryVerified ? `✓ ${territory?.territory.key}` : 'La zone ne peut plus être inventée manuellement.'}</Text>
            <Text style={styles.label}>Véhicule *</Text><TextInput value={vehicle} onChangeText={setVehicle} placeholder="Vélo, scooter, voiture…" placeholderTextColor="#6C9078" style={styles.input} />
            <Text style={styles.label}>Capacité</Text><TextInput value={capacity} onChangeText={setCapacity} placeholder="Ex. 2 commandes" placeholderTextColor="#6C9078" style={styles.input} />
            <Text style={styles.label}>Contact urgence</Text><TextInput value={emergencyContact} onChangeText={setEmergencyContact} placeholder="Nom et téléphone" placeholderTextColor="#6C9078" style={styles.input} />
            <Text style={styles.label}>Note terrain</Text><TextInput value={notes} onChangeText={setNotes} placeholder="Informations utiles" placeholderTextColor="#6C9078" style={[styles.input, styles.multiline]} multiline />
          </View>

          <View style={styles.toggle}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>En ligne</Text><Text style={styles.toggleText}>{activationReady ? 'Prêt à recevoir des missions.' : 'Verrouillé jusqu’aux trois preuves.'}</Text></View><Switch value={available} onValueChange={toggleAvailable} /></View>
          <Pressable disabled={checking} onPress={save} style={[styles.primary, checking && styles.disabled]}>{checking ? <ActivityIndicator color="#00160D" /> : <Text style={styles.primaryText}>Enregistrer le terrain</Text>}</Pressable>
          <Pressable onPress={() => router.push('/orders' as any)} style={styles.secondary}><Text style={styles.secondaryText}>Voir les missions</Text></Pressable>
          <Pressable onPress={() => router.replace('/')} style={styles.back}><Text style={styles.backText}>Retour au terrain</Text></Pressable>
          <Text style={styles.note}>{trust?.issues?.[0]?.message || 'La zone détectée limite les missions au territoire réel sans fermer les futures zones mondiales.'}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#00160D' }, page: { padding: 22, paddingBottom: 72 }, brand: { color: '#9CF7B8', fontSize: 15, fontWeight: '900', letterSpacing: 4, marginTop: 8 }, title: { color: '#F4FFF7', fontSize: 40, lineHeight: 46, fontWeight: '900', marginTop: 14 }, subtitle: { color: '#A8C1B0', fontSize: 17, lineHeight: 25, marginTop: 10, marginBottom: 20 },
  truthCard: { padding: 18, borderRadius: 24, backgroundColor: '#082719', borderWidth: 1, borderColor: 'rgba(156,247,184,0.28)', marginBottom: 16 }, truthReady: { backgroundColor: '#EFFFF4' }, truthKicker: { color: '#47C47A', fontSize: 11, fontWeight: '900', letterSpacing: 2.5 }, truthTitle: { color: '#F4FFF7', fontSize: 21, fontWeight: '900', marginTop: 6 }, truthTitleReady: { color: '#082719' }, truthText: { color: '#A8C1B0', fontSize: 14, lineHeight: 20, marginTop: 5 }, truthTextReady: { color: '#456452' },
  continuityHint: { color: 'rgba(255,255,255,0.52)', fontSize: 10, lineHeight: 15, marginTop: -4, marginBottom: 14, paddingHorizontal: 3 },
  card: { padding: 18, borderRadius: 26, backgroundColor: '#082719', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 }, cardTitle: { color: '#F4FFF7', fontSize: 24, fontWeight: '900', marginBottom: 8 }, label: { color: '#9CF7B8', fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginTop: 12, marginBottom: 7 }, input: { minHeight: 56, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: '#00160D', borderWidth: 1, borderColor: 'rgba(156,247,184,0.22)', color: '#F4FFF7', fontSize: 17, fontWeight: '700' }, locked: { opacity: 0.72 }, multiline: { minHeight: 86, textAlignVertical: 'top' },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap' }, miniButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center', backgroundColor: '#9CF7B8' }, miniButtonReady: { backgroundColor: '#C8FFD7' }, miniButtonText: { color: '#00160D', fontWeight: '900' }, codeInput: { minHeight: 44, minWidth: 100, flex: 1, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#00160D', borderWidth: 1, borderColor: 'rgba(156,247,184,0.22)', color: '#F4FFF7', fontWeight: '900' }, checkButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center', backgroundColor: '#145131' }, checkText: { color: '#F4FFF7', fontWeight: '900' },
  alternateButton: { minHeight: 42, paddingHorizontal: 13, borderRadius: 14, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }, alternateButtonText: { color: '#9CF7B8', fontSize: 11, fontWeight: '900' }, providerHint: { width: '100%', color: '#91B39C', fontSize: 11, marginTop: 2 },
  locationButton: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#145131', marginTop: 6 }, locationText: { color: '#F4FFF7', fontWeight: '900' }, hint: { color: '#91B39C', fontSize: 12, lineHeight: 18, marginTop: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 22, backgroundColor: '#0E3522', marginBottom: 16 }, toggleCopy: { flex: 1 }, toggleTitle: { color: '#F4FFF7', fontSize: 17, fontWeight: '900' }, toggleText: { color: '#98B1A0', fontSize: 13, lineHeight: 19, marginTop: 4 }, primary: { minHeight: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#9CF7B8' }, primaryText: { color: '#00160D', fontSize: 17, fontWeight: '900' }, disabled: { opacity: 0.48 }, secondary: { minHeight: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#145131', marginTop: 12 }, secondaryText: { color: '#F4FFF7', fontSize: 16, fontWeight: '900' }, back: { alignItems: 'center', padding: 16 }, backText: { color: '#98B1A0', fontWeight: '800' }, note: { color: '#799082', fontSize: 12, lineHeight: 19, textAlign: 'center' },
});
