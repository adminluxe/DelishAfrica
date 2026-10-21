import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDaPkceAuth } from '../hooks/useDaPkceAuth';
import { loadCourierPresence } from '../utils/daPresenceStore';
import {
  readCourierProfessionalTruth, unavailableCourierTruth, type CourierProfessionalTruth,
} from '../utils/daCourierProfessional';
import DaAccountEntry from '../ui/DaAccountEntry';

const STEPS = ['Connecter mon identité', 'Faire examiner mon dossier', 'Accéder aux missions'];
function friendlyFailure(value: unknown): string {
  const raw = String(value || '').toLowerCase();
  if (/cancel|dismiss/.test(raw)) return '';
  if (/role|membership|owner|tenant|permission|not_authorized|api_external/.test(raw))
    return 'Votre accès livreur doit encore être vérifié. Contactez notre équipe pour connaître la suite.';
  if (/redirect|callback|invalid_parameter|scheme/.test(raw))
    return 'Le retour vers l’application n’a pas abouti. Fermez la fenêtre de connexion, puis réessayez.';
  if (/discovery|network|fetch|timeout|connexion/.test(raw))
    return 'La connexion est momentanément indisponible. Vérifiez votre réseau et réessayez.';
  return 'La connexion n’a pas pu être finalisée. Réessayez ou contactez notre assistance.';
}

export default function CourierAccountEntry() {
  const router = useRouter();
  const auth = useDaPkceAuth();
  const verified = auth.session.status === 'authenticated' && Boolean(auth.session.subject);
  const subject = verified ? String(auth.session.subject) : '';
  const ready = auth.requestReady && Boolean(auth.redirectUri);
  const initializing = auth.session.status === 'anonymous' && auth.session.reason === 'initializing';
  const [notice, setNotice] = useState('');
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [snapshot, setSnapshot] = useState<{ subject: string; truth: CourierProfessionalTruth }>(
    () => ({ subject: '', truth: unavailableCourierTruth('not_checked') }),
  );
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const currentSubject = useRef(subject);
  currentSubject.current = subject;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setSnapshot({ subject, truth: unavailableCourierTruth('checking') });
    setHasLocalDraft(false);
    setChecking(Boolean(subject));
    if (!subject) return () => { active = false; };
    void Promise.all([
      loadCourierPresence<Record<string, unknown>>().catch(() => null),
      readCourierProfessionalTruth(subject),
    ]).then(([local, truth]) => {
      if (!active || currentSubject.current !== subject) return;
      setHasLocalDraft(Boolean(local && typeof local.riderName === 'string' && local.riderName.trim()));
      setSnapshot({ subject, truth });
    }).catch(() => {
      if (active) setSnapshot({ subject, truth: unavailableCourierTruth('server_unreachable') });
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [subject]));

  const truth = snapshot.subject === subject ? snapshot.truth : unavailableCourierTruth('subject_changed');
  const approved = verified && !checking && truth.approved;
  const busy = auth.busy || opening;
  const canOpen = ready && !busy && !initializing;
  const professionalLabel = checking ? 'Vérification de votre dossier…'
    : approved ? 'Votre accès aux missions est confirmé.'
    : truth.status === 'pending_review' ? 'Votre dossier est en cours d’examen.'
    : truth.status === 'suspended' ? 'Votre accès aux missions est suspendu. Contactez notre équipe.'
    : truth.status === 'rejected' ? 'Votre candidature nécessite un suivi auprès de notre équipe.'
    : truth.status === 'unavailable' ? 'Le statut de votre dossier est momentanément indisponible.'
    : hasLocalDraft ? 'Votre brouillon est enregistré sur cet appareil. Il n’est pas encore approuvé.'
    : 'Votre dossier reste à compléter avant de recevoir des missions.';

  async function beginLogin() {
    if (!canOpen || inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setNotice('');
    try {
      const result = await auth.signIn('login');
      if (!mounted.current) return;
      if (result.status === 'authenticated' && result.subject) router.replace('/onboarding' as any);
      else if (result.status === 'error') setNotice(friendlyFailure(result.reason));
      else if (result.status === 'authenticated') setNotice(friendlyFailure('identity_missing'));
    } catch (error) {
      if (mounted.current) setNotice(friendlyFailure(error instanceof Error ? error.message : error));
    } finally {
      inFlight.current = false;
      if (mounted.current) setOpening(false);
    }
  }

  async function continueAccount() {
    if (!verified || busy || checking || inFlight.current) return;
    if (!approved) { router.push('/courier-space' as any); return; }
    // Recheck at the action boundary; a rendered badge is never an authorization.
    inFlight.current = true;
    setChecking(true);
    try {
      const fresh = await readCourierProfessionalTruth(subject);
      if (!mounted.current || currentSubject.current !== subject) return;
      setSnapshot({ subject, truth: fresh });
      if (fresh.approved) router.push('/orders' as any);
      else setNotice('Votre accès aux missions doit être confirmé. Consultez votre dossier ou contactez notre équipe.');
    } catch {
      if (mounted.current && currentSubject.current === subject) {
        setSnapshot({ subject, truth: unavailableCourierTruth('server_unreachable') });
        setNotice('Impossible de confirmer votre accès. Aucune mission n’a été ouverte.');
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setChecking(false);
    }
  }

  return (
    <DaAccountEntry
      brand="DELISHAFRICA® · LIVREUR" eyebrow="CHAQUE LIVRAISON COMPTE"
      title="Prenez la route."
      subtitle="Retrouvez votre compte, suivez votre dossier et préparez votre prochaine mission."
      accent="#77F0B4" background="#061C14"
      image={require('../assets/h2o/courier-h2o-premium-v1.png')}
      connected={verified}
      heading={verified ? 'Heureux de vous retrouver.' : 'Votre prochaine étape commence ici.'}
      description={verified
        ? auth.session.displayName || auth.session.email || 'Votre compte est connecté.'
        : 'Créez votre compte livreur ou connectez-vous pour retrouver votre parcours.'}
      primary={verified ? {
        label: checking ? 'Vérification du dossier…' : approved ? 'Consulter mes missions' : 'Consulter mon dossier',
        testID: 'courier-continue', disabled: busy || checking,
        onPress: () => { void continueAccount(); },
      } : {
        label: 'Me connecter', testID: 'courier-login', disabled: !canOpen, busy,
        onPress: () => { void beginLogin(); },
      }}
      secondary={!verified ? {
        label: 'Créer mon compte livreur', testID: 'courier-register', disabled: busy,
        onPress: () => { if (!busy) router.push('/register' as any); },
      } : undefined}
      status={verified ? professionalLabel : undefined}
      progress={{ current: !verified ? 0 : approved ? 2 : 1, steps: STEPS }}
      notice={notice}
      availability={!verified
        ? !ready || initializing ? 'Préparation de la connexion sécurisée…' : 'La création du compte et la validation du dossier sont deux étapes distinctes. Les missions restent réservées aux livreurs habilités.'
        : 'L’accès aux missions dépend de la validation de votre dossier.'}
      onLegal={() => router.push('/legal' as any)}
    />
  );
}
