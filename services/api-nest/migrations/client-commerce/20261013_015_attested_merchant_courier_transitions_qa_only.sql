-- DelishAfrica F4K / SQL 015 / DISCONNECTED PG17 QA-ONLY.
-- SYNTHETIC Merchant/Courier identities and payments, no Stripe calls/payout.
-- NEVER execute on VPS or any persistent/production database.
-- Prerequisites: wallet 001..014, catalogue and isolated attestor 013.
-- Dispatch retains NO callable application write entrypoint.
BEGIN;
DO $$
BEGIN
  IF to_regprocedure('public.da_qa_wallet_read_linearized_014(uuid,integer,text)') IS NULL
    OR to_regprocedure('public.da_qa_merchant_transition(uuid,character varying,text)') IS NULL
    OR to_regprocedure('public.da_qa_courier_transition(uuid,text,uuid,text)') IS NULL
    OR to_regclass('public.da_qa_partner_oidc_sessions_011') IS NULL
  THEN RAISE EXCEPTION 'qa_f4k_required_strict_identity_schema_missing';
  END IF;
END $$;

CREATE ROLE da_qa_fulfillment_writer_015 NOLOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO da_qa_fulfillment_writer_015;
-- The legacy 007 routines remain denied to app logins. Only a NOLOGIN
-- SECURITY DEFINER wrapper that FIRST consumes F4J's authenticated ticket
-- can call them. Dispatch 007 is deliberately NEVER granted to this role.
REVOKE EXECUTE ON FUNCTION
  public.da_qa_merchant_transition(uuid,varchar,text),
  public.da_qa_courier_transition(uuid,text,uuid,text),
  public.da_qa_dispatch_assign_offer(uuid,text,uuid)
  FROM PUBLIC,da_qa_merchant_commerce_app,
       da_qa_courier_commerce_app,da_qa_dispatch_commerce_app;
GRANT EXECUTE ON FUNCTION
  public.da_qa_wallet_read_linearized_014(uuid,integer,text),
  public.da_qa_merchant_transition(uuid,varchar,text),
  public.da_qa_courier_transition(uuid,text,uuid,text)
  TO da_qa_fulfillment_writer_015;
GRANT SELECT ON TABLE public.da_qa_wallet_ticket_010
  TO da_qa_fulfillment_writer_015;

CREATE TABLE public.da_qa_fulfillment_receipt_015(
  order_id uuid NOT NULL REFERENCES
    public.da_client_commerce_order_snapshot_qa(order_id)
    ON DELETE RESTRICT,
  actor_role text NOT NULL CHECK(actor_role IN('merchant','courier')),
  operation text NOT NULL CHECK(operation IN
    ('accepted','ready','picked_up','delivered')),
  actor_issuer text NOT NULL,
  actor_subject uuid NOT NULL,
  committed_state text NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(order_id,actor_role,operation),
  CHECK(
    (actor_role='merchant' AND operation IN('accepted','ready'))
    OR (actor_role='courier' AND operation IN
      ('accepted','picked_up','delivered'))
  )
);
ALTER TABLE public.da_qa_fulfillment_receipt_015
  OWNER TO da_qa_fulfillment_writer_015;
REVOKE ALL ON TABLE public.da_qa_fulfillment_receipt_015 FROM PUBLIC,
  da_qa_merchant_commerce_app,da_qa_courier_commerce_app,
  da_qa_dispatch_commerce_app,da_qa_wallet_attestor_isolated_013;
CREATE TRIGGER da_qa_fulfillment_receipt_015_append_only
  BEFORE UPDATE OR DELETE ON public.da_qa_fulfillment_receipt_015
  FOR EACH ROW EXECUTE FUNCTION public.da_qa_wallet_append_only();

