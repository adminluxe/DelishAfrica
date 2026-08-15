export type CatalogPartner = Record<string, unknown> & {
  id: string;
  slug: string;
  name: string;
};

export type CatalogFoundationHealth = {
  ok: boolean;
  service: 'catalog-foundation';
  mode: 'postgres' | 'static_fallback';
  ready: boolean;
  writeApiEnabled: false;
  publicWriteRoutes: false;
  partnerCount: number;
  ownershipCount: number;
  auditCount: number;
  schemaVersion: string | null;
  lastError: string | null;
};


export type CatalogOwnershipRole = 'owner' | 'manager' | 'editor' | 'viewer';

export type CatalogOwnedPartnerContext = {
  merchantSubject: string;
  partnerId: string;
  ownershipRole: CatalogOwnershipRole;
  slug: string;
  publishedPayload: CatalogPartner;
  draftPayload: CatalogPartner | null;
  publishedRevision: number;
  draftRevision: number;
};

export type MerchantMembershipRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'kitchen'
  | 'finance'
  | 'support';

export type MerchantMembershipStatus =
  | 'invited'
  | 'pending'
  | 'active'
  | 'suspended'
  | 'revoked'
  | 'expired';

export type MerchantContractStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'terminated'
  | 'expired';

export type MerchantKybStatus =
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'expired';

export type MerchantMembershipContext = {
  membershipId: string;
  issuer: string;
  subject: string;
  partnerId: string;
  slug: string;
  partnerLifecycleStatus: 'draft' | 'published' | 'suspended' | 'archived';
  membershipRole: MerchantMembershipRole;
  membershipStatus: MerchantMembershipStatus;
  contractStatus: MerchantContractStatus;
  kybStatus: MerchantKybStatus;
  startsAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  accessEligible: boolean;
};

export type MerchantMembershipFoundationHealth = {
  ok: boolean;
  service: 'merchant-membership-foundation';
  ready: boolean;
  schemaVersion: string | null;
  identitySubjectCount: number;
  membershipCount: number;
  activeMembershipCount: number;
  enforcementEnabled: false;
  writeRoutesEnabled: false;
  invitationRoutesEnabled: false;
  lastError: string | null;
};

