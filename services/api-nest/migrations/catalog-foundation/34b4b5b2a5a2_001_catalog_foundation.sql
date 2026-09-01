-- DelishAfrica catalog foundation schema migration
-- Version: 34b4b5b2a5a2_001
-- Runtime policy: NEVER execute this migration from the least-privilege API process.
-- Execute only through a dedicated migration/admin identity during controlled deployment.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('delishafrica:catalog-foundation:34b4b5b2a5a2_001'));

CREATE TABLE IF NOT EXISTS da_catalog_schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS da_catalog_partners (
  partner_id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  lifecycle_status text NOT NULL DEFAULT 'published'
    CHECK (lifecycle_status IN ('draft', 'published', 'suspended', 'archived')),
  published_payload jsonb NOT NULL,
  draft_payload jsonb,
  published_revision integer NOT NULL DEFAULT 1 CHECK (published_revision >= 1),
  draft_revision integer NOT NULL DEFAULT 0 CHECK (draft_revision >= 0),
  display_order integer NOT NULL DEFAULT 100,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS da_catalog_ownerships (
  merchant_subject text NOT NULL,
  partner_id text NOT NULL
    REFERENCES da_catalog_partners(partner_id) ON DELETE RESTRICT,
  ownership_role text NOT NULL DEFAULT 'owner'
    CHECK (ownership_role IN ('owner', 'manager', 'editor', 'viewer')),
  active boolean NOT NULL DEFAULT true,
  granted_by text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (merchant_subject, partner_id)
);

CREATE TABLE IF NOT EXISTS da_identity_subjects (
  issuer text NOT NULL,
  subject text NOT NULL,
  identity_kind text NOT NULL DEFAULT 'merchant'
    CHECK (identity_kind IN ('client', 'merchant', 'courier', 'ops')),
  identity_status text NOT NULL DEFAULT 'active'
    CHECK (identity_status IN ('active', 'suspended', 'revoked')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issuer, subject)
);

CREATE TABLE IF NOT EXISTS da_merchant_memberships (
  membership_id bigserial PRIMARY KEY,
  issuer text NOT NULL,
  subject text NOT NULL,
  partner_id text NOT NULL
    REFERENCES da_catalog_partners(partner_id) ON DELETE RESTRICT,
  membership_role text NOT NULL DEFAULT 'manager'
    CHECK (
      membership_role IN (
        'owner',
        'admin',
        'manager',
        'kitchen',
        'finance',
        'support'
      )
    ),
  membership_status text NOT NULL DEFAULT 'pending'
    CHECK (
      membership_status IN (
        'invited',
        'pending',
        'active',
        'suspended',
        'revoked',
        'expired'
      )
    ),
  contract_status text NOT NULL DEFAULT 'pending'
    CHECK (
      contract_status IN (
        'pending',
        'active',
        'suspended',
        'terminated',
        'expired'
      )
    ),
  kyb_status text NOT NULL DEFAULT 'pending'
    CHECK (
      kyb_status IN (
        'pending',
        'verified',
        'rejected',
        'expired'
      )
    ),
  invited_by_subject text,
  activated_by_subject text,
  starts_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT da_merchant_memberships_identity_fkey
    FOREIGN KEY (issuer, subject)
    REFERENCES da_identity_subjects(issuer, subject)
    ON DELETE RESTRICT,
  CONSTRAINT da_merchant_memberships_identity_partner_key
    UNIQUE (issuer, subject, partner_id),
  CONSTRAINT da_merchant_memberships_time_window_check
    CHECK (
      expires_at IS NULL
      OR starts_at IS NULL
      OR expires_at > starts_at
    ),
  CONSTRAINT da_merchant_memberships_active_gate_check
    CHECK (
      membership_status <> 'active'
      OR (
        contract_status = 'active'
        AND kyb_status = 'verified'
        AND revoked_at IS NULL
      )
    )
);

CREATE TABLE IF NOT EXISTS da_catalog_audit (
  audit_id bigserial PRIMARY KEY,
  partner_id text NOT NULL
    REFERENCES da_catalog_partners(partner_id) ON DELETE RESTRICT,
  actor_subject text NOT NULL,
  action text NOT NULL,
  request_id text,
  before_payload jsonb,
  after_payload jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION da_catalog_audit_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'da_catalog_audit_is_append_only';
END;
$$;

DROP TRIGGER IF EXISTS da_catalog_audit_immutable ON da_catalog_audit;

CREATE TRIGGER da_catalog_audit_immutable
BEFORE UPDATE OR DELETE ON da_catalog_audit
FOR EACH ROW EXECUTE FUNCTION da_catalog_audit_immutable_guard();

CREATE INDEX IF NOT EXISTS da_catalog_partners_lifecycle_idx
ON da_catalog_partners(lifecycle_status, display_order, slug);

CREATE INDEX IF NOT EXISTS da_catalog_ownerships_subject_idx
ON da_catalog_ownerships(merchant_subject, active);

CREATE INDEX IF NOT EXISTS da_identity_subjects_status_idx
ON da_identity_subjects(identity_kind, identity_status);

CREATE INDEX IF NOT EXISTS da_merchant_memberships_subject_idx
ON da_merchant_memberships(
  issuer,
  subject,
  membership_status,
  contract_status,
  kyb_status
);

CREATE INDEX IF NOT EXISTS da_merchant_memberships_partner_idx
ON da_merchant_memberships(partner_id, membership_status);

CREATE INDEX IF NOT EXISTS da_catalog_audit_partner_created_idx
ON da_catalog_audit(partner_id, created_at DESC);

INSERT INTO da_catalog_schema_migrations(version)
VALUES ('34b4b5b2a5a2_001')
ON CONFLICT (version) DO NOTHING;

COMMIT;