-- One strictly bounded operational transition from a Keycloak-verified,
-- PG-live session. The private attestor created the 010 ticket on THIS
-- app backend. SQL 014 then serializes the legal membership/roster and
-- session WITH ticket consumption, and the historical 007 mutation
-- serializes order/payment holds. One SQL call = one PG transaction.
CREATE FUNCTION public.da_qa_partner_transition_attested_015(
  p_ticket uuid,p_session_sha256 text,p_order uuid,p_next text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  t public.da_qa_wallet_ticket_010%ROWTYPE;
  proof jsonb;
  next_state text;
  existing public.da_qa_fulfillment_receipt_015%ROWTYPE;
  created integer;
BEGIN
  IF p_ticket IS NULL OR p_order IS NULL OR
     p_session_sha256 IS NULL OR
     p_session_sha256 !~ '^[a-f0-9]{64}$' OR
     p_next IS NULL OR
     session_user NOT IN('da_qa_merchant_commerce_app',
                         'da_qa_courier_commerce_app')
  THEN RAISE EXCEPTION 'qa_f4k_operation_identity_denied'; END IF;
  IF (session_user='da_qa_merchant_commerce_app' AND
      p_next NOT IN ('accepted','ready')) OR
     (session_user='da_qa_courier_commerce_app' AND
      p_next NOT IN ('accepted','picked_up','delivered'))
  THEN RAISE EXCEPTION 'qa_f4k_invalid_role_operation'; END IF;

  SELECT * INTO t FROM public.da_qa_wallet_ticket_010 AS x
    WHERE x.ticket_id=p_ticket FOR SHARE;
  IF NOT FOUND OR
    (session_user='da_qa_merchant_commerce_app' AND
      t.owner_kind<>'merchant') OR
    (session_user='da_qa_courier_commerce_app' AND
      t.owner_kind<>'courier')
  THEN RAISE EXCEPTION 'qa_f4k_untrusted_ticket_role'; END IF;

  -- The wallet 014 result is not returned as an after-transition balance.
  -- It is an AUTHORIZATION PROOF from this same transaction; any status
  -- change to the verified SQL authorities waits until this call ends.
  proof:=public.da_qa_wallet_read_linearized_014(
    p_ticket,1,p_session_sha256);
  IF proof->>'mode'<>'qa_synthetic_only' OR
     proof->>'ownerRole'<>t.owner_kind OR
     proof->>'organizationId'<>t.organization_id::text OR
     proof->>'territory'<>btrim(t.territory::text) OR
     (proof->>'withdrawableMinor')::integer<>0 OR
     proof->>'payoutEnabled'<>'false'
  THEN RAISE EXCEPTION 'qa_f4k_authorization_mismatch'; END IF;

  IF t.owner_kind='merchant' THEN
    IF proof->>'merchantSlug' IS DISTINCT FROM t.merchant_slug THEN
      RAISE EXCEPTION 'qa_f4k_merchant_slug_spoofed'; END IF;
    next_state:=public.da_qa_merchant_transition(
      p_order,t.merchant_slug,p_next);
  ELSIF t.owner_kind='courier' THEN
    IF t.merchant_slug IS NOT NULL OR
       proof->>'merchantSlug' IS NOT NULL THEN
      RAISE EXCEPTION 'qa_f4k_courier_slug_spoofed'; END IF;
    next_state:=public.da_qa_courier_transition(
      p_order,t.issuer,t.subject,p_next);
  ELSE RAISE EXCEPTION 'qa_f4k_actor_role_denied'; END IF;
  IF next_state<>p_next THEN
    RAISE EXCEPTION 'qa_f4k_transition_state_mismatch'; END IF;

  INSERT INTO public.da_qa_fulfillment_receipt_015(
    order_id,actor_role,operation,actor_issuer,actor_subject,
    committed_state)
  VALUES(p_order,t.owner_kind,p_next,t.issuer,t.subject,next_state)
  ON CONFLICT(order_id,actor_role,operation) DO NOTHING;
  GET DIAGNOSTICS created=ROW_COUNT;
  SELECT * INTO existing FROM public.da_qa_fulfillment_receipt_015 r
    WHERE r.order_id=p_order AND r.actor_role=t.owner_kind
      AND r.operation=p_next FOR SHARE;
  IF NOT FOUND OR existing.actor_issuer<>t.issuer OR
    existing.actor_subject<>t.subject OR
    existing.committed_state<>next_state
  THEN RAISE EXCEPTION 'qa_f4k_replay_identity_collision'; END IF;

  RETURN jsonb_build_object(
    'mode','qa_synthetic_only',
    'orderId',p_order,
    'ownerRole',t.owner_kind,
    'state',next_state,
    'replayed',(created=0),
    'withdrawableMinor',0,
    'payoutEnabled',false);
END
$$;
ALTER FUNCTION public.da_qa_partner_transition_attested_015(
  uuid,text,uuid,text) OWNER TO da_qa_fulfillment_writer_015;
REVOKE ALL ON FUNCTION public.da_qa_partner_transition_attested_015(
  uuid,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_partner_transition_attested_015(
  uuid,text,uuid,text) TO da_qa_merchant_commerce_app,
    da_qa_courier_commerce_app;

COMMENT ON TABLE public.da_qa_fulfillment_receipt_015 IS
  'F4K isolated synthetic QA: immutable exactly-once successful operational transition receipts. Not a financial posting or payout.';
COMMENT ON FUNCTION public.da_qa_partner_transition_attested_015(
  uuid,text,uuid,text) IS
  'F4K QA only: ticket consumed via PG14 legal+session locks, order locks/payment holds via legacy PG07, receipt append-only. No dispatch exposure. NO Stripe transfer.';
COMMIT;
