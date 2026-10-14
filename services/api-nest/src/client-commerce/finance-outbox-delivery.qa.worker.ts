/**
 * DelishAfrica P0 020 | isolated, opt-in QA outbox DELIVERY DRIVER.
 *
 * A bounded single iteration, NOT a daemon, Nest provider, AppModule import,
 * LIVE worker, provider payment request, webhook receiver, or payout.
 * At-least-once delivery: a failed ACK can cause re-delivery.
 * The separate consumer MUST deduplicate durably by eventId.
 */
export type QaOutboxEvent = Readonly<{
  eventId: string;
  orderId: string;
  eventKind: 'payment_captured' | 'financial_hold';
  sourceId: string;
}>;
export interface QaOutboxConsumer {
  apply(event: QaOutboxEvent): Promise<void>;
}
export type QaOutboxSql = Readonly<{
  query(sql: string, params: unknown[]): Promise<{
    rows: Record<string, unknown>[];
  }>;
}>;
type FailureCode =
  | 'consumer_timeout'
  | 'consumer_unavailable'
  | 'consumer_rejected';
const codes = new Set<string>([
  'consumer_timeout', 'consumer_unavailable', 'consumer_rejected',
]);
function isolatedQaOnly(): void {
  if (process.env.GITHUB_ACTIONS !== 'true' ||
      process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
      process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED !== 'YES' ||
      process.env.NODE_ENV === 'production') {
    throw Error('qa_finance_outbox_delivery_disconnected_ci_only');
  }
}
export class QaSyntheticOutboxDeliveryFailure extends Error {
  readonly safeCode: FailureCode;
  constructor(code: FailureCode) {
    super('qa_outbox_synthetic_consumer_failure');
    if (!codes.has(code)) throw Error('qa_outbox_failure_code_invalid');
    this.safeCode = code;
  }
}

export class QaIsolatedFinanceOutboxWorker {
  constructor(
    private readonly workerPool: QaOutboxSql,
    private readonly consumer: QaOutboxConsumer,
    private readonly workerId: string,
    private readonly leaseSeconds: number = 30,
  ) {
    isolatedQaOnly();
    if (!/^qa-worker-[a-z0-9-]{3,40}$/.test(workerId) ||
        !Number.isSafeInteger(leaseSeconds) ||
        leaseSeconds < 5 || leaseSeconds > 300 ||
        !workerPool || typeof workerPool.query !== 'function' ||
        !consumer || typeof consumer.apply !== 'function') {
      throw Error('qa_outbox_worker_parameters_invalid');
    }
  }

  async processOnce(limit: number = 10): Promise<Readonly<{
    claimed: number; acked: number; retry: number; dead: number;
  }>> {
    isolatedQaOnly();
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) {
      throw Error('qa_outbox_worker_limit_invalid');
    }
    const result = await this.workerPool.query(
      'SELECT * FROM public.da_qa_delivery_claim_020($1::text,$2::integer,$3::integer)',
      [this.workerId, limit, this.leaseSeconds],
    );
    let acked = 0, retry = 0, dead = 0;
    for (const row of result.rows) {
      const eventId = String(row.event_id || '');
      const orderId = String(row.order_id || '');
      const eventKind = String(row.event_kind || '');
      const sourceId = String(row.source_id || '');
      const token = String(row.lease_token || '');
      if (!/^[0-9a-f-]{36}$/.test(eventId) ||
          !/^[0-9a-f-]{36}$/.test(orderId) ||
          !/^[0-9a-f-]{36}$/.test(token) ||
          !['payment_captured','financial_hold'].includes(eventKind) ||
          !/^(ch_|re_|dp_)[A-Za-z0-9_]{6,120}$/.test(sourceId)) {
        throw Error('qa_outbox_leased_event_invalid');
      }
      try {
        await this.consumer.apply({
          eventId, orderId,
          eventKind: eventKind as QaOutboxEvent['eventKind'],
          sourceId,
        });
      } catch (err) {
        // Never put raw exception details or external payload in PostgreSQL.
        const code: FailureCode =
          err instanceof QaSyntheticOutboxDeliveryFailure
            ? err.safeCode : 'consumer_unavailable';
        const failed = await this.workerPool.query(
          'SELECT public.da_qa_delivery_fail_020(' +
          '$1::uuid,$2::text,$3::uuid,$4::text) AS state',
          [eventId,this.workerId,token,code],
        );
        const state = String(failed.rows[0]?.state || '');
        if (state === 'dead') dead++;
        else if (state === 'pending') retry++;
        else throw Error('qa_outbox_failure_status_invalid');
        continue;
      }
      // If this ACK fails after consumer success, DO NOT fake "exactly once":
      // the lease expires and consumer must use eventId to deduplicate replay.
      const receipt = await this.workerPool.query(
        'SELECT public.da_qa_delivery_ack_020(' +
        '$1::uuid,$2::text,$3::uuid) AS acknowledged',
        [eventId,this.workerId,token],
      );
      if (receipt.rows[0]?.acknowledged !== true) {
        throw Error('qa_outbox_ack_not_committed');
      }
      acked++;
    }
    return Object.freeze({
      claimed:result.rows.length, acked, retry, dead,
    });
  }
}
