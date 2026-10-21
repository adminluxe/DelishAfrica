BEGIN;

CREATE TABLE IF NOT EXISTS da_account_deletion_requests (
  request_id uuid PRIMARY KEY,
  application text NOT NULL CHECK (application IN ('client','merchant','courier')),
  identity_fingerprint char(64) NOT NULL CHECK (identity_fingerprint ~ '^[0-9a-f]{64}$'),
  idempotency_key_hash char(64) NOT NULL UNIQUE CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('requested','pending_identity_deletion','processing','completed','manual_review')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completion_deadline timestamptz NOT NULL,
  completed_at timestamptz NULL,
  retention_acknowledged boolean NOT NULL CHECK (retention_acknowledged = true),
  auth_source text NOT NULL CHECK (auth_source = 'external')
);

CREATE INDEX IF NOT EXISTS da_account_deletion_identity_idx
  ON da_account_deletion_requests(application, identity_fingerprint, requested_at DESC);

CREATE INDEX IF NOT EXISTS da_account_deletion_status_deadline_idx
  ON da_account_deletion_requests(status, completion_deadline);

COMMIT;
