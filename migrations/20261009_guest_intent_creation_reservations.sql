-- DelishAfrica P5-C — payment-intent creation reservation (LAB ONLY)
-- Do NOT migrate any production DB before stripe test-mode recovery audits.
-- All rows contain references only, never card, address, email or client_secret.
BEGIN;

CREATE TABLE IF NOT EXISTS da_guest_payment_intent_creation (
  order_id text PRIMARY KEY
    REFERENCES da_guest_checkout_sessions(order_id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE
    CHECK (length(idempotency_key) BETWEEN 16 AND 250),
  request_hash text NOT NULL
    CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('creating','bound')),
  lease_owner text CHECK (
    lease_owner IS NULL OR lease_owner ~ '^[a-f0-9]{32}$'
  ),
  lease_until timestamptz,
  stripe_intent_id text UNIQUE CHECK (
    stripe_intent_id IS NULL OR stripe_intent_id ~ '^pi_[A-Za-z0-9_]+$'
  ),
  attempt_count integer NOT NULL DEFAULT 1
    CHECK (attempt_count BETWEEN 1 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT da_guest_intent_lease_state_ck CHECK (
    (
      state = 'creating'
      AND lease_owner IS NOT NULL
      AND lease_until IS NOT NULL
      AND stripe_intent_id IS NULL
    ) OR (
      state = 'bound'
      AND lease_owner IS NULL
      AND lease_until IS NULL
      AND stripe_intent_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS da_guest_intent_creating_lease_idx
  ON da_guest_payment_intent_creation(lease_until)
  WHERE state = 'creating';

COMMENT ON TABLE da_guest_payment_intent_creation IS
 'P5-C test-mode Stripe intent reservation. Persist canonical idempotency key BEFORE Stripe request; protect against API crash and retries.';

COMMIT;
