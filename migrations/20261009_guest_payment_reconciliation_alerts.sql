-- DelishAfrica P5-E LAB ONLY: guest financial reconciliation Ops monitor.
-- APPLY ONLY to independent local Postgres :55441 after P1-P5D migrations.
-- No customer profile, payment card, webhook secret or Stripe client_secret.
BEGIN;

CREATE TABLE IF NOT EXISTS da_guest_payment_reconciliation_alerts (
  order_id text PRIMARY KEY
    REFERENCES da_guest_checkout_sessions(order_id) ON DELETE RESTRICT,
  decision text NOT NULL
    CHECK (decision IN (
      'investigating', 'retry_scheduled', 'operator_action_required',
      'verified_cancelled', 'financially_committed'
    )),
  reason_code text NOT NULL
    CHECK (reason_code ~ '^[a-z][a-z0-9_]{4,79}$'),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','high','critical')),
  provider_intent_id text
    CHECK (provider_intent_id IS NULL OR
      provider_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  provider_status text
    CHECK (provider_status IS NULL OR
      provider_status ~ '^[a-z][a-z0-9_]{2,79}$'),
  claim_owner char(32)
    CHECK (claim_owner IS NULL OR claim_owner ~ '^[a-f0-9]{32}$'),
  claim_until timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  check_count integer NOT NULL DEFAULT 0
    CHECK (check_count BETWEEN 0 AND 1000000),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT da_guest_reconciliation_claim_check
    CHECK ((claim_owner IS NULL AND claim_until IS NULL)
        OR (claim_owner IS NOT NULL AND claim_until IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS da_guest_reconcile_due_idx
  ON da_guest_payment_reconciliation_alerts
  (next_check_at, priority, updated_at)
  WHERE decision IN ('retry_scheduled','operator_action_required');

CREATE INDEX IF NOT EXISTS da_guest_reconcile_ops_idx
  ON da_guest_payment_reconciliation_alerts
  (updated_at)
  WHERE decision = 'operator_action_required';

REVOKE ALL ON da_guest_payment_reconciliation_alerts FROM PUBLIC;

COMMENT ON TABLE da_guest_payment_reconciliation_alerts IS
  'P5E: durable, PII-free Ops financial incident register. Worker only observes Stripe. Review state does not release food orders or initiate payments.';

COMMIT;
