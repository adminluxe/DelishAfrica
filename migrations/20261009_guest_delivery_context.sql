-- P4 isolated laboratory — encrypted delivery context.
-- Do not apply to production without DPIA, key rotation and retention review.
BEGIN;
CREATE TABLE IF NOT EXISTS da_guest_order_context (
  order_id text PRIMARY KEY
    REFERENCES da_guest_checkout_sessions(order_id) ON DELETE CASCADE,
  delivery_iv bytea NOT NULL CHECK (octet_length(delivery_iv)=12),
  delivery_tag bytea NOT NULL CHECK (octet_length(delivery_tag)=16),
  delivery_ciphertext bytea NOT NULL CHECK (octet_length(delivery_ciphertext) BETWEEN 32 AND 12000),
  delivery_fingerprint bytea NOT NULL CHECK (octet_length(delivery_fingerprint)=32),
  quote_snapshot jsonb NOT NULL CHECK (jsonb_typeof(quote_snapshot)='object'),
  quote_fingerprint text NOT NULL CHECK (length(quote_fingerprint)=64),
  partner_slug text NOT NULL CHECK (length(partner_slug) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE da_guest_order_context IS
  'AES-256-GCM sealed delivery profile; no raw PII. Finance-only until legal retention, fulfillment and access controls are approved.';
COMMIT;
