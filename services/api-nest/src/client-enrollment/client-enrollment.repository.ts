import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as path from 'node:path';

type Row = Record<string, unknown>;
type QueryResult<T extends Row = Row> = { rows: T[]; rowCount: number | null };
type Client = {
  query<T extends Row = Row>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
  release(): void;
};
type PoolLike = {
  connect(): Promise<Client>;
  query<T extends Row = Row>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
  end(): Promise<void>;
};
type PoolConstructor = new (options: Record<string, unknown>) => PoolLike;

const PG_MODULE = path.resolve(__dirname, '../../.runtime-vendor/pg-runtime/node_modules/pg');
const { Pool } = require(PG_MODULE) as { Pool: PoolConstructor };

export type ClientEnrollmentReservation = {
  emailHash: string;
  phoneHash: string;
  requesterHash: string;
  requestHash: string;
  emailProofHash: string;
  smsProofHash: string;
};

@Injectable()
export class ClientEnrollmentRepository implements OnModuleDestroy {
  private pool: PoolLike | null = null;

  private connection(): PoolLike {
    if (this.pool) return this.pool;
    const connectionString = String(process.env.DATABASE_URL || '');
    if (!connectionString) throw new Error('client_enrollment_database_not_configured');
    this.pool = new Pool({
      connectionString,
      max: 3,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      application_name: 'delishafrica-client-enrollment-v1',
    });
    return this.pool;
  }

  async reserve(input: ClientEnrollmentReservation): Promise<string | null> {
    const client = await this.connection().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        ['da-client-enrollment:' + input.emailHash],
      );
      const attempts = await client.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM public.da_client_enrollments WHERE requester_hmac=$1 AND created_at >= now() - interval \'1 hour\'',
        [input.requesterHash],
      );
      if (Number(attempts.rows[0]?.total || '0') >= 5) {
        await client.query('ROLLBACK');
        throw new Error('client_enrollment_rate_limit');
      }
      const result = await client.query<{ enrollment_id: string }>(
        'INSERT INTO public.da_client_enrollments (' +
        'email_hmac,phone_hmac,requester_hmac,request_hmac,email_proof_hmac,sms_proof_hmac,status' +
        ') VALUES ($1,$2,$3,$4,$5,$6,\'reserved\') ON CONFLICT DO NOTHING RETURNING enrollment_id::text',
        [
          input.emailHash,
          input.phoneHash,
          input.requesterHash,
          input.requestHash,
          input.emailProofHash,
          input.smsProofHash,
        ],
      );
      await client.query('COMMIT');
      return result.rows[0]?.enrollment_id || null;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(enrollmentId: string, subjectId: string): Promise<void> {
    const res = await this.connection().query(
      'UPDATE public.da_client_enrollments ' +
      'SET status=\'ready\',subject_id=$2,updated_at=now() ' +
      'WHERE enrollment_id=$1::uuid AND status=\'reserved\'',
      [enrollmentId, subjectId],
    );
    if (res.rowCount !== 1) throw new Error('client_enrollment_commit_unavailable');
  }

  async flagForReview(enrollmentId: string): Promise<void> {
    // Any ambiguous external side effect must block replay and require recovery.
    await this.connection().query(
      'UPDATE public.da_client_enrollments ' +
      'SET status=\'needs_review\',updated_at=now() ' +
      'WHERE enrollment_id=$1::uuid AND status IN (\'reserved\',\'ready\')',
      [enrollmentId],
    );
  }

  async onModuleDestroy(): Promise<void> {
    const existing = this.pool;
    this.pool = null;
    if (existing) await existing.end();
  }
}
