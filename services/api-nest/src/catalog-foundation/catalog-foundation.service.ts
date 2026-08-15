import { Injectable } from '@nestjs/common';
import { CatalogFoundationRepository } from './catalog-foundation.repository';
import type {
  CatalogFoundationHealth,
  CatalogOwnedPartnerContext,
  CatalogPartner,
  MerchantMembershipContext,
  MerchantMembershipFoundationHealth,
} from './catalog-foundation.types';

@Injectable()
export class CatalogFoundationService {
  private initialized = false;

  constructor(private readonly repository: CatalogFoundationRepository) {}

  async initialize(seedPartners: CatalogPartner[]): Promise<void> {
    if (this.initialized) return;
    await this.repository.initialize(seedPartners);
    this.initialized = true;
  }

  async listPublished(staticFallback: CatalogPartner[]): Promise<CatalogPartner[]> {
    try {
      const persisted = await this.repository.listPublished();
      return persisted.length > 0 ? persisted : staticFallback;
    } catch {
      return staticFallback;
    }
  }

  async findPublishedBySlug(
    slug: string,
    staticFallback: CatalogPartner[],
  ): Promise<CatalogPartner | null> {
    try {
      const persisted = await this.repository.findPublishedBySlug(slug);
      if (persisted) return persisted;
    } catch {
      // Preserve the current Client catalogue during any database incident.
    }

    return staticFallback.find((partner) => partner.slug === slug) || null;
  }

  async listOwnedBySubject(
    merchantSubject: string,
  ): Promise<CatalogOwnedPartnerContext[]> {
    return this.repository.listOwnedBySubject(merchantSubject);
  }

  async listMerchantMembershipsBySubject(
    issuer: string,
    subject: string,
  ): Promise<MerchantMembershipContext[]> {
    return this.repository.listMerchantMembershipsBySubject(issuer, subject);
  }

  async membershipHealth(): Promise<MerchantMembershipFoundationHealth> {
    return this.repository.membershipHealth();
  }

  async health(): Promise<CatalogFoundationHealth> {
    return this.repository.health();
  }
}
