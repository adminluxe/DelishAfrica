-- DelishAfrica F4J / SQL 014, DISCONNECTED SYNTHETIC QA ONLY.
-- NEVER deploy to VPS, a persistent shared database or production.
-- Prerequisites: catalog foundation + wallet QA migrations 001..013.
-- Postgres-local authorization is validated under row locks IN THE SAME
-- statement / transaction that consumes a single-use F4E ticket.
-- External Keycloak logout is NOT transactionally coupled to PostgreSQL.
-- NO Stripe LIVE/TEST official, PSP, settlement, transfer or payout.
BEGIN;
DO $$
BEGIN
 IF to_regclass('public.da_identity_subjects') IS NULL OR
    to_regclass('public.da_merchant_memberships') IS NULL OR
    to_regclass('public.da_qa_wallet_ticket_010') IS NULL OR
    to_regclass('public.da_qa_partner_oidc_sessions_011') IS NULL OR
    to_regclass('public.da_qa_finance_courier_roster_012') IS NULL OR
    NOT EXISTS(SELECT 1 FROM pg_roles
      WHERE rolname='da_qa_wallet_attestor_isolated_013')
 THEN RAISE EXCEPTION 'qa_f4j_missing_authorization_predecessor'; END IF;
END $$;

CREATE ROLE da_qa_wallet_linear_owner_014 NOLOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO da_qa_wallet_linear_owner_014;
-- NO LOGIN, no table membership, no grant to shared application roles.
GRANT SELECT ON TABLE
  public.da_qa_wallet_ticket_010,
  public.da_qa_partner_oidc_sessions_011,
  public.da_identity_subjects,
  public.da_catalog_partners,
  public.da_merchant_memberships,
  public.da_qa_finance_partner_entities_012,
  public.da_qa_finance_legal_entities_012,
  public.da_qa_finance_courier_roster_012
  TO da_qa_wallet_linear_owner_014;
-- Locking rows with SELECT FOR SHARE/UPDATE needs UPDATE privilege on one
-- column. Grant only immutable identifier columns, never status, KYB,
-- contract, amounts, timestamps, role or territory.
GRANT UPDATE(ticket_id) ON TABLE public.da_qa_wallet_ticket_010
  TO da_qa_wallet_linear_owner_014;
GRANT UPDATE(session_key_sha256) ON TABLE
  public.da_qa_partner_oidc_sessions_011
  TO da_qa_wallet_linear_owner_014;
GRANT UPDATE(issuer) ON TABLE public.da_identity_subjects
  TO da_qa_wallet_linear_owner_014;
GRANT UPDATE(membership_id) ON TABLE public.da_merchant_memberships
  TO da_qa_wallet_linear_owner_014;
GRANT UPDATE(partner_id) ON TABLE public.da_catalog_partners
  TO da_qa_wallet_linear_owner_014;
GRANT UPDATE(partner_id) ON TABLE
  public.da_qa_finance_partner_entities_012
  TO da_qa_wallet_linear_owner_014;
GRANT UPDATE(organization_id) ON TABLE
  public.da_qa_finance_legal_entities_012
  TO da_qa_wallet_linear_owner_014;
GRANT UPDATE(issuer) ON TABLE
  public.da_qa_finance_courier_roster_012
  TO da_qa_wallet_linear_owner_014;

-- F4I's old authorized read 010 is now a private callee only.
REVOKE EXECUTE ON FUNCTION public.da_qa_wallet_read_attested_010(
  uuid,integer) FROM PUBLIC,
  da_qa_merchant_commerce_app,da_qa_courier_commerce_app;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_read_attested_010(
  uuid,integer) TO da_qa_wallet_linear_owner_014;

