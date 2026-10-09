-- DelishAfrica Guest Checkout P4 — PRIVATE FULFILLMENT STAGING
-- LAB ONLY. Never run against production without schema/security review.
-- Personal/dietary/delivery details remain AES-256-GCM encrypted.
BEGIN;

CREATE TABLE IF NOT EXISTS da_guest_fulfillment_vault (
  order_id text PRIMARY KEY REFERENCES da_guest_checkout_sessions(order_id)
    ON DELETE RESTRICT,
  quote_fingerprint text NOT NULL CHECK (length(quote_fingerprint) BETWEEN 8 AND 192),
  encryption_version smallint NOT NULL DEFAULT 1 CHECK(encryption_version = 1),
  encryption_key_id text NOT NULL CHECK(encryption_key_id ~ '^[a-z][a-z0-9_-]{2,31}$'),
  iv bytea NOT NULL UNIQUE CHECK(octet_length(iv) = 12),
  ciphertext bytea NOT NULL CHECK(octet_length(ciphertext) BETWEEN 24 AND 32768),
  auth_tag bytea NOT NULL CHECK(octet_length(auth_tag) = 16),
  payload_mac bytea NOT NULL CHECK(octet_length(payload_mac) = 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS da_guest_fulfillment_prepared (
  order_id text PRIMARY KEY REFERENCES da_guest_verified_payments(order_id)
    ON DELETE RESTRICT,
  quote_fingerprint text NOT NULL,
  merchant_slug text NOT NULL CHECK(length(merchant_slug) BETWEEN 1 AND 120),
  payment_intent_id text NOT NULL UNIQUE,
  preparation_state text NOT NULL DEFAULT 'encrypted_private_ready'
    CHECK(preparation_state = 'encrypted_private_ready'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce at the DATABASE boundary: no Intent may be bound until a complete
-- encrypted checkout packet for the same canonical quote is persisted.
-- This protects against accidental bypass by a future API integration.
CREATE OR REPLACE FUNCTION da_guest_payment_requires_sealed_fulfillment()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IN ('payment_pending', 'paid', 'committed') AND
     OLD.state IS DISTINCT FROM NEW.state THEN
    IF NOT EXISTS (
      SELECT 1 FROM da_guest_fulfillment_vault v
       WHERE v.order_id = NEW.order_id
         AND v.quote_fingerprint = NEW.quote_fingerprint
    ) THEN
      RAISE EXCEPTION 'guest_payment_fulfillment_not_sealed'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS da_guest_payment_fulfillment_gate
  ON da_guest_checkout_sessions;
CREATE TRIGGER da_guest_payment_fulfillment_gate
BEFORE UPDATE OF state ON da_guest_checkout_sessions
FOR EACH ROW
EXECUTE FUNCTION da_guest_payment_requires_sealed_fulfillment();

COMMENT ON TABLE da_guest_fulfillment_vault IS
  'Encrypted canonical order and customer data only; AES-256-GCM per order.';
COMMENT ON TABLE da_guest_fulfillment_prepared IS
  'Private paid-order staging: NOT published to Merchant/Courier or dispatch.';

COMMIT;
