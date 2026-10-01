import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import * as path from 'node:path';

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

type JsonRecord = Record<string, any>;

@Injectable()
export class FinancialStateRepository implements OnModuleDestroy {
  private pool: PoolLike | null = null;
  private readyPromise: Promise<PoolLike> | null = null;

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end().catch(() => undefined);
    }
    this.pool = null;
    this.readyPromise = null;
  }

  async health() {
    try {
      const pool = await this.ensurePool();
      const result = await pool.query<{
        orders: string;
        payments: string;
        events: string;
      }>(
        `SELECT
           (SELECT count(*)::text FROM da_orders_state) AS orders,
           (SELECT count(*)::text FROM da_payment_authority_state) AS payments,
           (SELECT count(*)::text FROM da_financial_events) AS events`,
      );
      const row = result.rows[0] || { orders: '0', payments: '0', events: '0' };
      return {
        ok: true,
        backend: 'postgres',
        orders: Number(row.orders || 0),
        payments: Number(row.payments || 0),
        events: Number(row.events || 0),
      };
    } catch {
      return { ok: false, backend: 'postgres' };
    }
  }

  async listOrders(): Promise<JsonRecord[]> {
    const pool = await this.ensurePool();
    const result = await pool.query<{ payload: JsonRecord }>(
      `SELECT payload
         FROM da_orders_state
        ORDER BY COALESCE(
          NULLIF(payload->>'createdAt','')::timestamptz,
          mirrored_at
        ) DESC`,
    );
    return result.rows.map((row) => row.payload);
  }

  async findOrder(id: string): Promise<JsonRecord | null> {
    const key = String(id || '').trim();
    if (!key) return null;

    const pool = await this.ensurePool();
    const result = await pool.query<{ payload: JsonRecord }>(
      `SELECT payload
         FROM da_orders_state
        WHERE order_id = $1
           OR payload->>'id' = $1
           OR payload->>'orderId' = $1
           OR payload->>'publicId' = $1
        ORDER BY mirrored_at DESC
        LIMIT 1`,
      [key],
    );
    return result.rows[0]?.payload || null;
  }

  async upsertOrder(order: JsonRecord): Promise<void> {
    const orderId = String(
      order?.orderId || order?.id || order?.publicId || '',
    ).trim();
    if (!orderId) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'orders_postgres_order_id_required',
      });
    }

    const payment = order?.payment && typeof order.payment === 'object'
      ? order.payment
      : {};
    const total = Number.isFinite(Number(order?.total))
      ? Number(order.total)
      : Number.isFinite(Number(order?.amount))
        ? Number(order.amount)
        : null;

    const pool = await this.ensurePool();
    await pool.query(
      `INSERT INTO da_orders_state(
         order_id, merchant_slug, status, currency, total_value,
         payment_intent_id, payload, mirrored_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now())
       ON CONFLICT(order_id) DO UPDATE SET
         merchant_slug = EXCLUDED.merchant_slug,
         status = EXCLUDED.status,
         currency = EXCLUDED.currency,
         total_value = EXCLUDED.total_value,
         payment_intent_id = EXCLUDED.payment_intent_id,
         payload = EXCLUDED.payload,
         mirrored_at = now()`,
      [
        orderId,
        String(order?.merchantSlug || order?.partnerSlug || '') || null,
        String(order?.status || '') || null,
        String(order?.currency || '') || null,
        total,
        String(payment?.paymentIntentId || payment?.payment_intent_id || '') || null,
        JSON.stringify(order),
      ],
    );
  }

  async resetOrders(): Promise<void> {
    const pool = await this.ensurePool();
    await pool.query('DELETE FROM da_orders_state');
  }

  async findPaymentAuthority(paymentIntentId: string): Promise<JsonRecord | null> {
    const key = String(paymentIntentId || '').trim();
    if (!key) return null;
    const pool = await this.ensurePool();
    const result = await pool.query<{ payload: JsonRecord }>(
      `SELECT payload
         FROM da_payment_authority_state
        WHERE payment_intent_id = $1
        LIMIT 1`,
      [key],
    );
    return result.rows[0]?.payload || null;
  }

  async upsertPaymentAuthority(record: JsonRecord): Promise<void> {
    const paymentIntentId = String(record?.paymentIntentId || '').trim();
    const orderId = String(record?.orderId || '').trim();
    if (!paymentIntentId || !orderId) {
      throw new ServiceUnavailableException({
        ok: false,
        code: 'payment_postgres_identity_required',
      });
    }

    const pool = await this.ensurePool();
    await pool.query(
      `INSERT INTO da_payment_authority_state(
         payment_intent_id, order_id, client_mutation_id,
         principal, quote, last_stripe_status, payload, mirrored_at
       ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb,now())
       ON CONFLICT(payment_intent_id) DO UPDATE SET
         order_id = EXCLUDED.order_id,
         client_mutation_id = EXCLUDED.client_mutation_id,
         principal = EXCLUDED.principal,
         quote = EXCLUDED.quote,
         last_stripe_status = EXCLUDED.last_stripe_status,
         payload = EXCLUDED.payload,
         mirrored_at = now()`,
      [
        paymentIntentId,
        orderId,
        String(record?.clientMutationId || '') || null,
        JSON.stringify(record?.principal || {}),
        JSON.stringify(record?.quote || {}),
        String(record?.lastStripeStatus || '') || null,
        JSON.stringify(record),
      ],
    );
  }

  async recordFinancialEvent(input: {
    eventId: string;
    provider: string;
    eventType: string;
    orderId?: string | null;
    merchantSlug?: string | null;
    paymentIntentId?: string | null;
    currency?: string | null;
    amountValue?: number | null;
    payload?: JsonRecord;
    occurredAt?: string;
  }): Promise<void> {
    const eventId = String(input.eventId || '').trim();
    if (!eventId) return;

    const pool = await this.ensurePool();
    await pool.query(
      `INSERT INTO da_financial_events(
         event_id, provider, event_type, order_id, merchant_slug,
         payment_intent_id, currency, amount_value, payload, occurred_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::timestamptz)
       ON CONFLICT(event_id) DO NOTHING`,
      [
        eventId,
        input.provider,
        input.eventType,
        input.orderId || null,
        input.merchantSlug || null,
        input.paymentIntentId || null,
        input.currency || null,
        input.amountValue ?? null,
        JSON.stringify(input.payload || {}),
        input.occurredAt || new Date().toISOString(),
      ],
    );
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
        code: 'financial_state_database_url_missing',
      });
    }

    const pool = new Pool({
      connectionString,
      max: 8,
      min: 0,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
      application_name: 'delishafrica-financial-state-p0f',
    });

    try {
      const result = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN (
              'da_orders_state',
              'da_payment_authority_state',
              'da_financial_events'
            )`,
      );
      if (Number(result.rows[0]?.count || 0) !== 3) {
        throw new Error('financial_state_schema_missing');
      }
    } catch {
      await pool.end().catch(() => undefined);
      throw new ServiceUnavailableException({
        ok: false,
        code: 'financial_state_database_unavailable',
      });
    }

    this.pool = pool;
    return pool;
  }
}
