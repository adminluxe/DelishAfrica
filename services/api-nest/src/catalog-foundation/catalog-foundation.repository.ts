import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as path from 'node:path';
import type {
  CatalogFoundationHealth,
  CatalogOwnedPartnerContext,
  CatalogOwnershipRole,
  CatalogPartner,
  MerchantContractStatus,
  MerchantKybStatus,
  MerchantMembershipContext,
  MerchantMembershipFoundationHealth,
  MerchantMembershipRole,
  MerchantMembershipStatus,
} from './catalog-foundation.types';

type QueryResultRow = Record<string, unknown>;
type QueryResult<T extends QueryResultRow = QueryResultRow> = {
  rows: T[];
  rowCount: number | null;
};

type PoolClient = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
};

type PoolLike = {
  connect(): Promise<PoolClient>;
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
  end(): Promise<void>;
};

type PoolConstructor = new (config: Record<string, unknown>) => PoolLike;

const PG_VENDOR_MODULE = path.resolve(
  __dirname,
  '../../.runtime-vendor/pg-runtime/node_modules/pg',
);
const { Pool } = require(PG_VENDOR_MODULE) as { Pool: PoolConstructor };

const SCHEMA_VERSION = '34b4b5b2a5a2_001';

@Injectable()
export class CatalogFoundationRepository implements OnModuleDestroy {
  private pool: PoolLike | null = null;
  private ready = false;
  private lastError: string | null = null;

