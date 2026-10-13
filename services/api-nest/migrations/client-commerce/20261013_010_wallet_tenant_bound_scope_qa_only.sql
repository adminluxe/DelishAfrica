-- DelishAfrica F4E / SQL 010 / SYNTHETIC QA ONLY.
-- Never apply on VPS or an existing database. Requires migrations 001-009.
-- The isolated identity attestor is a separate trust principal; these QA
-- registries are test fixtures, NOT live Keycloak/KYB/courier evidence.
-- No Stripe calls, bank accounts, settlement, transfer or payout.
BEGIN;

CREATE ROLE da_qa_wallet_read_owner_010 NOLOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_wallet_write_owner_010 NOLOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_wallet_attestor_010 LOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
-- PostgreSQL hides other-role backend_start when called from a
-- SECURITY DEFINER owner. Isolate the exceptional stats capability:
-- no login, no DML, exposes CURRENT BACKEND start only.
CREATE ROLE da_qa_wallet_backend_observer_010 NOLOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION;
GRANT pg_read_all_stats TO da_qa_wallet_backend_observer_010;
GRANT USAGE ON SCHEMA public TO
  da_qa_wallet_read_owner_010,da_qa_wallet_write_owner_010,
  da_qa_wallet_attestor_010,da_qa_wallet_backend_observer_010;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- CLOSE ALL PREVIOUS IDENTITY-BEARING ENTRYPOINTS: a compromised shared
-- app login must not pass another tenant slug/issuer/subject to a definer.
REVOKE EXECUTE ON FUNCTION
  public.da_qa_wallet_merchant_summary(varchar),
  public.da_qa_wallet_merchant_activity(varchar,integer)
  FROM PUBLIC,da_qa_merchant_commerce_app;
REVOKE EXECUTE ON FUNCTION
  public.da_qa_wallet_courier_summary(text,uuid),
  public.da_qa_wallet_courier_activity(text,uuid,integer)
  FROM PUBLIC,da_qa_courier_commerce_app;
REVOKE EXECUTE ON FUNCTION
  public.da_qa_merchant_visible_paid_orders(varchar,integer),
  public.da_qa_merchant_transition(uuid,varchar,text)
  FROM PUBLIC,da_qa_merchant_commerce_app;
REVOKE EXECUTE ON FUNCTION
  public.da_qa_courier_assigned_offers(text,uuid,integer),
  public.da_qa_courier_transition(uuid,text,uuid,text)
  FROM PUBLIC,da_qa_courier_commerce_app;
REVOKE EXECUTE ON FUNCTION
  public.da_qa_dispatch_assign_offer(uuid,text,uuid)
  FROM PUBLIC,da_qa_dispatch_commerce_app;
-- Fulfillment/dispatch are deliberately FAIL-CLOSED after 010 until
-- equivalent independently attested write capabilities are implemented.

-- Wallet journal writer remains finance-only and is moved off superuser.
ALTER TABLE public.da_qa_wallet_policy OWNER TO da_qa_wallet_write_owner_010;
ALTER TABLE public.da_qa_wallet_allocation OWNER TO da_qa_wallet_write_owner_010;
ALTER TABLE public.da_qa_wallet_posting OWNER TO da_qa_wallet_write_owner_010;
ALTER FUNCTION public.da_qa_wallet_append_only()
  OWNER TO da_qa_wallet_write_owner_010;
ALTER FUNCTION public.da_qa_wallet_accrue_verified_capture(uuid)
  OWNER TO da_qa_wallet_write_owner_010;
-- FOR UPDATE on orders and authorities requires UPDATE privilege; the
-- NOLOGIN function owner cannot be assumed by either mobile DB role.
GRANT SELECT ON TABLE
  public.da_client_commerce_orders_qa,
  public.da_client_commerce_payment_authority_qa
  TO da_qa_wallet_write_owner_010;
-- SELECT ... FOR UPDATE needs UPDATE on a column. Restrict it to the
-- immutable PK only; never grant the wallet owner mutable pricing/state.
GRANT UPDATE (order_id) ON TABLE public.da_client_commerce_orders_qa
  TO da_qa_wallet_write_owner_010;
GRANT UPDATE (authority_id) ON TABLE
  public.da_client_commerce_payment_authority_qa
  TO da_qa_wallet_write_owner_010;
