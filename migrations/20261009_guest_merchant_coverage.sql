-- DelishAfrica Guest P5-B: verified merchant coverage boundaries, LAB ONLY.
-- This table is an explicit OPS approval ledger, not a list of available
-- postcode guesses nor something filled by a Client profile or Merchant UI.
-- In production, make INSERT/UPDATE/DELETE OPS-only through a separate role.
BEGIN;
CREATE TABLE IF NOT EXISTS da_guest_merchant_coverage (
  coverage_id text PRIMARY KEY
    CHECK (coverage_id ~ '^area_[a-z0-9_-]{6,70}$'),
  partner_slug text NOT NULL
    CHECK (partner_slug ~ '^[a-z0-9][a-z0-9_-]{1,119}$'),
  service_area_code text NOT NULL
    CHECK (service_area_code ~ '^[a-z][a-z0-9_-]{2,119}$'),
  country_code char(2) NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),
  postal_codes text[] NOT NULL CHECK (
    cardinality(postal_codes) BETWEEN 1 AND 80
  ),
  south_lat double precision NOT NULL CHECK (south_lat BETWEEN -90 AND 90),
  north_lat double precision NOT NULL CHECK (north_lat BETWEEN -90 AND 90),
  west_lng double precision NOT NULL CHECK (west_lng BETWEEN -180 AND 180),
  east_lng double precision NOT NULL CHECK (east_lng BETWEEN -180 AND 180),
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','suspended','revoked')),
  approval_source text NOT NULL DEFAULT 'ops_review'
    CHECK (approval_source = 'ops_review'),
  approved_by text CHECK (approved_by IS NULL OR length(approved_by) BETWEEN 6 AND 180),
  approved_at timestamptz,
  expires_at timestamptz,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT da_guest_coverage_nonempty_rectangle_ck CHECK (
    south_lat < north_lat AND west_lng < east_lng
  ),
  CONSTRAINT da_guest_coverage_approved_fields_ck CHECK (
    approval_status <> 'approved'
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL
       AND expires_at IS NOT NULL AND approved_at < expires_at)
  ),
  CONSTRAINT da_guest_coverage_unique UNIQUE(partner_slug,service_area_code)
);

CREATE INDEX IF NOT EXISTS da_guest_merchant_coverage_lookup_idx
  ON da_guest_merchant_coverage(partner_slug,country_code,approval_status)
  WHERE approval_status = 'approved';

COMMENT ON TABLE da_guest_merchant_coverage IS
 'Approved merchant delivery areas. No fallback. Created by an authorized Ops process, never the Client.';

COMMIT;