CREATE FUNCTION public.da_qa_wallet_read_linearized_014(
  p_ticket uuid,p_limit integer,p_session_sha256 text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  t public.da_qa_wallet_ticket_010%ROWTYPE;
  sess public.da_qa_partner_oidc_sessions_011%ROWTYPE;
  ident public.da_identity_subjects%ROWTYPE;
  memb public.da_merchant_memberships%ROWTYPE;
  partner record;
  roster public.da_qa_finance_courier_roster_012%ROWTYPE;
  entity public.da_qa_finance_legal_entities_012%ROWTYPE;
  matched integer:=0;
BEGIN
  IF p_ticket IS NULL OR p_limit IS NULL OR p_limit<1 OR p_limit>50 OR
     p_session_sha256 IS NULL OR
     p_session_sha256 !~ '^[a-f0-9]{64}$' OR
     session_user NOT IN (
       'da_qa_merchant_commerce_app',
       'da_qa_courier_commerce_app')
  THEN RAISE EXCEPTION 'qa_f4j_identity_scope_denied'; END IF;

  SELECT * INTO t FROM public.da_qa_wallet_ticket_010 AS tk
    WHERE tk.ticket_id=p_ticket FOR SHARE;
  IF NOT FOUND OR t.consumed_at IS NOT NULL OR
    t.expires_at<=clock_timestamp() OR
    (t.owner_kind='merchant' AND
     session_user<>'da_qa_merchant_commerce_app') OR
    (t.owner_kind='courier' AND
     session_user<>'da_qa_courier_commerce_app')
  THEN RAISE EXCEPTION 'qa_f4j_ticket_scope_denied'; END IF;

  -- Authorization changes in session 011 now BLOCK until the read has
  -- finished. If the UPDATE commits first, the subsequent SELECT sees
  -- revoked_at and denies. No stale pre-attestation snapshot is trusted.
  SELECT * INTO sess FROM public.da_qa_partner_oidc_sessions_011 AS s
    WHERE s.session_key_sha256=p_session_sha256::char(64)
      AND s.issuer=t.issuer AND s.subject=t.subject
      AND s.owner_role=t.owner_kind
      AND s.audience=CASE t.owner_kind
        WHEN 'merchant' THEN 'delishafrica-merchant'
        WHEN 'courier' THEN 'delishafrica-courier'
        ELSE 'not-applicable' END
    FOR SHARE;
  IF NOT FOUND OR sess.revoked_at IS NOT NULL OR
    sess.expires_at<=clock_timestamp() OR
    sess.issued_at>clock_timestamp()
  THEN RAISE EXCEPTION 'qa_f4j_session_revoked'; END IF;

  -- FOR UPDATE on this parent identity serializes new membership/roster
  -- FK references, preventing a newly inserted second membership from
  -- bypassing a previously checked "unique wallet" rule in this tx.
  SELECT * INTO ident FROM public.da_identity_subjects AS i
    WHERE i.issuer=t.issuer AND i.subject=t.subject::text
    FOR UPDATE;
  IF NOT FOUND OR ident.identity_status<>'active' OR
     ident.identity_kind<>t.owner_kind
  THEN RAISE EXCEPTION 'qa_f4j_identity_revoked'; END IF;

  IF t.owner_kind='merchant' THEN
    -- Lock EVERY membership for this issuer/subject before calculating
    -- uniqueness. Lock eligible partner/legal rows too: status edits
    -- cannot commit between this check and the ledger read below.
    FOR memb IN
      SELECT m.* FROM public.da_merchant_memberships AS m
      WHERE m.issuer=t.issuer AND m.subject=t.subject::text
      ORDER BY m.membership_id FOR SHARE
    LOOP
      IF memb.membership_role NOT IN ('owner','admin','finance') OR
         memb.membership_status<>'active' OR
         memb.contract_status<>'active' OR
         memb.kyb_status<>'verified' OR
         memb.revoked_at IS NOT NULL OR
         (memb.starts_at IS NOT NULL AND memb.starts_at>clock_timestamp()) OR
         (memb.expires_at IS NOT NULL AND memb.expires_at<=clock_timestamp())
      THEN CONTINUE; END IF;

      SELECT p.slug,p.lifecycle_status,b.organization_id,b.territory,
        b.valid_from,b.valid_until,b.revoked_at AS binding_revoked,
        e.legal_status,e.kyb_status AS legal_kyb,
        e.valid_from AS legal_from,e.valid_until AS legal_until,
        e.revoked_at AS legal_revoked
      INTO partner
      FROM public.da_catalog_partners AS p
      JOIN public.da_qa_finance_partner_entities_012 AS b
        ON b.partner_id=p.partner_id
      JOIN public.da_qa_finance_legal_entities_012 AS e
        ON e.organization_id=b.organization_id AND e.territory=b.territory
      WHERE p.partner_id=memb.partner_id
      FOR SHARE OF p,b,e;
      IF NOT FOUND OR partner.lifecycle_status<>'published' OR
        partner.binding_revoked IS NOT NULL OR
        partner.valid_from>clock_timestamp() OR
        (partner.valid_until IS NOT NULL AND
         partner.valid_until<=clock_timestamp()) OR
        partner.legal_status<>'active' OR
        partner.legal_kyb<>'verified' OR
        partner.legal_revoked IS NOT NULL OR
        partner.legal_from>clock_timestamp() OR
        (partner.legal_until IS NOT NULL AND
         partner.legal_until<=clock_timestamp())
      THEN CONTINUE; END IF;
      matched:=matched+1;
      IF partner.slug<>t.merchant_slug OR
         partner.organization_id<>t.organization_id OR
         partner.territory<>t.territory
      THEN RAISE EXCEPTION 'qa_f4j_merchant_scope_mismatch'; END IF;
    END LOOP;
    IF matched<>1 THEN
      RAISE EXCEPTION 'qa_f4j_merchant_unique_authority_denied';
    END IF;
  ELSIF t.owner_kind='courier' THEN
    SELECT * INTO roster FROM public.da_qa_finance_courier_roster_012 c
      WHERE c.issuer=t.issuer AND c.subject=t.subject::text FOR SHARE;
    IF NOT FOUND OR roster.roster_status<>'active' OR
       roster.agreement_status<>'active' OR
       roster.kyc_status<>'verified' OR
       roster.revoked_at IS NOT NULL OR
       roster.valid_from>clock_timestamp() OR
       (roster.valid_until IS NOT NULL AND
        roster.valid_until<=clock_timestamp()) OR
       roster.organization_id<>t.organization_id OR
       roster.territory<>t.territory
    THEN RAISE EXCEPTION 'qa_f4j_courier_registry_denied'; END IF;

    SELECT * INTO entity FROM public.da_qa_finance_legal_entities_012 e
      WHERE e.organization_id=roster.organization_id
        AND e.territory=roster.territory FOR SHARE;
    IF NOT FOUND OR entity.legal_status<>'active' OR
       entity.kyb_status<>'verified' OR
       entity.revoked_at IS NOT NULL OR
       entity.valid_from>clock_timestamp() OR
       (entity.valid_until IS NOT NULL AND
        entity.valid_until<=clock_timestamp())
    THEN RAISE EXCEPTION 'qa_f4j_courier_legal_denied'; END IF;
  ELSE
    RAISE EXCEPTION 'qa_f4j_partner_role_invalid';
  END IF;

  -- Same SQL call, same transaction, authorization locks still held.
  -- The F4E read internally locks the one-use ticket and wallet scope,
  -- re-verifies the backend pid/start and marks ticket consumed.
  RETURN public.da_qa_wallet_read_attested_010(p_ticket,p_limit);
END
$$;
ALTER FUNCTION public.da_qa_wallet_read_linearized_014(uuid,integer,text)
 OWNER TO da_qa_wallet_linear_owner_014;
REVOKE ALL ON FUNCTION public.da_qa_wallet_read_linearized_014(
  uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_read_linearized_014(
  uuid,integer,text) TO
    da_qa_merchant_commerce_app,da_qa_courier_commerce_app;

-- No new write/dispatch/payout entry points. The legacy write functions
-- revoked in QA 010 remain inaccessible after QA 014.
COMMENT ON FUNCTION public.da_qa_wallet_read_linearized_014(
  uuid,integer,text) IS
  'F4J QA synthetic only: local PostgreSQL revocation + legal/membership/roster locks remain held through one-use wallet ticket consumption. Keycloak logout is external and NOT atomically linearized.';
COMMIT;
