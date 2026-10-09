-- DelishAfrica Guest Checkout P2: additive Postgres migration.
-- NOT APPLIED to production, and must NOT be run on a database without review.
-- Contains no customer PII or Stripe client secret.
-- Run inside a controlled migration transaction after financial-state reconciliation.

BEGIN;

CREATE TABLE IF NOT EXISTS da_guest_checkout_sessions (
  order_id text PRIMARY KEY
    CHECK (order_id ~ '^DA-G-[0-9a-f]{32}$'),
  guest_subject text NOT NULL UNIQUE
    CHECK (guest_subject ~ '^guest_[0-9a-f]{32}$'),
  mutation_id text NOT NULL UNIQUE
    CHECK (mutation_id ~ '^guest:DA-G-[0-9a-f]{32}$'),
  capability_sha256 bytea NOT NULL UNIQUE
    CHECK (octet_length(capability_sha256) = 32),
  state text NOT NULL DEFAULT 'issued'
    CHECK (state IN ('issued', 'quoted', 'payment_pending',
                    'paid', 'committed', 'cancelled', 'expired')),
  quoted_amount_cents bigint
    CHECK (quoted_amount_cents IS NULL OR quoted_amount_cents > 0),
  quoted_currency char(3)
    CHECK (quoted_currency IS NULL OR quoted_currency ~ '^[a-z]{3}$'),
  quote_fingerprint text,
  payment_intent_id text UNIQUE
    CHECK (payment_intent_id IS NULL OR payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  committed_at timestamptz,
  CONSTRAINT da_guest_state_fields_ck CHECK (
    (state = 'issued'
       AND quoted_amount_cents IS NULL
       AND quoted_currency IS NULL
       AND quote_fingerprint IS NULL
       AND payment_intent_id IS NULL)
    OR
    (state IN ('quoted', 'payment_pending', 'paid', 'committed')
       AND quoted_amount_cents IS NOT NULL
       AND quoted_currency IS NOT NULL
       AND length(quote_fingerprint) BETWEEN 8 AND 192)
    OR
    (state IN ('cancelled','expired'))
  ),
  CONSTRAINT da_guest_payment_state_ck CHECK (
    state NOT IN ('payment_pending','paid','committed') OR payment_intent_id IS NOT NULL
  ),
  CONSTRAINT da_guest_committed_ck CHECK (
    state <> 'committed' OR (paid_at IS NOT NULL AND committed_at IS NOT NULL)
  ),
  CONSTRAINT da_guest_expiry_ck CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '4 hours 1 minute'
  )
);

CREATE INDEX IF NOT EXISTS da_guest_checkout_unfinished_idx
  ON da_guest_checkout_sessions (expires_at, state)
  WHERE state IN ('issued','quoted','payment_pending');

COMMENT ON TABLE da_guest_checkout_sessions IS
  'DelishAfrica guest checkout single-order ledger. No PII or raw capability tokens.';

-- Immutable identity fields and state transitions enforced in application SQL
-- via exact-match conditional UPDATE; future P3 needs a DB-enforced state
-- machine and atomic order/outbox transaction before activation.
COMMIT;
