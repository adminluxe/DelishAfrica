import { randomBytes } from 'node:crypto';
import type { GuestSqlExecutor } from './guest-checkout-ledger';
import type { GuestTransactionalDb } from './guest-stripe-financial-finalizer';
import type { GuestIntentTransport, GuestTransportIntent } from './guest-stripe-intent-reservation';

/**
 * P5-E, LAB ONLY. Durable, PII-free Ops incident scanner.
 * No HTTP controller. NEVER creates, confirms, refunds or cancels Stripe
 * PaymentIntents, and NEVER releases an order to Merchant or Courier.
 *
 * A P3 financial finalizer may be injected to reconcile independently
 * verified captured payments in an existing BOUND reservation.
 */
type TransactionalSql = GuestSqlExecutor & GuestTransactionalDb;
type TransactionClient = Awaited<ReturnType<GuestTransactionalDb['connect']>>;
type SourceRow = {
  order_id: string;
  reservation_state: string;
  stripe_intent_id: string | null;
  session_intent_id: string | null;
  session_state: string;
  quoted_amount_cents: number | string;
  quoted_currency: string;
  quote_fingerprint: string;
  guest_subject: string;
  mutation_id: string;
  reconciliation_reason: string | null;
  check_count: number | string;
};
type AlertDecision =
  'retry_scheduled' | 'operator_action_required' |
  'verified_cancelled' | 'financially_committed';
type Priority = 'normal' | 'high' | 'critical';
type Review = {
  decision: AlertDecision;
  reason: string;
  priority: Priority;
  providerStatus: string | null;
};
export type GuestReconciliationSummary = Readonly<{
  inspected: number;
  retryScheduled: number;
  operatorActionRequired: number;
  verifiedCancelled: number;
  financiallyCommitted: number;
  staleOrSuperseded: number;
}>;

export type GuestReadonlyStripeIntent = Pick<GuestIntentTransport, 'getIntent' | 'mode'>;
export type VerifiedGuestFinancialCommit = {
  reconcileTrustedStripeIntent(intentId: string, eventId?: string): Promise<{
    ok: true;
    paymentIntentId: string;
    orderId: string;
  }>;
};
const ORDER = /^DA-G-[a-f0-9]{32}$/;
const INTENT = /^pi_[A-Za-z0-9_]{8,192}$/;
const FINGERPRINT = /^[a-f0-9]{64}$/;
const ISSUE = /^[a-z][a-z0-9_]{4,79}$/;

const immediateReview=(reason:string, priority:Priority='critical'):Review=>
  ({decision:'operator_action_required',reason,priority,providerStatus:null});

function verifyAuthoritativeProvider(
  intent: GuestTransportIntent | null,
  source: SourceRow,
  id: string,
): boolean {
  const metadata=intent?.metadata;
  return Boolean(intent && intent.id===id && intent.livemode===false &&
    Number.isSafeInteger(intent.amount) &&
    intent.amount===Number(source.quoted_amount_cents) &&
    intent.currency===String(source.quoted_currency).trim().toLowerCase() &&
    metadata && metadata.orderId===source.order_id &&
    metadata.clientSubject===source.guest_subject &&
    metadata.clientMutationId===source.mutation_id &&
    metadata.quoteFingerprint===source.quote_fingerprint &&
    metadata.clientIssuer==='urn:delishafrica:guest-checkout:v1' &&
    metadata.source==='delishafrica-guest-checkout');
}

function backoffMinutes(count:number):number {
  return Math.min(60,5*Math.pow(2,Math.min(4,Math.max(0,count-1))));
}

export class GuestPaymentReconciliationMonitor {
  constructor(
    private readonly db:TransactionalSql,
    private readonly provider:GuestReadonlyStripeIntent,
    private readonly finalizer?:VerifiedGuestFinancialCommit,
  ) {
    if(provider.mode!=='test')throw new Error('guest_monitor_test_transport_required');
  }

  private testOnly():void {
    if(process.env.NODE_ENV==='production' ||
       process.env.DA_GUEST_STRIPE_TEST_ONLY!=='1')
      throw new Error('guest_monitor_disabled');
  }

