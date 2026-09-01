import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as path from 'node:path';
import type {
  MerchantInvitationAcceptInput,
  MerchantInvitationAcceptResult,
  MerchantInvitationCreateInput,
  MerchantInvitationCreateResult,
  MerchantInvitationPreviewRecord,
} from './merchant-invitations.types';

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

@Injectable()
export class MerchantInvitationsRepository implements OnModuleDestroy {
  private pool: PoolLike | null = null;
  private readyPromise: Promise<PoolLike> | null = null;

  async createTransactional(
    input: MerchantInvitationCreateInput,
  ): Promise<MerchantInvitationCreateResult> {
    const pool = await this.ensurePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        [`merchant-invitation:${input.partnerId}:${input.recipientEmailHash}`],
      );

      const existing = await client.query<{
        invitation_id: string;
        invitation_status: string;
        delivery_status: string;
      }>(
        `SELECT i.invitation_id::text,
                i.invitation_status,
                COALESCE(o.delivery_status, 'pending') AS delivery_status
           FROM da_merchant_invitations i
           LEFT JOIN da_merchant_invitation_outbox o
             ON o.invitation_id = i.invitation_id
          WHERE i.idempotency_key_hash = $1
          ORDER BY o.outbox_id DESC NULLS LAST
          LIMIT 1`,
        [input.idempotencyKeyHash],
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return {
          invitationId: existing.rows[0].invitation_id,
          invitationStatus: existing.rows[0].invitation_status,
          outboxStatus: existing.rows[0].delivery_status,
          idempotentReplay: true,
        };
      }

      await client.query(
        `INSERT INTO da_merchant_invitations(
           invitation_id,
           partner_id,
           recipient_email_hash,
           recipient_email_ciphertext,
           recipient_email_key_id,
           token_hash,
           idempotency_key_hash,
           issued_by_subject_hash,
           membership_role,
           invitation_status,
           expires_at,
           queued_at
         ) VALUES (
           $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,'queued',$10,now()
         )`,
        [
          input.invitationId,
          input.partnerId,
          input.recipientEmailHash,
          input.recipientEmailCiphertext,
          input.recipientEmailKeyId,
          input.tokenHash,
          input.idempotencyKeyHash,
          input.issuedBySubjectHash,
          input.membershipRole,
          input.expiresAt,
        ],
      );

      await client.query(
        `INSERT INTO da_merchant_invitation_outbox(
           invitation_id,
           template_alias,
           payload_ciphertext,
           payload_key_id,
           payload_sha256,
           idempotency_key_hash,
           delivery_status
         ) VALUES ($1::uuid,$2,$3,$4,$5,$6,'pending')`,
        [
          input.invitationId,
          input.templateAlias,
          input.payloadCiphertext,
          input.payloadKeyId,
          input.payloadSha256,
          input.outboxIdempotencyKeyHash,
        ],
      );

      await client.query(
        `INSERT INTO da_merchant_invitation_audit(
           invitation_id,
           actor_subject_hash,
           action,
           request_id_hash,
           reason_code,
           metadata
         ) VALUES (
           $1::uuid,$2,'created',$3,'ops_signed_command',
           jsonb_build_object('authority_audit_id_hash',$4::text)
         )`,
        [
          input.invitationId,
          input.issuedBySubjectHash,
          input.requestIdHash,
          input.authorityAuditIdHash,
        ],
      );

