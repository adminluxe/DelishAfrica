import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as path from 'node:path';
import type {
  OpsAuthorityPersistenceDecision,
  OpsAuthorityPersistenceInput,
} from './ops-authority.types';

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
export class OpsAuthorityRepository implements OnModuleDestroy {
  private pool: PoolLike | null = null;
  private readyPromise: Promise<PoolLike> | null = null;

  async consumeNonceAndAudit(
    input: OpsAuthorityPersistenceInput,
  ): Promise<OpsAuthorityPersistenceDecision> {
    const pool = await this.ensurePool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM da_ops_authority_nonces
          WHERE expires_at < now() - interval '5 minutes'`,
      );

      const result = await client.query<{
        accepted: boolean;
        outcome: 'accepted' | 'replay_rejected';
        audit_id: string;
      }>(
        `WITH inserted AS (
           INSERT INTO da_ops_authority_nonces(
             nonce_hash,
             principal_hash,
             key_id,
             request_timestamp,
             expires_at
           )
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (nonce_hash) DO NOTHING
           RETURNING nonce_hash
         ), audit_row AS (
           INSERT INTO da_ops_authority_audit(
             nonce_hash,
             principal_hash,
             key_id,
             auth_method,
             request_method,
             request_path,
             body_sha256,
             request_timestamp,
             outcome,
             reason_code
           )
           SELECT
             $1,
             $2,
             $3,
             $6,
             $7,
             $8,
             $9,
             $4,
             CASE
               WHEN EXISTS (SELECT 1 FROM inserted) THEN 'accepted'
               ELSE 'replay_rejected'
             END,
             CASE
               WHEN EXISTS (SELECT 1 FROM inserted) THEN 'verified_and_consumed'
               ELSE 'nonce_already_consumed'
             END
           RETURNING audit_id::text, outcome
         )
         SELECT
           (outcome = 'accepted') AS accepted,
           outcome,
           audit_id
         FROM audit_row`,
        [
          input.nonceHash,
          input.principalHash,
          input.keyId,
          input.requestTimestamp,
          input.expiresAt,
          input.authMethod,
          input.requestMethod,
          input.requestPath,
          input.bodySha256,
        ],
      );

      const row = result.rows[0];
      if (!row || !row.audit_id) {
        throw new Error('ops_authority_audit_result_missing');
      }

      await client.query('COMMIT');
      return {
        accepted: row.accepted === true,
        outcome: row.outcome,
        auditId: row.audit_id,
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Best-effort rollback only.
      }
      throw new Error(this.sanitizeError(error));
    } finally {
      client.release();
    }
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
    if (!connectionString) {
      throw new Error('ops_authority_database_url_missing');
    }

    const pool = new Pool({
      connectionString,
      max: 5,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
      application_name: 'delishafrica-ops-authority-a5a3a6',
    });

    try {
      const result = await pool.query<{
        nonce_table: string | null;
        audit_table: string | null;
      }>(
        `SELECT
           to_regclass('public.da_ops_authority_nonces')::text AS nonce_table,
           to_regclass('public.da_ops_authority_audit')::text AS audit_table`,
      );
      const row = result.rows[0];
      if (!row?.nonce_table || !row?.audit_table) {
        throw new Error('ops_authority_schema_missing');
      }
      return pool;
    } catch (error) {
      await pool.end().catch(() => undefined);
      throw new Error(this.sanitizeError(error));
    }
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error || 'unknown_error');
    return message
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL_REDACTED]')
      .replace(/password=[^\s]+/gi, 'password=[REDACTED]')
      .slice(0, 240);
  }
}
