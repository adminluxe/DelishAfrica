import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDaPkceAuth } from '../hooks/useDaPkceAuth';
import DaAccountEntry from '../ui/DaAccountEntry';

type EntryIntent = 'register' | 'login';
const NEXT_ALLOWED = new Set(['/client-space', '/restaurants', '/orders', '/checkout-preflight', '/live-tracking']);
function friendlyFailure(value: unknown): string {
  const raw = String(value || '').toLowerCase();
  if (/cancel|dismiss/.test(raw)) return '';
  if (/role|membership|permission|not_authorized|api_external/.test(raw))
    return 'Votre compte a été reconnu, mais son accès doit encore être vérifié. Contactez notre assistance.';
  if (/redirect|callback|invalid_parameter|scheme/.test(raw))
    return 'Le retour vers l’application n’a pas abouti. Fermez la fenêtre de connexion, puis réessayez.';
  if (/discovery|network|fetch|timeout|connexion/.test(raw))
    return 'La connexion est momentanément indisponible. Vérifiez votre réseau et réessayez.';
  return 'La connexion n’a pas pu être finalisée. Réessayez ou contactez notre assistance.';
}

export default function ClientAccountEntry() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const proposed = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextRoute = proposed && NEXT_ALLOWED.has(proposed) ? proposed : '/client-space';
  const auth = useDaPkceAuth();
  const [notice, setNotice] = useState('');
  const [opening, setOpening] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const verified = auth.session.status === 'authenticated' && Boolean(auth.session.subject);
  const initializing = auth.session.status === 'anonymous' && auth.session.reason === 'initializing';
  const ready = auth.requestReady && Boolean(auth.redirectUri);
  const busy = auth.busy || opening;
  const canOpen = ready && !busy && !initializing;

  async function begin(intent: EntryIntent) {
    if (!canOpen || inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setNotice('');
    try {
      const result = await auth.signIn(intent);
      if (!mounted.current) return;
      if (result.status === 'authenticated' && result.subject) router.replace(nextRoute as any);
      else if (result.status === 'error') setNotice(friendlyFailure(result.reason));
      else if (result.status === 'authenticated') setNotice(friendlyFailure('identity_missing'));
    } catch (error) {
      if (mounted.current) setNotice(friendlyFailure(error instanceof Error ? error.message : error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setOpening(false);
    }
  }

  return (
    <DaAccountEntry
      brand="DELISHAFRICA® · CLIENT"
      eyebrow="LE GOÛT DE SE RETROUVER"
      title="Bienvenue chez vous."
      subtitle="Les cuisines d’Afrique, vos adresses préférées et le plaisir de partager."
      accent="#E7B85F" background="#081A25"
      image={require('../assets/h2o/client-h2o-raster-premium-v1.png')}
      connected={verified}
      heading={verified ? 'Heureux de vous retrouver.' : 'À table, à votre rythme.'}
      description={verified
        ? auth.session.displayName || auth.session.email || 'Votre compte est connecté.'
        : 'Retrouvez votre compte ou créez le vôtre pour préparer votre prochaine commande.'}
      primary={verified ? {
        label: 'Continuer', testID: 'client-continue', disabled: busy,
        onPress: () => router.replace(nextRoute as any),
      } : {
        label: 'Me connecter', testID: 'client-login', disabled: !canOpen, busy,
        onPress: () => { void begin('login'); },
      }}
      secondary={!verified ? {
        label: 'Créer mon compte', testID: 'client-register', disabled: busy,
        onPress: () => { if (!busy) router.push('/register' as any); },
      } : undefined}
      explore={{ label: 'Explorer les restaurants', testID: 'client-explore', onPress: () => router.replace('/restaurants' as any) }}
      notice={notice}
      availability={!ready || initializing ? 'Préparation de la connexion sécurisée…' : 'La découverte des restaurants reste accessible sans compte.'}
      onLegal={() => router.push('/legal' as any)}
    />
  );
}
