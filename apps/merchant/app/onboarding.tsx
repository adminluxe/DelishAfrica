import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  daMerchantOidcLogin, daMerchantOidcRuntimeStatus, daMerchantOidcSession,
  type MerchantOidcSession,
} from '../utils/daMerchantOidc';
import DaAccountEntry from '../ui/DaAccountEntry';

const NEXT_ALLOWED = new Set(['/partner-space', '/orders', '/ops-dashboard']);
function friendlyFailure(value: unknown): string {
  const raw = String(value || '').toLowerCase();
  if (/cancel|dismiss/.test(raw)) return '';
  if (/role|membership|owner|tenant|permission|not_authorized|api_external/.test(raw))
    return 'Votre accès restaurateur doit être confirmé avant l’ouverture de votre espace. Contactez notre équipe.';
  if (/redirect|callback|invalid_parameter|scheme/.test(raw))
    return 'Le retour vers l’application n’a pas abouti. Fermez la fenêtre de connexion, puis réessayez.';
  if (/discovery|network|fetch|timeout|connexion/.test(raw))
    return 'La connexion est momentanément indisponible. Vérifiez votre réseau et réessayez.';
  return 'La connexion n’a pas pu être finalisée. Réessayez ou contactez notre assistance.';
}

export default function MerchantAccountEntry() {
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const proposed = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextRoute = proposed && NEXT_ALLOWED.has(proposed) ? proposed : '/partner-space';
  const [notice, setNotice] = useState('');
  const [oidc, setOidc] = useState<MerchantOidcSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const runtime = useMemo(() => daMerchantOidcRuntimeStatus(), []);
  useEffect(() => {
    let active = true;
    mounted.current = true;
    void daMerchantOidcSession().then((current) => { if (active) setOidc(current); })
      .catch(() => { if (active) setNotice('Reconnectez votre compte pour retrouver votre espace.'); })
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; mounted.current = false; };
  }, []);
  const verified = Boolean(oidc?.authenticated);
  const ready = runtime.ready && Boolean(runtime.redirectUri);
  const canOpen = ready && !busy && !restoring;

  async function beginLogin() {
    if (!canOpen || inFlight.current) return;
    inFlight.current = true;
    setNotice('');
    setBusy(true);
    try {
      const current = await daMerchantOidcLogin('login');
      if (!mounted.current) return;
      setOidc(current);
      if (current.authenticated) router.replace(nextRoute as any);
      else setNotice(friendlyFailure('merchant_role_missing'));
    } catch (error) {
      if (mounted.current) setNotice(friendlyFailure(error instanceof Error ? error.message : error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <DaAccountEntry
      brand="DELISHAFRICA® · RESTAURATEUR"
      eyebrow="LE TALENT EST DANS VOTRE CUISINE"
      title="Votre cuisine. Votre espace."
      subtitle="Retrouvez votre établissement et gardez le service en main."
      accent="#F5B477" background="#24130C"
      image={require('../assets/h2o/merchant-h2o-premium-v1.png')}
      connected={verified}
      heading={verified ? 'Votre espace vous attend.' : 'Ravi de vous retrouver.'}
      description={verified
        ? oidc?.user?.name || oidc?.user?.email || 'Votre compte restaurateur est connecté.'
        : 'Créez votre compte restaurateur ou retrouvez le compte associé à votre établissement.'}
      primary={verified ? {
        label: 'Ouvrir mon espace', testID: 'merchant-continue', disabled: busy || restoring,
        onPress: () => router.replace(nextRoute as any),
      } : {
        label: 'Me connecter', testID: 'merchant-login', disabled: !canOpen, busy,
        onPress: () => { void beginLogin(); },
      }}
      secondary={!verified ? {
        label: 'Créer mon compte restaurateur', testID: 'merchant-register', disabled: busy || restoring,
        onPress: () => { if (!busy && !restoring) router.push('/register' as any); },
      } : undefined}
      notice={notice}
      availability={!ready || restoring
        ? 'Préparation de la connexion sécurisée…'
        : 'Nouveau restaurant ? L’ouverture de votre espace nécessite la validation de votre établissement par notre équipe.'}
      onLegal={() => router.push('/legal' as any)}
    />
  );
}
