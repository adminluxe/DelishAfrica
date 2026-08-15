import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import type { DaAuthPrincipal } from '../auth/auth.types';
import { CatalogFoundationService } from '../catalog-foundation/catalog-foundation.service';
import type {
  MerchantCatalogDraftView,
  MerchantCatalogGateHealth,
  MerchantCatalogRequestContext,
  MerchantCatalogSummary,
  MerchantMembershipHealthView,
  MerchantMembershipMeView,
} from './merchant-catalog-gate.types';

@Injectable()
export class MerchantCatalogGateService {
  constructor(
    private readonly catalog: CatalogFoundationService,
    private readonly auth: AuthService,
  ) {}

  async health(): Promise<MerchantCatalogGateHealth> {
    const catalogHealth = await this.catalog.health();
    const membershipHealth = await this.catalog.membershipHealth();
    const trustedIdentity = this.auth.trustedIdentityHealth();

    return {
      ok: true,
      service: 'merchant-catalog-gate',
      guardReady: true,
      closedByDefault: true,
      trustedAuthRequired: true,
      trustedAuthAvailable: trustedIdentity.ready,
      devLoginOwnershipEligible: false,
      ownershipCount: catalogHealth.ownershipCount,
      readRoutesEnabled: true,
      draftWriteRoutesEnabled: false,
      publishRoutesEnabled: false,
      publicCatalogUnchangedUntilPublish: true,
      membershipFoundationReady: membershipHealth.ready,
      membershipCount: membershipHealth.membershipCount,
      activeMembershipCount: membershipHealth.activeMembershipCount,
      membershipEnforcementEnabled: false,
    };
  }

  async membershipHealth(): Promise<MerchantMembershipHealthView> {
    const foundation = await this.catalog.membershipHealth();

    return {
      ...foundation,
      closedByDefault: true,
      trustedExternalIdentityRequired: true,
      ownershipAutoCreated: false,
      draftWriteRoutesEnabled: false,
      publishRoutesEnabled: false,
    };
  }

  async membershipForPrincipal(
    principal: DaAuthPrincipal,
  ): Promise<MerchantMembershipMeView> {
    const memberships =
      await this.catalog.listMerchantMembershipsBySubject(
        principal.issuer,
        principal.subject,
      );
    const eligibleMembershipCount = memberships.filter(
      (membership) => membership.accessEligible,
    ).length;

    return {
      ok: true,
      identity: {
        issuer: principal.issuer,
        subject: principal.subject,
        role: 'merchant',
        authSource: 'external',
      },
      membershipEnforcementEnabled: false,
      ownershipAutoCreated: false,
      draftWriteRoutesEnabled: false,
      publishRoutesEnabled: false,
      accessEligible: eligibleMembershipCount > 0,
      eligibleMembershipCount,
      memberships,
    };
  }

  summary(context: MerchantCatalogRequestContext): MerchantCatalogSummary {
    const { ownership } = context;

    return {
      partnerId: ownership.partnerId,
      slug: ownership.slug,
      name: String(ownership.publishedPayload.name || ownership.slug),
      ownershipRole: ownership.ownershipRole,
      publishedRevision: ownership.publishedRevision,
      draftRevision: ownership.draftRevision,
      hasDraft: Boolean(ownership.draftPayload),
    };
  }

  draft(context: MerchantCatalogRequestContext): MerchantCatalogDraftView {
    const { ownership } = context;
    const hasDraft = Boolean(ownership.draftPayload);

    return {
      partnerId: ownership.partnerId,
      slug: ownership.slug,
      ownershipRole: ownership.ownershipRole,
      source: hasDraft ? 'draft' : 'published_baseline',
      draftRevision: ownership.draftRevision,
      publishedRevision: ownership.publishedRevision,
      writable: false,
      payload: ownership.draftPayload || ownership.publishedPayload,
    };
  }
}
