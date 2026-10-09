-- DelishAfrica P5-D - guest Stripe intent recovery (LAB ONLY)
-- Apply only to independent Postgres 127.0.0.1:55440 after P5C migration.
-- Never run against production without authorization and separate-role review.
BEGIN;

ALTER TABLE da_guest_payment_intent_creation
  ADD COLUMN IF NOT EXISTS reconciliation_reason text;

-- The original P5C inline CHECK only accepted 'creating' or 'bound'.
ALTER TABLE da_guest_payment_intent_creation
  DROP CONSTRAINT IF EXISTS da_guest_payment_intent_creation_state_check;

ALTER TABLE da_guest_payment_intent_creation
  DROP CONSTRAINT IF EXISTS da_guest_intent_lease_state_ck;

ALTER TABLE da_guest_payment_intent_creation
  DROP CONSTRAINT IF EXISTS da_guest_intent_state_p5d_ck;

ALTER TABLE da_guest_payment_intent_creation
  ADD CONSTRAINT da_guest_intent_state_p5d_ck
  CHECK (state IN ('creating', 'bound', 'cancelled', 'review_required'));

ALTER TABLE da_guest_payment_intent_creation
  ADD CONSTRAINT da_guest_intent_lease_state_ck
  CHECK (
    (state = 'creating' AND lease_owner IS NOT NULL
      AND lease_until IS NOT NULL AND stripe_intent_id IS NULL
      AND reconciliation_reason IS NULL)
    OR (state = 'bound' AND lease_owner IS NULL
      AND lease_until IS NULL AND stripe_intent_id IS NOT NULL
      AND reconciliation_reason IS NULL)
    OR (state = 'cancelled' AND lease_owner IS NULL
      AND lease_until IS NULL AND stripe_intent_id IS NOT NULL
      AND reconciliation_reason IS NOT NULL)
    OR (state = 'review_required' AND lease_owner IS NULL
      AND lease_until IS NULL
      AND reconciliation_reason IS NOT NULL)
  );

ALTER TABLE da_guest_payment_intent_creation
  DROP CONSTRAINT IF EXISTS da_guest_intent_reconciliation_reason_ck;

ALTER TABLE da_guest_payment_intent_creation
  ADD CONSTRAINT da_guest_intent_reconciliation_reason_ck
  CHECK (reconciliation_reason IS NULL
    OR reconciliation_reason ~ '^[a-z][a-z0-9_]{4,63}$');

CREATE INDEX IF NOT EXISTS da_guest_intent_manual_review_idx
  ON da_guest_payment_intent_creation(updated_at)
  WHERE state = 'review_required';

COMMENT ON TABLE da_guest_payment_intent_creation IS
 'P5D lab: original one-key intent reservation plus terminal cancelled/review_required. Once uncertain or older than 23h, never auto-create another Stripe Intent.';

COMMIT;
