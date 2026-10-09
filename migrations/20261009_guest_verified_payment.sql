-- P3 development-only additive schema (never apply to production without review).
BEGIN;
CREATE TABLE IF NOT EXISTS da_guest_verified_payments (
  order_id text PRIMARY KEY
    REFERENCES da_guest_checkout_sessions(order_id),
  payment_intent_id text NOT NULL UNIQUE,
  captured_amount_cents bigint NOT NULL CHECK (captured_amount_cents > 0),
  currency char(3) NOT NULL CHECK (currency ~ '^[a-z]{3}$'),
  quote_fingerprint text NOT NULL,
  stripe_charge_id text NOT NULL UNIQUE,
  payment_state text NOT NULL DEFAULT 'confirmed_fulfillment_pending'
    CHECK (payment_state IN ('confirmed_fulfillment_pending','fulfillment_ready','refunded','disputed')),
  verified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT da_guest_payment_reference_ck CHECK (
    payment_intent_id ~ '^pi_[A-Za-z0-9_]+$' AND
    stripe_charge_id ~ '^ch_[A-Za-z0-9_]+$'
  )
);
CREATE TABLE IF NOT EXISTS da_guest_financial_outbox (
  order_id text PRIMARY KEY REFERENCES da_guest_verified_payments(order_id),
  event_kind text NOT NULL DEFAULT 'guest_payment_confirmed'
    CHECK (event_kind = 'guest_payment_confirmed'),
  last_stripe_event_id text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'pending_fulfillment_data'
    CHECK (delivery_status IN ('pending_fulfillment_data','ready','acknowledged')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE da_guest_verified_payments IS
 'Server verified Stripe capture, financial record only; NO delivery or dispatch until P4 encrypted fulfillment details.';
COMMENT ON TABLE da_guest_financial_outbox IS
 'Guest financial notice. This table is not a courier dispatch queue.';
COMMIT;
