-- DelishAfrica Client enrollment v1 — additive, reversible by restoring backup.
-- Apply only after a PostgreSQL backup and migration review. No app data removed.
-- No e-mail, phone number, passwords or proof tokens stored here.
BEGIN;
CREATE TABLE IF NOT EXISTS public.da_client_enrollments (
  enrollment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hmac char(64) NOT NULL UNIQUE,
  phone_hmac char(64) NOT NULL UNIQUE,
  requester_hmac char(64) NOT NULL,
  request_hmac char(64) NOT NULL UNIQUE,
  email_proof_hmac char(64) NOT NULL UNIQUE,
  sms_proof_hmac char(64) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'ready', 'needs_review')),
  subject_id varchar(36) UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_da_client_enrollments_origin_created
  ON public.da_client_enrollments(requester_hmac, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_da_client_enrollments_status
  ON public.da_client_enrollments(status, created_at DESC);
COMMENT ON TABLE public.da_client_enrollments IS
  'Restricted Client-only OIDC enrollment. HMAC-based durable single-use and recovery ledger. No PII/passwords.';
COMMIT;