  /** Claim due cases under short PostgreSQL locks, never perform HTTP inside
   * this transaction. A claim lease survives worker crashes for 120 seconds.
   */
  private async claim(limit:number, owner:string):Promise<SourceRow[]> {
    const client:TransactionClient=await this.db.connect();
    let inTx=false;
    try {
      await client.query('BEGIN');
      inTx=true;
      const candidates=await client.query<SourceRow>(
        `SELECT a.order_id, a.state AS reservation_state,
                a.stripe_intent_id, s.payment_intent_id AS session_intent_id,
                s.state AS session_state, s.quoted_amount_cents,
                s.quoted_currency, s.quote_fingerprint, s.guest_subject,
                s.mutation_id, a.reconciliation_reason,
                COALESCE(q.check_count,0) AS check_count
           FROM da_guest_payment_intent_creation a
           JOIN da_guest_checkout_sessions s ON s.order_id=a.order_id
           LEFT JOIN da_guest_payment_reconciliation_alerts q
             ON q.order_id=a.order_id
          WHERE (
             a.state='review_required'
             OR (a.state='creating' AND a.lease_until<now()-interval '15 seconds')
             OR (a.state='bound' AND s.state='payment_pending'
                 AND a.updated_at<now()-interval '10 minutes')
             OR (a.state='bound' AND s.state='committed' AND
                 q.decision IN ('investigating','retry_scheduled',
                                'operator_action_required'))
          )
            AND (q.order_id IS NULL OR (
              q.decision NOT IN ('verified_cancelled','financially_committed')
              AND q.next_check_at <= now()
              AND (q.claim_until IS NULL OR q.claim_until <= now())
            ))
          ORDER BY a.created_at ASC
          FOR UPDATE OF a SKIP LOCKED LIMIT $1`,
        [limit],
      );
      const claimed:SourceRow[]=[];
      for(const item of candidates.rows) {
        if(!ORDER.test(item.order_id))continue;
        const updated=await client.query<{order_id:string}>(
          `INSERT INTO da_guest_payment_reconciliation_alerts
             (order_id,decision,reason_code,priority,claim_owner,claim_until)
           VALUES($1,'investigating','awaiting_evidence','normal',$2,
                  now()+interval '120 seconds')
           ON CONFLICT(order_id) DO UPDATE
             SET decision='investigating',
                 reason_code='awaiting_evidence', claim_owner=$2,
                 claim_until=now()+interval '120 seconds',
                 updated_at=now()
           WHERE (
             da_guest_payment_reconciliation_alerts.claim_until IS NULL
             OR da_guest_payment_reconciliation_alerts.claim_until <= now()
           ) AND da_guest_payment_reconciliation_alerts.next_check_at <= now()
           RETURNING order_id`,
          [item.order_id,owner],
        );
        if(updated.rowCount===1)claimed.push(item);
      }
      await client.query('COMMIT');
      inTx=false;
      return claimed;
    } catch(error) {
      if(inTx)await client.query('ROLLBACK').catch(()=>undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  private async inspect(source:SourceRow):Promise<Review> {
    const orderBound=source.reservation_state==='bound' &&
      source.session_state==='payment_pending' &&
      source.session_intent_id===source.stripe_intent_id;

    if(source.stripe_intent_id && source.session_intent_id &&
       source.stripe_intent_id!==source.session_intent_id)
      return immediateReview('provider_binding_conflict');

    const id=source.stripe_intent_id||source.session_intent_id;
    if(!id || !INTENT.test(id))
      return immediateReview('provider_identity_unknown');

    let remote:GuestTransportIntent;
    try {
      remote=await this.provider.getIntent(id);
    } catch {
      const previous=Number(source.check_count);
      if(previous>=3)return {
        decision:'operator_action_required',reason:'provider_unavailable_escalated',
        priority:'critical',providerStatus:null,
      };
      return {
        decision:'retry_scheduled',reason:'provider_read_unavailable',
        priority:'high',providerStatus:null,
      };
    }
    if(!verifyAuthoritativeProvider(remote,source,id) ||
       !FINGERPRINT.test(source.quote_fingerprint))
      return {
        ...immediateReview('provider_authority_mismatch'),
        providerStatus:null, // never trust/display the forged provider status
      };

    const providerStatus=remote.status;
    if(!/^[a-z][a-z0-9_]{2,79}$/.test(providerStatus))
      return immediateReview('provider_unexpected_status');

    if(providerStatus==='canceled') {
      if(source.session_state==='quoted' &&
         source.reservation_state==='review_required')
        return {
          decision:'verified_cancelled',reason:'provider_cancel_confirmed',
          priority:'normal',providerStatus,
        };
      return {
        decision:'operator_action_required',reason:'cancellation_binding_conflict',
        priority:'high',providerStatus,
      };
    }

    if(providerStatus==='succeeded') {
      if(source.reservation_state==='bound' &&
         source.session_state==='committed' &&
         source.session_intent_id===id) {
        // Crash after P3 commit but before Ops alert commit. Never repeat P3
        // solely to resolve a monitoring marker: require local finance proof.
        const verified=await this.db.query<{payment_intent_id:string}>(
          `SELECT v.payment_intent_id
             FROM da_guest_verified_payments v
             JOIN da_guest_financial_outbox o USING(order_id)
            WHERE v.order_id=$1 AND v.payment_intent_id=$2
              AND v.captured_amount_cents=$3 AND v.currency=$4
              AND v.quote_fingerprint=$5 LIMIT 1`,
          [source.order_id,id,Number(source.quoted_amount_cents),
           String(source.quoted_currency).trim(),source.quote_fingerprint],
        );
        if(verified.rowCount!==1)
          return immediateReview('committed_financial_chain_incomplete');
        return {
          decision:'financially_committed',reason:'p3_financial_commit_verified',
          priority:'normal',providerStatus,
        };
      }
      if(!orderBound) {
        return {
          decision:'operator_action_required',reason:'captured_without_trusted_binding',
          priority:'critical',providerStatus,
        };
      }
      if(!this.finalizer) {
        return {
          decision:'operator_action_required',reason:'captured_requires_p3_finalizer',
          priority:'critical',providerStatus,
        };
      }
      try {
        // P3 fetches Stripe financial evidence AGAIN independently, checks
        // the actual charge/capture, and commits finance+outbox atomically.
        const result=await this.finalizer.reconcileTrustedStripeIntent(id,'reconcile');
        if(!result?.ok || result.orderId!==source.order_id ||
           result.paymentIntentId!==id)
          throw new Error('guest_monitor_financial_result_invalid');
        return {
          decision:'financially_committed',reason:'p3_financial_commit_verified',
          priority:'normal',providerStatus,
        };
      } catch {
        return {
          decision:'operator_action_required',reason:'p3_financial_reconcile_failed',
          priority:'critical',providerStatus,
        };
      }
    }

    if(providerStatus==='requires_payment_method' ||
       providerStatus==='requires_action' || providerStatus==='processing') {
      if(!orderBound) {
        return {
          decision:'operator_action_required',reason:'unbound_provider_intent',
          priority:'high',providerStatus,
        };
      }
      return {
        decision:'retry_scheduled',reason:'awaiting_trusted_financial_finality',
        priority:'normal',providerStatus,
      };
    }

    return {
      decision:'operator_action_required',reason:'provider_state_requires_ops',
      priority:'high',providerStatus,
    };
  }

  private async finish(source:SourceRow,owner:string,decision:Review):
    Promise<AlertDecision|'stale'> {
    if(!ISSUE.test(decision.reason))
      throw new Error('guest_monitor_invalid_reason_code');

    const client=await this.db.connect();
    let inTx=false;
    try {
      await client.query('BEGIN');
      inTx=true;
      const latest=await client.query<{
        reservation_state:string;
        stripe_intent_id:string|null;
        session_state:string;
        session_intent_id:string|null;
        financial_intent_id:string|null;
        outbox_order_id:string|null;
      }>(
        `SELECT a.state AS reservation_state,a.stripe_intent_id,
                s.state AS session_state,s.payment_intent_id AS session_intent_id,
                v.payment_intent_id AS financial_intent_id,
                o.order_id AS outbox_order_id
           FROM da_guest_payment_intent_creation a
           JOIN da_guest_checkout_sessions s USING(order_id)
           LEFT JOIN da_guest_verified_payments v USING(order_id)
           LEFT JOIN da_guest_financial_outbox o USING(order_id)
          WHERE a.order_id=$1 FOR UPDATE OF a`,
        [source.order_id],
      );
      const now=latest.rows[0];
      let selected:Review=decision;
      const financialCommit=decision.decision==='financially_committed' &&
        now?.reservation_state==='bound' && now.session_state==='committed' &&
        now.stripe_intent_id===source.stripe_intent_id &&
        now.session_intent_id===source.stripe_intent_id &&
        now.financial_intent_id===source.stripe_intent_id &&
        now.outbox_order_id===source.order_id;
      if(decision.decision==='financially_committed' && !financialCommit)
        selected=immediateReview('financial_commit_evidence_missing');

      // Do not publish a stale provider read as a terminal fact if another
      // worker has modified either the reservation or the session.
      if(!now || now.reservation_state!==source.reservation_state ||
         now.stripe_intent_id!==source.stripe_intent_id ||
         now.session_intent_id!==source.session_intent_id ||
         (now.session_state!==source.session_state && !financialCommit)) {
        selected={
          decision:'retry_scheduled',reason:'stale_source_snapshot',
          priority:'high',providerStatus:null,
        };
      }

      const delay=selected.decision==='retry_scheduled' ?
        backoffMinutes(Number(source.check_count)+1) :
        selected.decision==='operator_action_required' ? 15 : 525600;

      const saved=await client.query<{order_id:string}>(
        `UPDATE da_guest_payment_reconciliation_alerts
            SET decision=$3,reason_code=$4,priority=$5,
                provider_intent_id=$6,provider_status=$7,
                claim_owner=NULL,claim_until=NULL,
                next_check_at=now()+($8::int*interval '1 minute'),
                check_count=check_count+1,last_checked_at=now(),updated_at=now()
          WHERE order_id=$1 AND claim_owner=$2
            AND claim_until>now()
          RETURNING order_id`,
        [source.order_id,owner,selected.decision,selected.reason,
         selected.priority,
         source.stripe_intent_id||source.session_intent_id,
         selected.providerStatus,delay],
      );
      if(saved.rowCount!==1)
        throw new Error('guest_monitor_lease_lost');
      await client.query('COMMIT');
      inTx=false;
      return selected.reason==='stale_source_snapshot'?'stale':selected.decision;
    } catch(error) {
      if(inTx)await client.query('ROLLBACK').catch(()=>undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Explicit invocation only; nothing schedules this automatically.
   * Caller may later schedule a cron/worker under least-privilege
   * credentials after RBAC, alert delivery, and Stripe TEST validation.
   */
  async scanOnce(batchLimit=10):Promise<GuestReconciliationSummary> {
    this.testOnly();
    if(!Number.isInteger(batchLimit) || batchLimit<1 || batchLimit>20)
      throw new Error('guest_monitor_batch_invalid');
    const owner=randomBytes(16).toString('hex');
    const claimed=await this.claim(batchLimit,owner);
    const totals={
      inspected:claimed.length,retryScheduled:0,operatorActionRequired:0,
      verifiedCancelled:0,financiallyCommitted:0,staleOrSuperseded:0,
    };
    for(const source of claimed) {
      // No dynamic exception, URL, PII or Stripe secret enters Ops logs.
      const review=await this.inspect(source);
      const outcome=await this.finish(source,owner,review);
      if(outcome==='retry_scheduled')totals.retryScheduled++;
      else if(outcome==='operator_action_required')totals.operatorActionRequired++;
      else if(outcome==='verified_cancelled')totals.verifiedCancelled++;
      else if(outcome==='financially_committed')totals.financiallyCommitted++;
      else totals.staleOrSuperseded++;
    }
    return totals;
  }
}