GRANT SELECT ON TABLE
  public.da_client_commerce_order_snapshot_qa,
  public.da_stripe_test_financial_receipts_qa,
  public.da_stripe_test_financial_holds_qa
  TO da_qa_wallet_write_owner_010;
REVOKE ALL ON FUNCTION public.da_qa_wallet_accrue_verified_capture(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_accrue_verified_capture(uuid)
  TO da_qa_stripe_finance_reconciler;

-- Wallet read projections are independently owned by another NOLOGIN
-- non-superuser; no EXECUTE on old parameterized paths for app logins.
ALTER FUNCTION public.da_qa_wallet_merchant_summary(varchar)
  OWNER TO da_qa_wallet_read_owner_010;
ALTER FUNCTION public.da_qa_wallet_merchant_activity(varchar,integer)
  OWNER TO da_qa_wallet_read_owner_010;
ALTER FUNCTION public.da_qa_wallet_courier_summary(text,uuid)
  OWNER TO da_qa_wallet_read_owner_010;
ALTER FUNCTION public.da_qa_wallet_courier_activity(text,uuid,integer)
  OWNER TO da_qa_wallet_read_owner_010;
GRANT SELECT ON TABLE
  public.da_qa_wallet_policy,public.da_qa_wallet_allocation,
  public.da_qa_wallet_posting,public.da_qa_fulfillment_state,
  public.da_qa_courier_offer,public.da_stripe_test_financial_holds_qa
  TO da_qa_wallet_read_owner_010;

-- QA-ONLY mirrors of external durable Merchant contract/KYB and Courier
-- roster. Real integration must map official source records, with issuer,
-- organization and territory retained and revocations checked every read.
CREATE TABLE public.da_qa_wallet_merchant_scope_010(
  issuer text NOT NULL,
  subject uuid NOT NULL,
  merchant_slug varchar(120) NOT NULL,
  organization_id uuid NOT NULL,
  territory char(2) NOT NULL CHECK(territory ~ '^[A-Z]{2}$'),
  membership_status text NOT NULL CHECK(
    membership_status IN('active','suspended','revoked','expired')),
  contract_status text NOT NULL CHECK(
    contract_status IN('active','suspended','terminated','expired')),
  kyb_status text NOT NULL CHECK(
    kyb_status IN('verified','pending','rejected','expired')),
  partner_state text NOT NULL CHECK(
    partner_state IN('published','draft','suspended','archived')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY(issuer,subject,merchant_slug,organization_id,territory)
);
-- The 009 merchant ledger has slug but no independent organization key.
-- Forbid aliasing the same slug into another organization or territory.
CREATE TABLE public.da_qa_wallet_slug_owner_010(
  merchant_slug varchar(120) PRIMARY KEY,
  organization_id uuid NOT NULL,
  territory char(2) NOT NULL CHECK(territory ~ '^[A-Z]{2}$')
);
CREATE TABLE public.da_qa_wallet_courier_scope_010(
  issuer text NOT NULL,
  subject uuid NOT NULL,
  organization_id uuid NOT NULL,
  territory char(2) NOT NULL CHECK(territory ~ '^[A-Z]{2}$'),
  roster_active boolean NOT NULL DEFAULT false,
  agreement_status text NOT NULL CHECK(
    agreement_status IN('active','suspended','terminated')),
  kyc_status text NOT NULL CHECK(
    kyc_status IN('verified','pending','rejected','expired')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY(issuer,subject,organization_id,territory),
  -- Courier offer/ledger 007-009 lacks an organization/territory key.
  -- A repeated issuer+subject in another jurisdiction is not supported.
  UNIQUE(issuer,subject)
);
CREATE TABLE public.da_qa_wallet_challenge_010(
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  db_login text NOT NULL CHECK(db_login IN(
    'da_qa_merchant_commerce_app','da_qa_courier_commerce_app')),
  backend_pid integer NOT NULL,
  backend_start timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.da_qa_wallet_ticket_010(
  ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL UNIQUE REFERENCES
    public.da_qa_wallet_challenge_010(challenge_id),
  owner_kind text NOT NULL CHECK(owner_kind IN('merchant','courier')),
  issuer text NOT NULL,
  subject uuid NOT NULL,
  merchant_slug varchar(120),
  organization_id uuid NOT NULL,
  territory char(2) NOT NULL CHECK(territory ~ '^[A-Z]{2}$'),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK ((owner_kind='merchant' AND merchant_slug IS NOT NULL)
      OR (owner_kind='courier' AND merchant_slug IS NULL))
);
ALTER TABLE public.da_qa_wallet_merchant_scope_010
  OWNER TO da_qa_wallet_read_owner_010;
ALTER TABLE public.da_qa_wallet_slug_owner_010
  OWNER TO da_qa_wallet_read_owner_010;
ALTER TABLE public.da_qa_wallet_courier_scope_010
  OWNER TO da_qa_wallet_read_owner_010;
ALTER TABLE public.da_qa_wallet_challenge_010
  OWNER TO da_qa_wallet_read_owner_010;
ALTER TABLE public.da_qa_wallet_ticket_010
  OWNER TO da_qa_wallet_read_owner_010;
REVOKE ALL ON TABLE
  public.da_qa_wallet_merchant_scope_010,
  public.da_qa_wallet_slug_owner_010,
  public.da_qa_wallet_courier_scope_010,
  public.da_qa_wallet_challenge_010,
  public.da_qa_wallet_ticket_010
  FROM PUBLIC,da_qa_merchant_commerce_app,da_qa_courier_commerce_app,
       da_qa_wallet_attestor_010;

-- Exceptional PG stats role cannot log in and cannot read another
-- session's information through this function. Only wallet read_owner
-- is permitted to call it; app logins have no direct EXECUTE privilege.
CREATE FUNCTION public.da_qa_wallet_current_backend_start_010()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
  SELECT backend_start FROM pg_catalog.pg_stat_activity
  WHERE pid=pg_catalog.pg_backend_pid()
$$;
ALTER FUNCTION public.da_qa_wallet_current_backend_start_010()
  OWNER TO da_qa_wallet_backend_observer_010;
REVOKE ALL ON FUNCTION public.da_qa_wallet_current_backend_start_010()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_current_backend_start_010()
  TO da_qa_wallet_read_owner_010;

-- A challenge is generated ONLY by the current app database backend.
-- Neither a client-supplied GUC nor a passed slug/issuer is authoritative.
CREATE FUNCTION public.da_qa_wallet_begin_scope_010()
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  started timestamptz;
  ticket uuid;
BEGIN
  IF session_user NOT IN (
    'da_qa_merchant_commerce_app','da_qa_courier_commerce_app') THEN
    RAISE EXCEPTION 'qa_scope_application_login_required';
  END IF;
  started:=public.da_qa_wallet_current_backend_start_010();
  IF started IS NULL THEN RAISE EXCEPTION 'qa_scope_backend_missing'; END IF;
  INSERT INTO public.da_qa_wallet_challenge_010(
    db_login,backend_pid,backend_start)
    VALUES(session_user,pg_backend_pid(),started)
    RETURNING challenge_id INTO ticket;
  RETURN ticket;
END;
$$;
ALTER FUNCTION public.da_qa_wallet_begin_scope_010()
  OWNER TO da_qa_wallet_read_owner_010;
REVOKE ALL ON FUNCTION public.da_qa_wallet_begin_scope_010() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_begin_scope_010()
  TO da_qa_merchant_commerce_app,da_qa_courier_commerce_app;

-- Only an INDEPENDENT identity-attestation DB login can mint a ticket.
-- That login must first validate an actual RS256/OIDC session and durable
-- membership/roster through its own service. QA tests below use synthetic
-- evidence only; this function itself does NOT verify JWT cryptography.
CREATE FUNCTION public.da_qa_wallet_attest_010(
  p_challenge uuid,p_issuer text,p_subject uuid,p_merchant varchar,
  p_organization uuid,p_territory char(2)
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  ch public.da_qa_wallet_challenge_010%ROWTYPE;
  kind text;
  proof uuid;
BEGIN
  IF p_challenge IS NULL OR p_subject IS NULL OR p_organization IS NULL OR
    p_issuer IS NULL OR
    p_issuer !~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$' OR
    p_territory IS NULL OR p_territory !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'qa_scope_untrusted_issuer_subject_or_territory';
  END IF;
  SELECT * INTO ch FROM public.da_qa_wallet_challenge_010
    WHERE challenge_id=p_challenge FOR UPDATE;
  IF NOT FOUND OR ch.created_at<clock_timestamp()-interval '30 seconds'
    OR ch.created_at>clock_timestamp() OR
    EXISTS(SELECT 1 FROM public.da_qa_wallet_ticket_010
      WHERE challenge_id=p_challenge) THEN
    RAISE EXCEPTION 'qa_scope_challenge_invalid_or_replayed';
  END IF;
  kind:=CASE ch.db_login
    WHEN 'da_qa_merchant_commerce_app' THEN 'merchant'
    WHEN 'da_qa_courier_commerce_app' THEN 'courier' ELSE NULL END;
  IF kind='merchant' THEN
    IF p_merchant IS NULL OR
       p_merchant !~ '^[a-z0-9][a-z0-9_-]{1,119}$' THEN
      RAISE EXCEPTION 'qa_scope_merchant_invalid';
    END IF;
    PERFORM 1 FROM public.da_qa_wallet_merchant_scope_010 m
      WHERE m.issuer=p_issuer AND m.subject=p_subject
        AND m.merchant_slug=p_merchant
        AND m.organization_id=p_organization AND m.territory=p_territory
        AND EXISTS (
          SELECT 1 FROM public.da_qa_wallet_slug_owner_010 owner0
          WHERE owner0.merchant_slug=m.merchant_slug
            AND owner0.organization_id=m.organization_id
            AND owner0.territory=m.territory
        )
        AND m.membership_status='active'
        AND m.contract_status='active' AND m.kyb_status='verified'
        AND m.partner_state='published' AND m.revoked_at IS NULL
        AND m.valid_from<=clock_timestamp()
        AND (m.valid_until IS NULL OR m.valid_until>clock_timestamp())
      FOR SHARE;
  ELSIF kind='courier' THEN
    IF p_merchant IS NOT NULL THEN
      RAISE EXCEPTION 'qa_scope_courier_cannot_choose_merchant';
    END IF;
    PERFORM 1 FROM public.da_qa_wallet_courier_scope_010 c
      WHERE c.issuer=p_issuer AND c.subject=p_subject
        AND c.organization_id=p_organization AND c.territory=p_territory
        AND c.roster_active=true AND c.agreement_status='active'
        AND c.kyc_status='verified' AND c.revoked_at IS NULL
        AND c.valid_from<=clock_timestamp()
        AND (c.valid_until IS NULL OR c.valid_until>clock_timestamp())
      FOR SHARE;
  ELSE
    RAISE EXCEPTION 'qa_scope_unrecognized_db_role';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'qa_scope_registry_denied'; END IF;
  INSERT INTO public.da_qa_wallet_ticket_010(
    challenge_id,owner_kind,issuer,subject,merchant_slug,
    organization_id,territory,expires_at)
    VALUES(p_challenge,kind,p_issuer,p_subject,p_merchant,
      p_organization,p_territory,clock_timestamp()+interval '20 seconds')
    RETURNING ticket_id INTO proof;
  RETURN proof;
END;
$$;
ALTER FUNCTION public.da_qa_wallet_attest_010(
  uuid,text,uuid,varchar,uuid,char(2))
  OWNER TO da_qa_wallet_read_owner_010;
REVOKE ALL ON FUNCTION public.da_qa_wallet_attest_010(
  uuid,text,uuid,varchar,uuid,char(2)) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_attest_010(
  uuid,text,uuid,varchar,uuid,char(2)) TO da_qa_wallet_attestor_010;

-- A SINGLE read returns summary + activity, atomically consuming the
-- non-forgeable DB ticket. The app supplies ONLY ticket UUID and page size.
-- Revocation/contract/KYB/roster are rechecked after attestation.
CREATE FUNCTION public.da_qa_wallet_read_attested_010(
  p_ticket uuid,p_limit integer DEFAULT 20
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  t public.da_qa_wallet_ticket_010%ROWTYPE;
  ch public.da_qa_wallet_challenge_010%ROWTYPE;
  started timestamptz;
  result_summary jsonb;
  result_activity jsonb;
BEGIN
  IF p_ticket IS NULL OR p_limit IS NULL OR p_limit<1 OR p_limit>50 THEN
    RAISE EXCEPTION 'qa_scope_ticket_or_limit_invalid';
  END IF;
  SELECT * INTO t FROM public.da_qa_wallet_ticket_010
    WHERE ticket_id=p_ticket FOR UPDATE;
  IF NOT FOUND OR t.consumed_at IS NOT NULL OR
    t.expires_at<=clock_timestamp() THEN
    RAISE EXCEPTION 'qa_scope_ticket_expired_or_replayed';
  END IF;
  SELECT * INTO ch FROM public.da_qa_wallet_challenge_010
    WHERE challenge_id=t.challenge_id;
  started:=public.da_qa_wallet_current_backend_start_010();
  IF started IS NULL OR
    ch.db_login<>session_user OR ch.backend_pid<>pg_backend_pid()
    OR ch.backend_start<>started OR
    (ch.db_login='da_qa_merchant_commerce_app' AND t.owner_kind<>'merchant')
    OR (ch.db_login='da_qa_courier_commerce_app' AND t.owner_kind<>'courier') THEN
    RAISE EXCEPTION 'qa_scope_postgres_session_mismatch';
  END IF;
  IF t.owner_kind='merchant' THEN
    PERFORM 1 FROM public.da_qa_wallet_merchant_scope_010 m
      WHERE m.issuer=t.issuer AND m.subject=t.subject
        AND m.merchant_slug=t.merchant_slug
        AND m.organization_id=t.organization_id AND m.territory=t.territory
        AND EXISTS (
          SELECT 1 FROM public.da_qa_wallet_slug_owner_010 owner0
          WHERE owner0.merchant_slug=m.merchant_slug
            AND owner0.organization_id=m.organization_id
            AND owner0.territory=m.territory
        )
        AND m.membership_status='active' AND m.contract_status='active'
        AND m.kyb_status='verified' AND m.partner_state='published'
        AND m.revoked_at IS NULL AND m.valid_from<=clock_timestamp()
        AND (m.valid_until IS NULL OR m.valid_until>clock_timestamp())
      FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'qa_scope_merchant_revoked'; END IF;
    SELECT to_jsonb(s) INTO result_summary
      FROM public.da_qa_wallet_merchant_summary(t.merchant_slug) s;
    SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb)
      INTO result_activity FROM
      public.da_qa_wallet_merchant_activity(t.merchant_slug,p_limit) a;
  ELSIF t.owner_kind='courier' THEN
    PERFORM 1 FROM public.da_qa_wallet_courier_scope_010 c
      WHERE c.issuer=t.issuer AND c.subject=t.subject
        AND c.organization_id=t.organization_id AND c.territory=t.territory
        AND c.roster_active=true AND c.agreement_status='active'
        AND c.kyc_status='verified' AND c.revoked_at IS NULL
        AND c.valid_from<=clock_timestamp()
        AND (c.valid_until IS NULL OR c.valid_until>clock_timestamp())
      FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'qa_scope_courier_revoked'; END IF;
    SELECT to_jsonb(s) INTO result_summary
      FROM public.da_qa_wallet_courier_summary(t.issuer,t.subject) s;
    SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb)
      INTO result_activity FROM
      public.da_qa_wallet_courier_activity(t.issuer,t.subject,p_limit) a;
  ELSE
    RAISE EXCEPTION 'qa_scope_kind_invalid';
  END IF;
  UPDATE public.da_qa_wallet_ticket_010 SET consumed_at=clock_timestamp()
    WHERE ticket_id=p_ticket;
  RETURN jsonb_build_object(
    'mode','qa_synthetic_only','ownerRole',t.owner_kind,
    'merchantSlug',t.merchant_slug,
    'organizationId',t.organization_id,'territory',t.territory,
    'summary',result_summary,'activity',result_activity,
    'withdrawableMinor',0,'payoutEnabled',false);
END;
$$;
ALTER FUNCTION public.da_qa_wallet_read_attested_010(uuid,integer)
  OWNER TO da_qa_wallet_read_owner_010;
REVOKE ALL ON FUNCTION public.da_qa_wallet_read_attested_010(uuid,integer)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_read_attested_010(uuid,integer)
  TO da_qa_merchant_commerce_app,da_qa_courier_commerce_app;

COMMENT ON FUNCTION public.da_qa_wallet_attest_010(
  uuid,text,uuid,varchar,uuid,char(2))
  IS 'QA only. Trusted separated attestor must verify real OIDC and committed registry before use; test fixtures are NOT production identity evidence.';
COMMENT ON FUNCTION public.da_qa_wallet_read_attested_010(uuid,integer)
  IS 'QA only. Backend-bound one-use scope, active registry recheck, no payout. Does not expose raw issuer/subject parameters to shared DB login.';
COMMIT;
