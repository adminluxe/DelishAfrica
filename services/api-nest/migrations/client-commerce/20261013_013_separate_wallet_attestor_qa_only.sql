-- DelishAfrica F4I SQL 013, disconnected ephemeral QA ONLY.
-- Apply AFTER 001..012, Keycloak F4H test, and catalog schema.
-- Creates a process-exclusive attestor login; OLD 010 attestor is revoked.
-- No production DB migration, bank accounts, payouts, or external payments.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.da_qa_wallet_challenge_010') IS NULL OR
     to_regclass('public.da_qa_partner_oidc_sessions_011') IS NULL OR
     to_regclass('public.da_qa_finance_courier_roster_012') IS NULL THEN
    RAISE EXCEPTION 'qa_f4i_missing_predecessor_migrations';
  END IF;
END $$;
CREATE ROLE da_qa_wallet_attestor_isolated_013 LOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO da_qa_wallet_attestor_isolated_013;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_attest_010(
  uuid,text,uuid,varchar,uuid,char(2))
  TO da_qa_wallet_attestor_isolated_013;
GRANT SELECT ON public.da_qa_partner_oidc_sessions_011
  TO da_qa_wallet_attestor_isolated_013;
-- Close original shared attestor after previous suites finish. It cannot
-- mint tickets anymore, and neither app DB login can assume the new role.
REVOKE EXECUTE ON FUNCTION public.da_qa_wallet_attest_010(
  uuid,text,uuid,varchar,uuid,char(2))
  FROM PUBLIC,da_qa_wallet_attestor_010,
       da_qa_merchant_commerce_app,da_qa_courier_commerce_app,
       da_qa_dispatch_commerce_app;
REVOKE ALL ON public.da_qa_partner_oidc_sessions_011
  FROM PUBLIC,da_qa_wallet_attestor_010,
       da_qa_merchant_commerce_app,da_qa_courier_commerce_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
COMMENT ON ROLE da_qa_wallet_attestor_isolated_013 IS
  'F4I ephemeral QA service-only DB login. Only permitted to attest backend-bound wallet challenge and read hashed synthetic session register. Needs SCRAM DB authentication and separate container; no production release authority.';
COMMIT;
