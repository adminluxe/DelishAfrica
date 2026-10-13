-- DelishAfrica F4H / SQL 012 -- QA-ONLY, disconnected PG17 runner.
-- REQUIRES catalogue foundation 34b4b5b2a5a2_001 and wallet 001-011.
-- Existing Merchant schema is reused WITHOUT alteration. All legal records
-- and Courier roster records created here are SYNTHETIC QA EVIDENCE.
-- DO NOT run on VPS, production, Stripe or any shared persistent database.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.da_catalog_partners') IS NULL OR
     to_regclass('public.da_merchant_memberships') IS NULL OR
     to_regclass('public.da_identity_subjects') IS NULL OR
     to_regclass('public.da_qa_partner_oidc_sessions_011') IS NULL
  THEN
    RAISE EXCEPTION 'qa_f4h_missing_disposable_catalog_or_wallet_schema';
  END IF;
END $$;

CREATE ROLE da_qa_finance_authority_owner_012 NOLOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_finance_registry_reader_012 LOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO da_qa_finance_registry_reader_012;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE public.da_qa_finance_legal_entities_012(
  organization_id uuid PRIMARY KEY,
  territory char(2) NOT NULL CHECK (territory ~ '^[A-Z]{2}$'),
  legal_status text NOT NULL CHECK (legal_status IN
    ('active','suspended','terminated')),
  kyb_status text NOT NULL CHECK (kyb_status IN
    ('pending','verified','expired','rejected')),
  payments_on_hold boolean NOT NULL DEFAULT true,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  revoked_at timestamptz,
  UNIQUE(organization_id,territory),
  CHECK(valid_until IS NULL OR valid_until>valid_from)
);
ALTER TABLE public.da_qa_finance_legal_entities_012
  OWNER TO da_qa_finance_authority_owner_012;

CREATE TABLE public.da_qa_finance_partner_entities_012(
  partner_id text PRIMARY KEY REFERENCES
    public.da_catalog_partners(partner_id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL,
  territory char(2) NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY(organization_id,territory)
    REFERENCES public.da_qa_finance_legal_entities_012(
      organization_id,territory) ON DELETE RESTRICT,
  CHECK(valid_until IS NULL OR valid_until>valid_from)
);
ALTER TABLE public.da_qa_finance_partner_entities_012
  OWNER TO da_qa_finance_authority_owner_012;

CREATE TABLE public.da_qa_finance_courier_roster_012(
  issuer text NOT NULL,
  subject text NOT NULL,
  organization_id uuid NOT NULL,
  territory char(2) NOT NULL,
  roster_status text NOT NULL CHECK (roster_status IN
    ('pending','active','suspended','revoked')),
  agreement_status text NOT NULL CHECK (agreement_status IN
    ('pending','active','suspended','terminated')),
  kyc_status text NOT NULL CHECK (kyc_status IN
    ('pending','verified','rejected','expired')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY(issuer,subject),
  FOREIGN KEY(issuer,subject) REFERENCES
    public.da_identity_subjects(issuer,subject) ON DELETE RESTRICT,
  FOREIGN KEY(organization_id,territory) REFERENCES
    public.da_qa_finance_legal_entities_012(
      organization_id,territory) ON DELETE RESTRICT,
  CHECK(valid_until IS NULL OR valid_until>valid_from)
);
ALTER TABLE public.da_qa_finance_courier_roster_012
  OWNER TO da_qa_finance_authority_owner_012;

CREATE INDEX da_qa_finance_courier_roster_012_org_idx
  ON public.da_qa_finance_courier_roster_012(
    organization_id,territory,roster_status);
CREATE INDEX da_qa_finance_partner_entities_012_org_idx
  ON public.da_qa_finance_partner_entities_012(
    organization_id,territory);

-- The only new database credential is READ ONLY and may see only the
-- minimum joined catalogue/identity/legal/roster tables. Neither a Merchant
-- app role, Courier app role, nor the pre-existing wallet attestor can read.
REVOKE ALL ON TABLE
  public.da_qa_finance_legal_entities_012,
  public.da_qa_finance_partner_entities_012,
  public.da_qa_finance_courier_roster_012
  FROM PUBLIC,da_qa_merchant_commerce_app,
    da_qa_courier_commerce_app,da_qa_wallet_attestor_010;
GRANT SELECT ON TABLE
  public.da_catalog_partners,
  public.da_merchant_memberships,
  public.da_identity_subjects,
  public.da_qa_finance_legal_entities_012,
  public.da_qa_finance_partner_entities_012,
  public.da_qa_finance_courier_roster_012
  TO da_qa_finance_registry_reader_012;

COMMENT ON TABLE public.da_qa_finance_legal_entities_012 IS
  'F4H DISCONNECTED QA: synthetic legal entity/territory/KYB anchor, not company verification or beneficiary onboarding.';
COMMENT ON TABLE public.da_qa_finance_partner_entities_012 IS
  'F4H DISCONNECTED QA: partner-to-organization evidence anchored to actual Merchant catalogue schema; no production entitlement.';
COMMENT ON TABLE public.da_qa_finance_courier_roster_012 IS
  'F4H DISCONNECTED QA: independently committed Courier roster and KYC fixture; legacy courier-platform service remains demonstrative.';
COMMIT;
