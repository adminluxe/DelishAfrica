-- DelishAfrica F4L / SQL 016 / real PostgreSQL 17 DISCONNECTED QA ONLY.
-- Never apply to VPS or persistent environments. All parties, money and orders synthetic.
-- Dedicated machine OIDC attestor + SQL authority; never regrant SQL 007 to mobile.
BEGIN;
DO $$
BEGIN
 IF to_regprocedure('public.da_qa_dispatch_assign_offer(uuid,text,uuid)') IS NULL
 OR to_regprocedure('public.da_qa_partner_transition_attested_015(uuid,text,uuid,text)') IS NULL
 OR to_regclass('public.da_qa_finance_courier_roster_012') IS NULL
 THEN RAISE EXCEPTION 'qa_f4l_f4k_prerequisite_missing'; END IF;
END $$;
CREATE ROLE da_qa_dispatch_owner_016 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_dispatch_machine_016 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_dispatch_attestor_016 LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO da_qa_dispatch_owner_016,da_qa_dispatch_machine_016,da_qa_dispatch_attestor_016;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.da_qa_dispatch_assign_offer(uuid,text,uuid)
 FROM PUBLIC,da_qa_dispatch_commerce_app,da_qa_merchant_commerce_app,
      da_qa_courier_commerce_app,da_qa_dispatch_machine_016,da_qa_dispatch_attestor_016;
GRANT EXECUTE ON FUNCTION public.da_qa_dispatch_assign_offer(uuid,text,uuid),
 public.da_qa_commerce_order_dispatch_eligible(uuid)
 TO da_qa_dispatch_owner_016;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_current_backend_start_010()
 TO da_qa_dispatch_owner_016;

