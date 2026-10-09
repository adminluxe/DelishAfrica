-- DelishAfrica P5B: independent Ops approval registry, NOT applied to prod.
-- Approval creation/revocation must be restricted to trusted Ops operations.
BEGIN;
CREATE TABLE IF NOT EXISTS da_guest_coverage_ops_approvals (
  partner_slug text NOT NULL
    CHECK(partner_slug ~ '^[a-z][a-z0-9_-]{2,119}$'),
  coverage_sha256 char(64) NOT NULL
    CHECK(coverage_sha256 ~ '^[0-9a-f]{64}$'),
  approved_by_ops_subject text NOT NULL
    CHECK(length(approved_by_ops_subject) BETWEEN 8 AND 180),
  approved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY(partner_slug,coverage_sha256),
  CONSTRAINT guest_coverage_expiry_check CHECK (expires_at>approved_at),
  CONSTRAINT guest_coverage_revoked_check
    CHECK (revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE INDEX IF NOT EXISTS guest_coverage_ops_valid_until_idx
  ON da_guest_coverage_ops_approvals(expires_at)
  WHERE revoked_at IS NULL;

-- This migration intentionally defines NO unauthenticated write endpoint.
-- Production roles must be separated: checkout API SELECT only; Ops service
-- may INSERT/UPDATE after independent RBAC + audited approval workflow.
REVOKE ALL ON da_guest_coverage_ops_approvals FROM PUBLIC;
COMMENT ON TABLE da_guest_coverage_ops_approvals IS
  'Ops-owned fingerprint approval for merchant delivery area. A merchant cannot self-approve by toggling a JSON boolean.';
COMMIT;
