import React from 'react';
import { useRouter } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';
import DaAccountEntry from './DaAccountEntry';
import { useDaEnrollment } from '../hooks/useDaEnrollment';
import { useDaProductionRegistration } from '../hooks/useDaProductionRegistration';
import type { EnrollmentApp } from '../auth/daEnrollmentContract';

type Props = { application: EnrollmentApp; image: ImageSourcePropType };
const COPY = {
  client: {
    brand: 'CLIENT', accent: '#E7B85F', background: '#081A25',
    title: 'Le plaisir commence ici.',
    description: 'Créez votre compte personnel. Vos informations de livraison viendront au moment utile.',
  },
  merchant: {
    brand: 'RESTAURATEUR', accent: '#F5B477', background: '#24130C',
    title: 'Faites rayonner votre cuisine.',
    description: 'Créez votre identité, puis préparez le dossier de votre établissement. Son activation reste soumise à validation.',
  },
  courier: {
    brand: 'LIVREUR', accent: '#77F0B4', background: '#061C14',
    title: 'Votre parcours commence ici.',
    description: 'Créez votre identité et avancez dans votre candidature. Les missions s’ouvrent uniquement après validation de votre dossier.',
  },
};

export default function DaRegistration({ application, image }: Props) {
  const router = useRouter();
  const qa = useDaEnrollment(application);
  const production = useDaProductionRegistration(application);
  const copy = COPY[application];
  const flow = qa.available ? qa : production;
  const available = qa.available || production.available;
  const qaPending = qa.available && qa.phase === 'pending' && Boolean(qa.receipt);
  const productionRegistered = !qa.available && production.phase === 'registered';
  const complete = qaPending || productionRegistered;

  const status = flow.phase === 'opening'
    ? 'Créez votre compte et confirmez votre email dans la fenêtre sécurisée.'
    : flow.phase === 'saving' || flow.phase === 'verifying'
      ? 'Vérification sécurisée de votre identité…'
      : qaPending
        ? application === 'client'
          ? 'Votre email est confirmé. L’activation de votre compte reste à finaliser.'
          : 'Votre email est confirmé. La vérification du téléphone et la suite du dossier restent à finaliser.'
        : productionRegistered
          ? application === 'client'
            ? 'Votre identité est créée et votre email est vérifié.'
            : 'Votre identité est créée et vérifiée. Votre accès professionnel reste soumis à validation.'
          : undefined;

  const unavailable = 'La création de compte n’est pas disponible dans cette version. Vous pouvez toujours retrouver un compte existant.';

  return (
    <DaAccountEntry
      brand={`DELISHAFRICA® · ${copy.brand}`}
      eyebrow="BIENVENUE DANS L’AVENTURE"
      title={copy.title}
      subtitle="Un compte personnel. Un parcours qui vous ressemble."
      accent={copy.accent}
      background={copy.background}
      image={image}
      connected={false}
      heading={complete ? 'Votre progression est enregistrée.' : 'Créer mon compte'}
      description={copy.description}
      primary={{
        label: productionRegistered ? 'Revenir à la connexion' : qaPending ? 'Reprendre mon inscription' : 'Créer mon compte',
        testID: 'signup-create',
        disabled: productionRegistered ? false : !available || flow.busy,
        busy: productionRegistered ? false : flow.busy,
        onPress: () => {
          if (productionRegistered) { flow.cancel(); router.replace('/onboarding' as any); return; }
          void (qaPending ? flow.resume() : flow.create());
        },
      }}
      secondary={!complete ? {
        label: 'Reprendre mon inscription',
        testID: 'signup-resume',
        disabled: !available || flow.busy,
        onPress: () => { void flow.resume(); },
      } : undefined}
      explore={!productionRegistered ? {
        label: flow.busy ? 'Annuler et revenir' : 'J’ai déjà un compte',
        testID: 'signup-existing',
        onPress: () => { flow.cancel(); router.replace('/onboarding' as any); },
      } : undefined}
      status={status}
      notice={flow.notice}
      availability={!available
        ? unavailable
        : 'Votre mot de passe est saisi uniquement dans le service d’identification. Aucun accès professionnel n’est attribué automatiquement.'}
      progress={{
        current: complete ? 2 : 0,
        steps: [
          'Créer mon identité',
          'Confirmer mon email',
          application === 'client' ? 'Finaliser mon compte' : 'Compléter les vérifications',
        ],
      }}
      onLegal={() => router.push('/legal' as any)}
    />
  );
}