CREATE TABLE public.da_qa_dispatch_machine_registry_016(
 issuer text NOT NULL, subject uuid NOT NULL, client_id text NOT NULL,
 organization_id uuid NOT NULL, territory char(2) NOT NULL,
 required_scope text NOT NULL DEFAULT 'da.dispatch.assign'
   CHECK(required_scope='da.dispatch.assign'),
 grant_status text NOT NULL DEFAULT 'active'
   CHECK(grant_status IN('active','suspended','revoked')),
 valid_until timestamptz,
 PRIMARY KEY(issuer,subject,organization_id,territory),
 FOREIGN KEY(organization_id,territory) REFERENCES
   public.da_qa_finance_legal_entities_012(organization_id,territory),
 CHECK(client_id='da-f4l-dispatch-machine-qa')
);
ALTER TABLE public.da_qa_dispatch_machine_registry_016 OWNER TO da_qa_dispatch_owner_016;
CREATE TABLE public.da_qa_dispatch_challenge_016(
 challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 db_login name NOT NULL, backend_pid integer NOT NULL,
 backend_start timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.da_qa_dispatch_challenge_016 OWNER TO da_qa_dispatch_owner_016;
CREATE TABLE public.da_qa_dispatch_ticket_016(
 ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 challenge_id uuid NOT NULL UNIQUE REFERENCES public.da_qa_dispatch_challenge_016,
 issuer text NOT NULL, subject uuid NOT NULL, client_id text NOT NULL,
 organization_id uuid NOT NULL, territory char(2) NOT NULL,
 token_digest char(64) NOT NULL CHECK(token_digest ~ '^[a-f0-9]{64}$'),
 order_id uuid NOT NULL REFERENCES public.da_client_commerce_order_snapshot_qa(order_id),
 courier_issuer text NOT NULL, courier_subject uuid NOT NULL,
 expires_at timestamptz NOT NULL, consumed_at timestamptz
);
ALTER TABLE public.da_qa_dispatch_ticket_016 OWNER TO da_qa_dispatch_owner_016;
CREATE TABLE public.da_qa_dispatch_receipt_016(
 order_id uuid PRIMARY KEY REFERENCES public.da_client_commerce_order_snapshot_qa(order_id),
 machine_issuer text NOT NULL, machine_subject uuid NOT NULL,
 machine_client_id text NOT NULL, organization_id uuid NOT NULL,
 territory char(2) NOT NULL, courier_issuer text NOT NULL,
 courier_subject uuid NOT NULL, operation text NOT NULL DEFAULT 'assigned'
   CHECK(operation='assigned'), committed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.da_qa_dispatch_receipt_016 OWNER TO da_qa_dispatch_owner_016;
CREATE TRIGGER da_qa_dispatch_receipt_016_append_only
 BEFORE UPDATE OR DELETE ON public.da_qa_dispatch_receipt_016
 FOR EACH ROW EXECUTE FUNCTION public.da_qa_wallet_append_only();
REVOKE ALL ON TABLE public.da_qa_dispatch_machine_registry_016,
 public.da_qa_dispatch_challenge_016,public.da_qa_dispatch_ticket_016,
 public.da_qa_dispatch_receipt_016 FROM PUBLIC,
 da_qa_dispatch_commerce_app,da_qa_merchant_commerce_app,
 da_qa_courier_commerce_app,da_qa_dispatch_machine_016,da_qa_dispatch_attestor_016;
GRANT SELECT ON TABLE public.da_client_commerce_orders_qa,
 public.da_qa_fulfillment_state,public.da_qa_courier_offer,
 public.da_catalog_partners,public.da_qa_finance_partner_entities_012,
 public.da_qa_finance_legal_entities_012,public.da_identity_subjects,
 public.da_qa_finance_courier_roster_012 TO da_qa_dispatch_owner_016;
-- FOR SHARE / UPDATE requires UPDATE permission: only stable ID columns.
GRANT UPDATE(order_id) ON public.da_client_commerce_orders_qa TO da_qa_dispatch_owner_016;
GRANT UPDATE(order_id) ON public.da_qa_fulfillment_state TO da_qa_dispatch_owner_016;
GRANT UPDATE(order_id) ON public.da_qa_courier_offer TO da_qa_dispatch_owner_016;
GRANT UPDATE(partner_id) ON public.da_catalog_partners TO da_qa_dispatch_owner_016;
GRANT UPDATE(partner_id) ON public.da_qa_finance_partner_entities_012 TO da_qa_dispatch_owner_016;
GRANT UPDATE(organization_id) ON public.da_qa_finance_legal_entities_012 TO da_qa_dispatch_owner_016;
GRANT UPDATE(issuer) ON public.da_identity_subjects TO da_qa_dispatch_owner_016;
GRANT UPDATE(issuer) ON public.da_qa_finance_courier_roster_012 TO da_qa_dispatch_owner_016;

-- This challenge is minted by ONE machine SQL backend, not by mobile.
CREATE FUNCTION public.da_qa_dispatch_begin_016() RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid; v_start timestamptz;
BEGIN
 IF session_user<>'da_qa_dispatch_machine_016'
 THEN RAISE EXCEPTION 'qa_f4l_machine_login_required'; END IF;
 v_start:=public.da_qa_wallet_current_backend_start_010();
 IF v_start IS NULL THEN RAISE EXCEPTION 'qa_f4l_backend_unverified'; END IF;
 INSERT INTO public.da_qa_dispatch_challenge_016(db_login,backend_pid,backend_start)
 VALUES(session_user,pg_backend_pid(),v_start) RETURNING challenge_id INTO v_id;
 RETURN v_id;
END $$;
ALTER FUNCTION public.da_qa_dispatch_begin_016() OWNER TO da_qa_dispatch_owner_016;
REVOKE ALL ON FUNCTION public.da_qa_dispatch_begin_016() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_dispatch_begin_016() TO da_qa_dispatch_machine_016;

-- Only a separate private SQL identity may attest a verified OIDC service token.
-- SQL rechecks machine registry again AT consumption, under row lock.
CREATE FUNCTION public.da_qa_dispatch_attest_016(
 p_challenge uuid,p_issuer text,p_subject uuid,p_client_id text,
 p_org uuid,p_territory char(2),p_token_digest text,p_order uuid,
 p_courier_issuer text,p_courier_subject uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE ch public.da_qa_dispatch_challenge_016%ROWTYPE;
 grant_row public.da_qa_dispatch_machine_registry_016%ROWTYPE;
 v_id uuid;
BEGIN
 IF session_user<>'da_qa_dispatch_attestor_016' OR
 p_challenge IS NULL OR p_subject IS NULL OR p_order IS NULL OR
 p_courier_subject IS NULL OR p_org IS NULL OR p_territory IS NULL OR
 p_token_digest !~ '^[a-f0-9]{64}$' OR
 p_client_id<>'da-f4l-dispatch-machine-qa'
 THEN RAISE EXCEPTION 'qa_f4l_machine_attestation_denied'; END IF;
 SELECT * INTO ch FROM public.da_qa_dispatch_challenge_016
 WHERE challenge_id=p_challenge FOR UPDATE;
 IF NOT FOUND OR ch.db_login<>'da_qa_dispatch_machine_016' OR
 ch.created_at<clock_timestamp()-interval '20 seconds' OR
 EXISTS(SELECT 1 FROM public.da_qa_dispatch_ticket_016 WHERE challenge_id=p_challenge)
 THEN RAISE EXCEPTION 'qa_f4l_challenge_expired_or_replayed'; END IF;
 SELECT * INTO grant_row FROM public.da_qa_dispatch_machine_registry_016 m
 WHERE m.issuer=p_issuer AND m.subject=p_subject AND m.client_id=p_client_id
  AND m.organization_id=p_org AND m.territory=p_territory FOR SHARE;
 IF NOT FOUND OR grant_row.grant_status<>'active'
   OR (grant_row.valid_until IS NOT NULL AND grant_row.valid_until<=clock_timestamp())
 THEN RAISE EXCEPTION 'qa_f4l_machine_registry_denied'; END IF;
 INSERT INTO public.da_qa_dispatch_ticket_016(
 challenge_id,issuer,subject,client_id,organization_id,territory,
 token_digest,order_id,courier_issuer,courier_subject,expires_at)
 VALUES(p_challenge,p_issuer,p_subject,p_client_id,p_org,p_territory,
 p_token_digest,p_order,p_courier_issuer,p_courier_subject,
 clock_timestamp()+interval '12 seconds')
 RETURNING ticket_id INTO v_id;
 RETURN v_id;
END $$;
ALTER FUNCTION public.da_qa_dispatch_attest_016(
 uuid,text,uuid,text,uuid,char(2),text,uuid,text,uuid
) OWNER TO da_qa_dispatch_owner_016;
REVOKE ALL ON FUNCTION public.da_qa_dispatch_attest_016(
 uuid,text,uuid,text,uuid,char(2),text,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_dispatch_attest_016(
 uuid,text,uuid,text,uuid,char(2),text,uuid,text,uuid)
 TO da_qa_dispatch_attestor_016;

-- Only machine connection can atomically consume its single-use attestation.
-- Lock ORDER FIRST before finance checks and offer (identical 008 ordering).
-- Registry, partner binding, legal entity, courier identity and roster locked
-- in the SAME PG transaction: a committed revocation always wins if first.
CREATE FUNCTION public.da_qa_dispatch_assign_attested_016(p_ticket uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
 t public.da_qa_dispatch_ticket_016%ROWTYPE;
 ch public.da_qa_dispatch_challenge_016%ROWTYPE;
 m public.da_qa_dispatch_machine_registry_016%ROWTYPE;
 o public.da_client_commerce_orders_qa%ROWTYPE;
 f public.da_qa_fulfillment_state%ROWTYPE;
 partner record;
 ident public.da_identity_subjects%ROWTYPE;
 courier public.da_qa_finance_courier_roster_012%ROWTYPE;
 legal public.da_qa_finance_legal_entities_012%ROWTYPE;
 existing public.da_qa_courier_offer%ROWTYPE;
 receipt public.da_qa_dispatch_receipt_016%ROWTYPE;
 next_state text;
 created integer;
BEGIN
 IF session_user<>'da_qa_dispatch_machine_016' OR p_ticket IS NULL
 THEN RAISE EXCEPTION 'qa_f4l_machine_login_required'; END IF;
 SELECT * INTO t FROM public.da_qa_dispatch_ticket_016 x
 WHERE x.ticket_id=p_ticket FOR UPDATE;
 IF NOT FOUND OR t.consumed_at IS NOT NULL OR t.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'qa_f4l_ticket_replayed_or_expired'; END IF;
 SELECT * INTO ch FROM public.da_qa_dispatch_challenge_016 x
 WHERE x.challenge_id=t.challenge_id;
 IF NOT FOUND OR ch.db_login<>session_user OR
 ch.backend_pid<>pg_backend_pid() OR
 ch.backend_start IS DISTINCT FROM public.da_qa_wallet_current_backend_start_010()
 THEN RAISE EXCEPTION 'qa_f4l_backend_binding_denied'; END IF;
 -- Order lock FIRST, matching refund/pickup/dispatch 008.
 SELECT * INTO o FROM public.da_client_commerce_orders_qa x
 WHERE x.order_id=t.order_id FOR UPDATE;
 IF NOT FOUND OR o.state<>'paid'
    OR NOT public.da_qa_commerce_order_dispatch_eligible(t.order_id)
 THEN RAISE EXCEPTION 'qa_f4l_order_payment_hold'; END IF;
 SELECT * INTO f FROM public.da_qa_fulfillment_state x
 WHERE x.order_id=t.order_id FOR SHARE;
 IF NOT FOUND OR f.state<>'ready' OR f.merchant_slug<>o.merchant_slug
 THEN RAISE EXCEPTION 'qa_f4l_order_not_ready'; END IF;
 SELECT * INTO m FROM public.da_qa_dispatch_machine_registry_016 x
 WHERE x.issuer=t.issuer AND x.subject=t.subject AND
   x.client_id=t.client_id AND x.organization_id=t.organization_id AND
   x.territory=t.territory FOR SHARE;
 IF NOT FOUND OR m.grant_status<>'active' OR
 (m.valid_until IS NOT NULL AND m.valid_until<=clock_timestamp())
 THEN RAISE EXCEPTION 'qa_f4l_machine_revoked'; END IF;
 SELECT p.partner_id,p.lifecycle_status,b.organization_id,b.territory,
   b.valid_from AS partner_from,b.valid_until AS partner_until,
   b.revoked_at AS partner_revoked,e.legal_status,
   e.kyb_status AS legal_kyb,e.valid_from AS legal_from,
   e.valid_until AS legal_until,e.revoked_at AS legal_revoked
 INTO partner
 FROM public.da_catalog_partners p
 JOIN public.da_qa_finance_partner_entities_012 b ON b.partner_id=p.partner_id
 JOIN public.da_qa_finance_legal_entities_012 e
 ON e.organization_id=b.organization_id AND e.territory=b.territory
 WHERE p.slug=o.merchant_slug FOR SHARE OF p,b,e;
 IF NOT FOUND OR partner.lifecycle_status<>'published'
 OR partner.organization_id<>t.organization_id OR partner.territory<>t.territory
 OR partner.partner_revoked IS NOT NULL OR partner.partner_from>clock_timestamp()
 OR (partner.partner_until IS NOT NULL AND partner.partner_until<=clock_timestamp())
 OR partner.legal_status<>'active' OR partner.legal_kyb<>'verified'
 OR partner.legal_revoked IS NOT NULL OR partner.legal_from>clock_timestamp()
 OR (partner.legal_until IS NOT NULL AND partner.legal_until<=clock_timestamp())
 THEN RAISE EXCEPTION 'qa_f4l_merchant_organization_denied'; END IF;
 SELECT * INTO ident FROM public.da_identity_subjects i
 WHERE i.issuer=t.courier_issuer AND i.subject=t.courier_subject::text
 FOR UPDATE;
 IF NOT FOUND OR ident.identity_status<>'active' OR ident.identity_kind<>'courier'
 THEN RAISE EXCEPTION 'qa_f4l_courier_identity_denied'; END IF;
 SELECT * INTO courier FROM public.da_qa_finance_courier_roster_012 c
 WHERE c.issuer=t.courier_issuer AND c.subject=t.courier_subject::text
 FOR SHARE;
 IF NOT FOUND OR courier.roster_status<>'active'
 OR courier.agreement_status<>'active' OR courier.kyc_status<>'verified'
 OR courier.revoked_at IS NOT NULL
 OR courier.valid_from>clock_timestamp()
 OR (courier.valid_until IS NOT NULL AND courier.valid_until<=clock_timestamp())
 OR courier.organization_id<>t.organization_id OR courier.territory<>t.territory
 THEN RAISE EXCEPTION 'qa_f4l_courier_roster_or_territory_denied'; END IF;
 SELECT * INTO legal FROM public.da_qa_finance_legal_entities_012 e
 WHERE e.organization_id=courier.organization_id AND e.territory=courier.territory
 FOR SHARE;
 IF NOT FOUND OR legal.legal_status<>'active' OR legal.kyb_status<>'verified'
 OR legal.revoked_at IS NOT NULL
 OR legal.valid_from>clock_timestamp()
 OR (legal.valid_until IS NOT NULL AND legal.valid_until<=clock_timestamp())
 THEN RAISE EXCEPTION 'qa_f4l_legal_entity_denied'; END IF;
 SELECT * INTO existing FROM public.da_qa_courier_offer x
 WHERE x.order_id=t.order_id FOR UPDATE;
 IF FOUND AND (existing.courier_issuer<>t.courier_issuer OR
  existing.courier_subject<>t.courier_subject OR existing.state<>'offered')
 THEN RAISE EXCEPTION 'qa_f4l_reassignment_or_picked_up_denied'; END IF;
 next_state:=public.da_qa_dispatch_assign_offer(
   t.order_id,t.courier_issuer,t.courier_subject);
 IF next_state<>'offered' THEN RAISE EXCEPTION 'qa_f4l_offer_state_invalid'; END IF;
 INSERT INTO public.da_qa_dispatch_receipt_016(
 order_id,machine_issuer,machine_subject,machine_client_id,
 organization_id,territory,courier_issuer,courier_subject)
 VALUES(t.order_id,t.issuer,t.subject,t.client_id,t.organization_id,
 t.territory,t.courier_issuer,t.courier_subject)
 ON CONFLICT(order_id) DO NOTHING;
 GET DIAGNOSTICS created=ROW_COUNT;
 SELECT * INTO receipt FROM public.da_qa_dispatch_receipt_016 r
 WHERE r.order_id=t.order_id FOR SHARE;
 IF NOT FOUND OR receipt.machine_issuer<>t.issuer OR
 receipt.machine_subject<>t.subject OR receipt.machine_client_id<>t.client_id OR
 receipt.courier_issuer<>t.courier_issuer OR
 receipt.courier_subject<>t.courier_subject
 THEN RAISE EXCEPTION 'qa_f4l_receipt_collision'; END IF;
 UPDATE public.da_qa_dispatch_ticket_016 SET consumed_at=clock_timestamp()
 WHERE ticket_id=p_ticket;
 RETURN jsonb_build_object('mode','qa_synthetic_only',
  'orderId',t.order_id,'state',next_state,
  'replayed',(created=0),'payoutEnabled',false,'withdrawableMinor',0);
END $$;
ALTER FUNCTION public.da_qa_dispatch_assign_attested_016(uuid)
 OWNER TO da_qa_dispatch_owner_016;
REVOKE ALL ON FUNCTION public.da_qa_dispatch_assign_attested_016(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_dispatch_assign_attested_016(uuid)
 TO da_qa_dispatch_machine_016;
COMMENT ON FUNCTION public.da_qa_dispatch_assign_attested_016(uuid) IS
 'QA F4L only: real Keycloak machine identity, private attestor, bound ticket, atomic PG17 roster/org/payment/refund locks; no payout, no public app access.';
COMMIT;