  async initialize(seedPartners: CatalogPartner[]): Promise<void> {
    if (this.ready) return;

    const connectionString = String(process.env.DATABASE_URL || '').trim();
    if (!connectionString) {
      this.lastError = 'database_url_missing';
      return;
    }

    const pool = new Pool({
      connectionString,
      max: 5,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
      application_name: 'delishafrica-catalog-foundation-34b3',
    });

    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await this.verifySchema(client);
      await this.seedPublishedPartners(client, seedPartners);
      await client.query('COMMIT');
      this.pool = pool;
      this.ready = true;
      this.lastError = null;
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Rollback best effort only.
        }
      }
      await pool.end().catch(() => undefined);
      this.pool = null;
      this.ready = false;
      this.lastError = this.sanitizeError(error);
    } finally {
      client?.release();
    }
  }

  async listPublished(): Promise<CatalogPartner[]> {
    if (!this.pool || !this.ready) return [];

    const result = await this.pool.query<{ published_payload: CatalogPartner }>(
      `SELECT published_payload
         FROM da_catalog_partners
        WHERE lifecycle_status = 'published'
        ORDER BY display_order ASC, slug ASC`,
    );

    return result.rows.map((row) => row.published_payload);
  }

  async findPublishedBySlug(slug: string): Promise<CatalogPartner | null> {
    if (!this.pool || !this.ready) return null;

    const result = await this.pool.query<{ published_payload: CatalogPartner }>(
      `SELECT published_payload
         FROM da_catalog_partners
        WHERE slug = $1
          AND lifecycle_status = 'published'
        LIMIT 1`,
      [slug],
    );

    return result.rows[0]?.published_payload || null;
  }


  async listOwnedBySubject(
    merchantSubject: string,
  ): Promise<CatalogOwnedPartnerContext[]> {
    if (!this.pool || !this.ready) return [];

    const subject = String(merchantSubject || '').trim();
    if (!subject) return [];

    const result = await this.pool.query<
      QueryResultRow & {
        merchant_subject: string;
        partner_id: string;
        ownership_role: CatalogOwnershipRole;
        slug: string;
        published_payload: CatalogPartner;
        draft_payload: CatalogPartner | null;
        published_revision: number;
        draft_revision: number;
      }
    >(
      `SELECT
         ownership.merchant_subject,
         ownership.partner_id,
         ownership.ownership_role,
         partner.slug,
         partner.published_payload,
         partner.draft_payload,
         partner.published_revision,
         partner.draft_revision
       FROM da_catalog_ownerships AS ownership
       INNER JOIN da_catalog_partners AS partner
         ON partner.partner_id = ownership.partner_id
       WHERE ownership.merchant_subject = $1
         AND ownership.active = true
         AND partner.lifecycle_status <> 'archived'
       ORDER BY partner.display_order ASC, partner.slug ASC`,
      [subject],
    );

    return result.rows.map((row) => ({
      merchantSubject: row.merchant_subject,
      partnerId: row.partner_id,
      ownershipRole: row.ownership_role,
      slug: row.slug,
      publishedPayload: row.published_payload,
      draftPayload: row.draft_payload,
      publishedRevision: Number(row.published_revision),
      draftRevision: Number(row.draft_revision),
    }));
  }


  async listMerchantMembershipsBySubject(
    issuer: string,
    subject: string,
  ): Promise<MerchantMembershipContext[]> {
    if (!this.pool || !this.ready) return [];

    const normalizedIssuer = String(issuer || '').trim();
    const normalizedSubject = String(subject || '').trim();
    if (!normalizedIssuer || !normalizedSubject) return [];

    const result = await this.pool.query<
      QueryResultRow & {
        membership_id: string;
        issuer: string;
        subject: string;
        partner_id: string;
        slug: string;
        partner_lifecycle_status:
          | 'draft'
          | 'published'
          | 'suspended'
          | 'archived';
        membership_role: MerchantMembershipRole;
        membership_status: MerchantMembershipStatus;
        contract_status: MerchantContractStatus;
        kyb_status: MerchantKybStatus;
        starts_at: Date | string | null;
        expires_at: Date | string | null;
        revoked_at: Date | string | null;
        created_at: Date | string;
        updated_at: Date | string;
        access_eligible: boolean;
      }
    >(
      `SELECT
         membership.membership_id::text,
         membership.issuer,
         membership.subject,
         membership.partner_id,
         partner.slug,
         partner.lifecycle_status AS partner_lifecycle_status,
         membership.membership_role,
         membership.membership_status,
         membership.contract_status,
         membership.kyb_status,
         membership.starts_at,
         membership.expires_at,
         membership.revoked_at,
         membership.created_at,
         membership.updated_at,
         (
           membership.membership_status = 'active'
           AND membership.contract_status = 'active'
           AND membership.kyb_status = 'verified'
           AND membership.revoked_at IS NULL
           AND (membership.starts_at IS NULL OR membership.starts_at <= now())
           AND (membership.expires_at IS NULL OR membership.expires_at > now())
           AND partner.lifecycle_status IN ('draft', 'published')
         ) AS access_eligible
       FROM da_merchant_memberships AS membership
       INNER JOIN da_catalog_partners AS partner
         ON partner.partner_id = membership.partner_id
       WHERE membership.issuer = $1
         AND membership.subject = $2
       ORDER BY partner.display_order ASC, partner.slug ASC`,
      [normalizedIssuer, normalizedSubject],
    );

    const iso = (value: Date | string | null): string | null => {
      if (value === null) return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };

    return result.rows.map((row) => ({
      membershipId: row.membership_id,
      issuer: row.issuer,
      subject: row.subject,
      partnerId: row.partner_id,
      slug: row.slug,
      partnerLifecycleStatus: row.partner_lifecycle_status,
      membershipRole: row.membership_role,
      membershipStatus: row.membership_status,
      contractStatus: row.contract_status,
      kybStatus: row.kyb_status,
      startsAt: iso(row.starts_at),
      expiresAt: iso(row.expires_at),
      revokedAt: iso(row.revoked_at),
      createdAt: iso(row.created_at) || '',
      updatedAt: iso(row.updated_at) || '',
      accessEligible: row.access_eligible === true,
    }));
  }

  async membershipHealth(): Promise<MerchantMembershipFoundationHealth> {
    if (!this.pool || !this.ready) {
      return {
        ok: false,
        service: 'merchant-membership-foundation',
        ready: false,
        schemaVersion: null,
        identitySubjectCount: 0,
        membershipCount: 0,
        activeMembershipCount: 0,
        enforcementEnabled: false,
        writeRoutesEnabled: false,
        invitationRoutesEnabled: false,
        lastError: this.lastError,
      };
    }

    try {
      const result = await this.pool.query<
        QueryResultRow & {
          identity_subject_count: string;
          membership_count: string;
          active_membership_count: string;
          schema_version: string | null;
        }
      >(
        `SELECT
           (SELECT COUNT(*)::text FROM da_identity_subjects) AS identity_subject_count,
           (SELECT COUNT(*)::text FROM da_merchant_memberships) AS membership_count,
           (
             SELECT COUNT(*)::text
             FROM da_merchant_memberships
             WHERE membership_status = 'active'
               AND contract_status = 'active'
               AND kyb_status = 'verified'
               AND revoked_at IS NULL
               AND (starts_at IS NULL OR starts_at <= now())
               AND (expires_at IS NULL OR expires_at > now())
           ) AS active_membership_count,
           (
             SELECT version
             FROM da_catalog_schema_migrations
             WHERE version = $1
             LIMIT 1
           ) AS schema_version`,
        [SCHEMA_VERSION],
      );

      const row = result.rows[0];
      return {
        ok: row?.schema_version === SCHEMA_VERSION,
        service: 'merchant-membership-foundation',
        ready: row?.schema_version === SCHEMA_VERSION,
        schemaVersion: row?.schema_version || null,
        identitySubjectCount: Number.parseInt(
          row?.identity_subject_count || '0',
          10,
        ),
        membershipCount: Number.parseInt(row?.membership_count || '0', 10),
        activeMembershipCount: Number.parseInt(
          row?.active_membership_count || '0',
          10,
        ),
        enforcementEnabled: false,
        writeRoutesEnabled: false,
        invitationRoutesEnabled: false,
        lastError: null,
      };
    } catch (error) {
      this.lastError = this.sanitizeError(error);
      return {
        ok: false,
        service: 'merchant-membership-foundation',
        ready: false,
        schemaVersion: null,
        identitySubjectCount: 0,
        membershipCount: 0,
        activeMembershipCount: 0,
        enforcementEnabled: false,
        writeRoutesEnabled: false,
        invitationRoutesEnabled: false,
        lastError: this.lastError,
      };
    }
  }

  async health(): Promise<CatalogFoundationHealth> {
    if (!this.pool || !this.ready) {
      return {
        ok: false,
        service: 'catalog-foundation',
        mode: 'static_fallback',
        ready: false,
        writeApiEnabled: false,
        publicWriteRoutes: false,
        partnerCount: 0,
        ownershipCount: 0,
        auditCount: 0,
        schemaVersion: null,
        lastError: this.lastError,
      };
    }

    try {
      const result = await this.pool.query<
        QueryResultRow & {
          partner_count: string;
          ownership_count: string;
          audit_count: string;
          schema_version: string | null;
        }
      >(
        `SELECT
           (SELECT COUNT(*)::text FROM da_catalog_partners) AS partner_count,
           (SELECT COUNT(*)::text FROM da_catalog_ownerships WHERE active = true) AS ownership_count,
           (SELECT COUNT(*)::text FROM da_catalog_audit) AS audit_count,
           (SELECT version FROM da_catalog_schema_migrations ORDER BY applied_at DESC LIMIT 1) AS schema_version`,
      );
      const row = result.rows[0];

      return {
        ok: true,
        service: 'catalog-foundation',
        mode: 'postgres',
        ready: true,
        writeApiEnabled: false,
        publicWriteRoutes: false,
        partnerCount: Number.parseInt(row?.partner_count || '0', 10),
        ownershipCount: Number.parseInt(row?.ownership_count || '0', 10),
        auditCount: Number.parseInt(row?.audit_count || '0', 10),
        schemaVersion: row?.schema_version || null,
        lastError: null,
      };
    } catch (error) {
      this.lastError = this.sanitizeError(error);
      return {
        ok: false,
        service: 'catalog-foundation',
        mode: 'static_fallback',
        ready: false,
        writeApiEnabled: false,
        publicWriteRoutes: false,
        partnerCount: 0,
        ownershipCount: 0,
        auditCount: 0,
        schemaVersion: null,
        lastError: this.lastError,
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    const pool = this.pool;
    this.pool = null;
    this.ready = false;
    if (pool) await pool.end().catch(() => undefined);
  }

  private async verifySchema(client: PoolClient): Promise<void> {
    const result = await client.query<
      QueryResultRow & {
        migration_ready: boolean;
        partners_ready: boolean;
        ownerships_ready: boolean;
        identities_ready: boolean;
        memberships_ready: boolean;
        audit_ready: boolean;
        audit_guard_ready: boolean;
        audit_trigger_ready: boolean;
        partner_lifecycle_index_ready: boolean;
        ownership_subject_index_ready: boolean;
        identity_status_index_ready: boolean;
        membership_subject_index_ready: boolean;
        membership_partner_index_ready: boolean;
        audit_partner_index_ready: boolean;
      }
    >(
      `SELECT
         EXISTS(
           SELECT 1
           FROM da_catalog_schema_migrations
           WHERE version = $1
         ) AS migration_ready,
         to_regclass('da_catalog_partners') IS NOT NULL AS partners_ready,
         to_regclass('da_catalog_ownerships') IS NOT NULL AS ownerships_ready,
         to_regclass('da_identity_subjects') IS NOT NULL AS identities_ready,
         to_regclass('da_merchant_memberships') IS NOT NULL AS memberships_ready,
         to_regclass('da_catalog_audit') IS NOT NULL AS audit_ready,
         to_regprocedure('da_catalog_audit_immutable_guard()') IS NOT NULL
           AS audit_guard_ready,
         EXISTS(
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = to_regclass('da_catalog_audit')
             AND tgname = 'da_catalog_audit_immutable'
             AND NOT tgisinternal
         ) AS audit_trigger_ready,
         to_regclass('da_catalog_partners_lifecycle_idx') IS NOT NULL
           AS partner_lifecycle_index_ready,
         to_regclass('da_catalog_ownerships_subject_idx') IS NOT NULL
           AS ownership_subject_index_ready,
         to_regclass('da_identity_subjects_status_idx') IS NOT NULL
           AS identity_status_index_ready,
         to_regclass('da_merchant_memberships_subject_idx') IS NOT NULL
           AS membership_subject_index_ready,
         to_regclass('da_merchant_memberships_partner_idx') IS NOT NULL
           AS membership_partner_index_ready,
         to_regclass('da_catalog_audit_partner_created_idx') IS NOT NULL
           AS audit_partner_index_ready`,
      [SCHEMA_VERSION],
    );

    const row = result.rows[0];
    const ready = Boolean(
      row?.migration_ready &&
        row.partners_ready &&
        row.ownerships_ready &&
        row.identities_ready &&
        row.memberships_ready &&
        row.audit_ready &&
        row.audit_guard_ready &&
        row.audit_trigger_ready &&
        row.partner_lifecycle_index_ready &&
        row.ownership_subject_index_ready &&
        row.identity_status_index_ready &&
        row.membership_subject_index_ready &&
        row.membership_partner_index_ready &&
        row.audit_partner_index_ready,
    );

    if (!ready) {
      throw new Error('catalog_schema_not_ready');
    }
  }

  private async seedPublishedPartners(
    client: PoolClient,
    partners: CatalogPartner[],
  ): Promise<void> {
    for (let index = 0; index < partners.length; index += 1) {
      const partner = partners[index];
      await client.query(
        `INSERT INTO da_catalog_partners(
           partner_id,
           slug,
           lifecycle_status,
           published_payload,
           published_revision,
           display_order
         )
         VALUES ($1, $2, 'published', $3::jsonb, 1, $4)
         ON CONFLICT (slug) DO NOTHING`,
        [partner.id, partner.slug, JSON.stringify(partner), index],
      );
    }
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error || 'unknown_error');
    return message
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL_REDACTED]')
      .replace(/password=[^\s]+/gi, 'password=[REDACTED]')
      .slice(0, 300);
  }
}