      await client.query('COMMIT');
      return {
        invitationId: input.invitationId,
        invitationStatus: 'queued',
        outboxStatus: 'pending',
        idempotentReplay: false,
      };
    } catch (error) {
      await this.rollbackQuietly(client);
      throw new Error(this.sanitizeError(error));
    } finally {
      client.release();
    }
  }

  async previewByTokenHash(
    tokenHash: string,
  ): Promise<MerchantInvitationPreviewRecord | null> {
    const pool = await this.ensurePool();
    const result = await pool.query<{
      invitation_id: string;
      partner_id: string;
      partner_slug: string;
      partner_name: string;
      membership_role: MerchantInvitationPreviewRecord['membershipRole'];
      invitation_status: string;
      contract_status: string;
      kyb_status: string;
      expires_at: Date;
      accepted_at: Date | null;
      revoked_at: Date | null;
    }>(
      `SELECT i.invitation_id::text,
              i.partner_id,
              p.slug AS partner_slug,
              COALESCE(NULLIF(p.published_payload->>'name',''), p.slug) AS partner_name,
              i.membership_role,
              i.invitation_status,
              i.contract_status,
              i.kyb_status,
              i.expires_at,
              i.accepted_at,
              i.revoked_at
         FROM da_merchant_invitations i
         JOIN da_catalog_partners p ON p.partner_id = i.partner_id
        WHERE i.token_hash = $1
        LIMIT 1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      invitationId: row.invitation_id,
      partnerId: row.partner_id,
      partnerSlug: row.partner_slug,
      partnerName: row.partner_name,
      membershipRole: row.membership_role,
      invitationStatus: row.invitation_status,
      contractStatus: row.contract_status,
      kybStatus: row.kyb_status,
      expiresAt: new Date(row.expires_at),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    };
  }

  async acceptTransactional(
    input: MerchantInvitationAcceptInput,
  ): Promise<MerchantInvitationAcceptResult> {
    const pool = await this.ensurePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `merchant-invitation-accept:${input.tokenHash}`,
      ]);

      const invitationResult = await client.query<{
        invitation_id: string;
        partner_id: string;
        partner_slug: string;
        partner_name: string;
        recipient_email_hash: string;
        membership_role: string;
        invitation_status: string;
        contract_status: string;
        kyb_status: string;
        expires_at: Date;
        accepted_at: Date | null;
        revoked_at: Date | null;
      }>(
        `SELECT i.invitation_id::text,
                i.partner_id,
                p.slug AS partner_slug,
                COALESCE(NULLIF(p.published_payload->>'name',''), p.slug) AS partner_name,
                i.recipient_email_hash,
                i.membership_role,
                i.invitation_status,
                i.contract_status,
                i.kyb_status,
                i.expires_at,
                i.accepted_at,
                i.revoked_at
           FROM da_merchant_invitations i
           JOIN da_catalog_partners p ON p.partner_id = i.partner_id
          WHERE i.token_hash = $1
          FOR UPDATE OF i`,
        [input.tokenHash],
      );
      const invitation = invitationResult.rows[0];
      if (!invitation) throw new Error('invitation_invalid');
      if (invitation.recipient_email_hash !== input.principalEmailHash) {
        throw new Error('invitation_identity_email_mismatch');
      }
      if (invitation.revoked_at || invitation.invitation_status === 'revoked') {
        throw new Error('invitation_revoked');
      }
      if (
        invitation.invitation_status !== 'accepted' &&
        new Date(invitation.expires_at).getTime() <= Date.now()
      ) {
        throw new Error('invitation_expired');
      }
      if (['failed', 'expired'].includes(invitation.invitation_status)) {
        throw new Error(`invitation_${invitation.invitation_status}`);
      }

      await client.query(
        `INSERT INTO da_identity_subjects(
           issuer, subject, identity_kind, identity_status,
           first_seen_at, last_seen_at, created_at, updated_at
         ) VALUES ($1,$2,'merchant','active',now(),now(),now(),now())
         ON CONFLICT (issuer,subject) DO NOTHING`,
        [input.issuer, input.subject],
      );

      const identityResult = await client.query<{ identity_status: string }>(
        `SELECT identity_status
           FROM da_identity_subjects
          WHERE issuer=$1 AND subject=$2
          FOR UPDATE`,
        [input.issuer, input.subject],
      );
      if (!identityResult.rows[0]) throw new Error('identity_subject_missing');
      if (identityResult.rows[0].identity_status !== 'active') {
        throw new Error('identity_subject_not_active');
      }
      await client.query(
        `UPDATE da_identity_subjects
            SET last_seen_at=now(), updated_at=now()
          WHERE issuer=$1 AND subject=$2`,
        [input.issuer, input.subject],
      );

      const existingMembership = await client.query<{
        membership_id: string;
        membership_role: string;
        membership_status: string;
        contract_status: string;
        kyb_status: string;
        revoked_at: Date | null;
      }>(
        `SELECT membership_id::text,
                membership_role,
                membership_status,
                contract_status,
                kyb_status,
                revoked_at
           FROM da_merchant_memberships
          WHERE issuer=$1 AND subject=$2 AND partner_id=$3
          FOR UPDATE`,
        [input.issuer, input.subject, invitation.partner_id],
      );

      let membership = existingMembership.rows[0];
      let replay = invitation.invitation_status === 'accepted';
      if (membership) {
        if (
          membership.revoked_at ||
          ['revoked', 'expired', 'suspended'].includes(membership.membership_status)
        ) {
          throw new Error('membership_reactivation_requires_ops_review');
        }
      } else {
        if (replay) throw new Error('invitation_already_consumed');
        const inserted = await client.query<{
          membership_id: string;
          membership_role: string;
          membership_status: string;
          contract_status: string;
          kyb_status: string;
          revoked_at: Date | null;
        }>(
          `INSERT INTO da_merchant_memberships(
             issuer,
             subject,
             partner_id,
             membership_role,
             membership_status,
             contract_status,
             kyb_status,
             invited_by_subject,
             activated_by_subject,
             starts_at
           ) VALUES ($1,$2,$3,$4,'pending','active','pending',NULL,NULL,NULL)
           RETURNING membership_id::text,
                     membership_role,
                     membership_status,
                     contract_status,
                     kyb_status,
                     revoked_at`,
          [
            input.issuer,
            input.subject,
            invitation.partner_id,
            invitation.membership_role,
          ],
        );
        membership = inserted.rows[0];
      }
      if (!membership) throw new Error('membership_provisioning_failed');

      if (!replay) {
        await client.query(
          `UPDATE da_merchant_invitations
              SET invitation_status='accepted',
                  contract_status='accepted',
                  accepted_at=COALESCE(accepted_at,now()),
                  updated_at=now()
            WHERE invitation_id=$1::uuid`,
          [invitation.invitation_id],
        );
        await client.query(
          `INSERT INTO da_merchant_invitation_audit(
             invitation_id,
             actor_subject_hash,
             action,
             request_id_hash,
             reason_code,
             metadata
           ) VALUES (
             $1::uuid,$2,'accepted',$3,'merchant_oidc_contract_acceptance',
             jsonb_build_object(
               'membership_id',$4::text,
               'issuer_hash',$5::text,
               'subject_hash',$6::text,
               'membership_status',$7::text,
               'contract_status',$8::text,
               'kyb_status',$9::text
             )
           )`,
          [
            invitation.invitation_id,
            input.actorSubjectHash,
            input.requestIdHash,
            membership.membership_id,
            this.sha256Text(input.issuer),
            this.sha256Text(input.subject),
            membership.membership_status,
            membership.contract_status,
            membership.kyb_status,
          ],
        );
      }

      await client.query('COMMIT');
      return {
        invitationId: invitation.invitation_id,
        partnerId: invitation.partner_id,
        partnerSlug: invitation.partner_slug,
        partnerName: invitation.partner_name,
        membershipId: membership.membership_id,
        membershipRole: membership.membership_role,
        membershipStatus: membership.membership_status,
        contractStatus: membership.contract_status,
        kybStatus: membership.kyb_status,
        invitationStatus: 'accepted',
        invitationContractStatus: 'accepted',
        idempotentReplay: replay,
      };
    } catch (error) {
      await this.rollbackQuietly(client);
      throw new Error(this.sanitizeError(error));
    } finally {
      client.release();
    }
  }

  async dispatchOldestPending(
    handler: (record: { invitationId: string; templateAlias: string; payloadCiphertext: Buffer; payloadKeyId: string }) => Promise<{ messageId: string }>,
  ): Promise<{ dispatched: boolean; invitationId?: string; messageId?: string }> {
    const pool = await this.ensurePool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const lock = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked`,
        ['merchant-invitation-outbox-dispatch-v1'],
      );
      if (!lock.rows[0]?.locked) { await client.query('ROLLBACK'); return { dispatched: false }; }
      const pending = await client.query<{ outbox_id: string; invitation_id: string; template_alias: string; payload_ciphertext: Buffer; payload_key_id: string }>(
        `SELECT outbox_id::text, invitation_id::text, template_alias, payload_ciphertext, payload_key_id
           FROM da_merchant_invitation_outbox
          WHERE delivery_status = 'pending'
          ORDER BY outbox_id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1`,
      );
      const row = pending.rows[0];
      if (!row) { await client.query('COMMIT'); return { dispatched: false }; }
      const sent = await handler({ invitationId: row.invitation_id, templateAlias: row.template_alias, payloadCiphertext: row.payload_ciphertext, payloadKeyId: row.payload_key_id });
      await client.query(`UPDATE da_merchant_invitation_outbox SET delivery_status='sent' WHERE outbox_id=$1 AND delivery_status='pending'`, [row.outbox_id]);
      await client.query(`UPDATE da_merchant_invitations SET invitation_status='sent' WHERE invitation_id=$1::uuid AND invitation_status IN ('queued','pending')`, [row.invitation_id]);
      await client.query(
        `INSERT INTO da_merchant_invitation_audit(invitation_id, actor_subject_hash, action, reason_code, metadata)
         VALUES ($1::uuid,$2,'sent','postmark',jsonb_build_object('provider_message_id_hash',$3::text))`,
        [row.invitation_id, this.sha256Text('merchant-invitation-dispatcher-v1'), this.sha256Text(sent.messageId)],
      );
      await client.query('COMMIT');
      return { dispatched: true, invitationId: row.invitation_id, messageId: sent.messageId };
    } catch (error) {
      await this.rollbackQuietly(client);
      throw new Error(this.sanitizeError(error));
    } finally { client.release(); }
  }

  async onModuleDestroy(): Promise<void> {
    const pool = this.pool;
    this.pool = null;
    this.readyPromise = null;
    if (pool) await pool.end().catch(() => undefined);
  }

  private async ensurePool(): Promise<PoolLike> {
    if (this.pool) return this.pool;
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.createPool();
    try {
      this.pool = await this.readyPromise;
      return this.pool;
    } finally {
      this.readyPromise = null;
    }
  }

  private async createPool(): Promise<PoolLike> {
    const connectionString = String(process.env.DATABASE_URL || '').trim();
    if (!connectionString) throw new Error('merchant_invitation_database_url_missing');
    const pool = new Pool({
      connectionString,
      max: 4,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
      application_name: 'delishafrica-merchant-invitations-a5a3a7s9',
    });
    try {
      const result = await pool.query<{
        invitations: string | null;
        outbox: string | null;
        audit: string | null;
        identities: string | null;
        memberships: string | null;
        partners: string | null;
      }>(
        `SELECT
           to_regclass('public.da_merchant_invitations')::text AS invitations,
           to_regclass('public.da_merchant_invitation_outbox')::text AS outbox,
           to_regclass('public.da_merchant_invitation_audit')::text AS audit,
           to_regclass('public.da_identity_subjects')::text AS identities,
           to_regclass('public.da_merchant_memberships')::text AS memberships,
           to_regclass('public.da_catalog_partners')::text AS partners`,
      );
      const row = result.rows[0];
      if (
        !row?.invitations ||
        !row?.outbox ||
        !row?.audit ||
        !row?.identities ||
        !row?.memberships ||
        !row?.partners
      ) {
        throw new Error('merchant_invitation_acceptance_schema_missing');
      }
      return pool;
    } catch (error) {
      await pool.end().catch(() => undefined);
      throw new Error(this.sanitizeError(error));
    }
  }

  private async rollbackQuietly(client: PoolClient): Promise<void> {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best effort only.
    }
  }

  private sha256Text(value: string): string {
    const crypto = require('node:crypto') as typeof import('node:crypto');
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error || 'unknown_error');
    return message
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL_REDACTED]')
      .replace(/password=[^\s]+/gi, 'password=[REDACTED]')
      .replace(/[\r\n\t]/g, ' ')
      .slice(0, 240);
  }
}
