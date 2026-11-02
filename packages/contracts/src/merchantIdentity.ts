export type VerifiedMerchantIdentity = { subject: string; name: string; email?: string; ownershipEligible: boolean };
export function verifiedMerchantIdentity(value: any, expectedSubject?: string): VerifiedMerchantIdentity | null {
  if (!value || value.ok !== true || value.authenticated !== true) return null;
  const role = value.role || value.user?.role || value.principal?.role;
  const subject = String(value.user?.id || value.principal?.subject || '').trim();
  if (role !== 'merchant' || !subject || (expectedSubject && subject !== expectedSubject)) return null;
  return { subject, name: String(value.user?.name || 'Compte partenaire'), email: value.user?.email,
    ownershipEligible: value.principal?.ownershipEligible === true || value.ownershipEligible === true };
}
export function merchantConnectionView(input: { oidc: any; session: any; health: any; access: any }) {
  const oidcConnected = input.oidc?.authenticated === true;
  const identity = oidcConnected ? verifiedMerchantIdentity(input.session, input.oidc?.user?.id) : null;
  const apiAvailable = input.health?.ok === true && (input.health?.trustedIdentity?.ready === true || input.health?.ready === true);
  const access = input.access;
  const operational = Boolean(identity && access?.state === 'ready' && access?.membershipEligible === true && access?.partnerId);
  return {
    oidcConnected, identityVerified: Boolean(identity), apiAvailable, operational,
    title: operational ? 'ACCÈS MARCHAND CONFIRMÉ' : identity ? 'IDENTITÉ CONFIRMÉE' : oidcConnected ? 'COMPTE CONNECTÉ' : 'CONNEXION REQUISE',
    detail: operational ? 'Établissement et adhésion confirmés par le service.' : identity
      ? access?.state === 'membership_pending' ? 'Établissement reconnu ; validation de l’adhésion en attente.'
        : access?.state === 'binding_required' ? 'Cette identité doit encore être rattachée à un établissement.'
        : access?.state === 'selection_required' ? 'Le service doit confirmer l’établissement concerné.'
        : 'L’accès à votre établissement reste à confirmer.'
      : oidcConnected ? 'La connexion au compte est présente ; l’accès au service reste à vérifier.' : 'Connectez votre compte partenaire pour vérifier votre accès.',
    badge: operational ? 'VALIDÉ' : identity ? 'À CONFIRMER' : oidcConnected ? 'À VÉRIFIER' : 'À CONNECTER',
    action: !oidcConnected ? 'connect' : input.session?.status === 401 ? 'refresh' : 'verify',
  };
}
