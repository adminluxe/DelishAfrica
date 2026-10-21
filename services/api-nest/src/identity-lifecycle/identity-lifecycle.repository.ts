import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as path from 'node:path';
import type {
  AccountDeletionApplication,
  AccountDeletionRecord,
  AccountDeletionStatus,
} from './identity-lifecycle.types';

type Row = Record<string, unknown>;
type QueryResult<T extends Row = Row> = { rows: T[]; rowCount: number | null };
type PoolLike = {
  query<T extends Row = Row>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
  end(): Promise<void>;
};
type PoolConstructor = new (config: Record<string, unknown>) => PoolLike;

const PG_VENDOR_MODULE = path.resolve(
  __dirname,
  '../../.runtime-vendor/pg-runtime/node_modules/pg',
);
const { Pool } = require(PG_VENDOR_MODULE) as { Pool: PoolConstructor };

type DeletionRow = Row & {
  request_id: string;
  application: AccountDeletionApplication;
  identity_fingerprint: string;
  idempotency_key_hash: string;
  status: AccountDeletionStatus;
  requested_at: Date | string;
  completion_deadline: Date | string;
  completed_at: Date | string | null;
  retention_acknowledged: boolean;
  auth_source: string;
};

@Injectable()
export class IdentityLifecycleRepository implements OnModuleDestroy {
  private pool: PoolLike | null = null;
  private readyPromise: Promise<PoolLike> | null = null;

  async onModuleDestroy(): Promise<void> {
    const pool = this.pool;
    this.pool = null;
    this.readyPromise = null;
    if (pool) await pool.end().catch(() => undefined);
  }

  async health(): Promise<{
    ok: boolean;
    backend: 'postgres';
    schemaReady: boolean;
    failClosed: true;
  }> {
    try {
      const pool = await this.ensurePool();
      const result = await pool.query<{ ready: boolean }>(
        `SELECT to_regclass('public.da_account_deletion_requests') IS NOT NULL AS ready`,
      );
      return {
        ok: result.rows[0]?.ready === true,
        backend: 'postgres',
        schemaReady: result.rows[0]?.ready === true,
        failClosed: true,
      };
    } catch {
      return { ok: false, backend: 'postgres', schemaReady: false, failClosed: true };
    }
  }

  async createOrRead(input: AccountDeletionRecord): Promise<{
    record: AccountDeletionRecord;
    created: boolean;
  }> {
    const pool = await this.ensurePool();
    try {
      const inserted = await pool.query<DeletionRow>(
        `INSERT INTO da_account_deletion_requests(
           request_id,
           application,
           identity_fingerprint,
           idempotency_key_hash,
           status,
           requested_at,
           completion_deadline,
           completed_at,
           retention_acknowledged,
           auth_source
         ) VALUES ($1::uuid,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8::timestamptz,$9,$10)
         ON CONFLICT(idempotency_key_hash) DO NOTHING
         RETURNING *`,
        [
          input.requestId,
          input.application,
          input.identityFingerprint,
          input.idempotencyKeyHash,
          input.status,
          input.requestedAt,
          input.completionDeadline,
          input.completedAt,
          input.retentionAcknowledged,
          input.authSource,
        ],
      );
      if (inserted.rows[0]) {
        return { record: this.map(inserted.rows[0]), created: true };
      }

      const existing = await pool.query<DeletionRow>(
        `SELECT *
           FROM da_account_deletion_requests
          WHERE idempotency_key_hash = $1
          LIMIT 1`,
        [input.idempotencyKeyHash],
      );
      if (!existing.rows[0]) throw new Error('account_deletion_idempotency_race');
      return { record: this.map(existing.rows[0]), created: false };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({
        ok: false,
        code: 'account_deletion_persistence_unavailable',
      });
    }
  }

  async listForIdentity(
    application: AccountDeletionApplication,
    fingerprint: string,
  ): Promise<AccountDeletionRecord[]> {
    const pool = await this.ensurePool();
    try {
      const result = await pool.query<DeletionRow>(
        `SELECT *
           FROM da_account_deletion_requests
          WHERE application = $1
            AND identity_fingerprint = $2
          ORDER BY requested_at DESC
          LIMIT 20`,
        [application, fingerprint],
      );
      return result.rows.map((row) => this.map(row));
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'account_deletion_persistence_unavailable',
      });
    }
  }

  private async ensurePool(): Promise<PoolLike> {
    if (this.pool) return this.pool;
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this.connect();
    try {
      return await this.readyPromise;
    } finally {
      this.readyPromise = null;
    }
  }

  private async connect(): Promise<PoolLike> {
    const connectionString = String(process.env.DATABASE_URL || '').trim();
    if (!connectionString) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'account_deletion_database_url_missing',
      });
    }

    const pool = new Pool({
      connectionString,
      max: 4,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
      application_name: 'delishafrica-identity-lifecycle-v1',
    });

    try {
      const result = await pool.query<{ ready: boolean }>(
        `SELECT to_regclass('public.da_account_deletion_requests') IS NOT NULL AS ready`,
      );
      if (result.rows[0]?.ready !== true) throw new Error('identity_lifecycle_schema_missing');
    } catch {
      await pool.end().catch(() => undefined);
      throw new ServiceUnavailableException({
        ok: false,
        code: 'account_deletion_database_unavailable',
      });
    }

    this.pool = pool;
    return pool;
  }

  private map(row: DeletionRow): AccountDeletionRecord {
    const iso = (value: Date | string | null): string | null => {
      if (value === null) return null;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    };
    return {
      requestId: row.request_id,
      application: row.application,
      identityFingerprint: row.identity_fingerprint,
      idempotencyKeyHash: row.idempotency_key_hash,
      status: row.status,
      requestedAt: iso(row.requested_at) || '',
      completionDeadline: iso(row.completion_deadline) || '',
      completedAt: iso(row.completed_at),
      retentionAcknowledged: true,
      authSource: 'external',
    };
  }
}
