import type { DaAuthPrincipal } from '../auth/auth.types';
import type {
  CatalogOwnedPartnerContext,
  CatalogPartner,
  MerchantMembershipContext,
  MerchantMembershipFoundationHealth,
} from '../catalog-foundation/catalog-foundation.types';

export type MerchantCatalogRequestContext = {
  principal: DaAuthPrincipal;
  ownership: CatalogOwnedPartnerContext;
};

export type MerchantCatalogGateRequest = {
  headers?: Record<string, string | string[] | undefined>;
  daMerchantCatalogContext?: MerchantCatalogRequestContext;
};

export type MerchantCatalogGateHealth = {
  ok: true;
  service: 'merchant-catalog-gate';
  guardReady: true;
  closedByDefault: true;
  trustedAuthRequired: true;
  trustedAuthAvailable: boolean;
  devLoginOwnershipEligible: false;
  ownershipCount: number;
  readRoutesEnabled: true;
  draftWriteRoutesEnabled: false;
  publishRoutesEnabled: false;
  publicCatalogUnchangedUntilPublish: true;
  membershipFoundationReady: boolean;
  membershipCount: number;
  activeMembershipCount: number;
  membershipEnforcementEnabled: false;
};

export type MerchantCatalogSummary = {
  partnerId: string;
  slug: string;
  name: string;
  ownershipRole: string;
  publishedRevision: number;
  draftRevision: number;
  hasDraft: boolean;
};

export type MerchantCatalogDraftView = {
  partnerId: string;
  slug: string;
  ownershipRole: string;
  source: 'draft' | 'published_baseline';
  draftRevision: number;
  publishedRevision: number;
  writable: false;
  payload: CatalogPartner;
};

export type MerchantMembershipHealthView = MerchantMembershipFoundationHealth & {
  closedByDefault: true;
  trustedExternalIdentityRequired: true;
  ownershipAutoCreated: false;
  draftWriteRoutesEnabled: false;
  publishRoutesEnabled: false;
};

export type MerchantMembershipMeView = {
  ok: true;
  identity: {
    issuer: string;
    subject: string;
    role: 'merchant';
    authSource: 'external';
  };
  membershipEnforcementEnabled: false;
  ownershipAutoCreated: false;
  draftWriteRoutesEnabled: false;
  publishRoutesEnabled: false;
  accessEligible: boolean;
  eligibleMembershipCount: number;
  memberships: MerchantMembershipContext[];
};

