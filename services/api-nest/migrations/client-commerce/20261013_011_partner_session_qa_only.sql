-- DelishAfrica F4G, additive SQL 011, DISCONNECTED QA PostgreSQL 17 ONLY.
-- Must be applied AFTER synthetic QA migrations 001..010.
-- Durable-for-the-ephemeral-run session state, NOT a real production
-- Keycloak revocation cache or a real legal beneficiary registry.
-- The attestor can SELECT only hashed keys and has NO mutation privilege.
BEGIN;
CREATE TABLE public.da_qa_partner_oidc_sessions_011(
  session_key_sha256 char(64) PRIMARY KEY CHECK(
    session_key_sha256 ~ '^[0-9a-f]{64}$'),
  issuer text NOT NULL CHECK(
    issuer ~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$'),
  subject uuid NOT NULL,
  owner_role text NOT NULL CHECK(owner_role IN ('merchant','courier')),
  audience text NOT NULL CHECK(
    audience IN ('delishafrica-merchant','delishafrica-courier')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (expires_at>issued_at),
  CHECK (
    (owner_role='merchant' AND audience='delishafrica-merchant')
    OR (owner_role='courier' AND audience='delishafrica-courier')
  )
);
ALTER TABLE public.da_qa_partner_oidc_sessions_011
  OWNER TO da_qa_wallet_read_owner_010;
REVOKE ALL ON TABLE public.da_qa_partner_oidc_sessions_011
  FROM PUBLIC,da_qa_merchant_commerce_app,
    da_qa_courier_commerce_app,da_qa_wallet_attestor_010;
GRANT SELECT ON TABLE public.da_qa_partner_oidc_sessions_011
  TO da_qa_wallet_attestor_010;

CREATE INDEX da_qa_partner_oidc_sessions_011_subject_idx
  ON public.da_qa_partner_oidc_sessions_011(
    issuer,subject,owner_role,revoked_at);
COMMENT ON TABLE public.da_qa_partner_oidc_sessions_011 IS
  'QA F4G ONLY. Ephemeral, synthetic partner session ledger, SHA256 key; no raw sid/jti or login tokens. No production identity authority, payouts or bank operations.';
COMMIT;
