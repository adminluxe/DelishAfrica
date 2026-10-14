-- DELISHAFRICA 2026-10-13 | 007 | DISCONNECTED PG17 QA ONLY.
-- Never run on VPS. Roles below are ephemeral QA logins under --network none.
-- Financial proof + immutable basket are mandatory for every transition.
-- Issuer/subject and merchant eligibility MUST be verified in a trusted
-- Nest guard and membership/roster ports; SQL args alone are not identity.
BEGIN;

CREATE ROLE da_qa_merchant_commerce_app LOGIN NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_dispatch_commerce_app LOGIN NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_courier_commerce_app LOGIN NOSUPERUSER NOCREATEDB
  NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO
  da_qa_merchant_commerce_app,da_qa_dispatch_commerce_app,
  da_qa_courier_commerce_app;

CREATE TABLE public.da_qa_fulfillment_state (
  order_id uuid PRIMARY KEY REFERENCES public.da_client_commerce_order_snapshot_qa(order_id),
  merchant_slug varchar(120) NOT NULL CHECK (merchant_slug ~ '^[a-z0-9][a-z0-9_-]{1,119}$'),
  state text NOT NULL CHECK (state IN ('accepted','ready')),
  accepted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  ready_at timestamptz,
  CONSTRAINT da_qa_fulfillment_ready_clock CHECK (
    (state='accepted' AND ready_at IS NULL) OR
    (state='ready' AND ready_at IS NOT NULL)
  )
);

CREATE TABLE public.da_qa_courier_offer (
  order_id uuid PRIMARY KEY REFERENCES public.da_qa_fulfillment_state(order_id),
  courier_issuer text NOT NULL CHECK (
    courier_issuer ~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$'),
  courier_subject uuid NOT NULL,
  state text NOT NULL DEFAULT 'offered'
    CHECK (state IN ('offered','accepted','picked_up','delivered')),
  offered_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  CONSTRAINT da_qa_courier_offer_monotonic_times CHECK (
    (state='offered' AND accepted_at IS NULL AND picked_up_at IS NULL AND delivered_at IS NULL)
    OR (state='accepted' AND accepted_at IS NOT NULL AND picked_up_at IS NULL AND delivered_at IS NULL)
    OR (state='picked_up' AND accepted_at IS NOT NULL AND picked_up_at IS NOT NULL AND delivered_at IS NULL)
    OR (state='delivered' AND accepted_at IS NOT NULL AND picked_up_at IS NOT NULL AND delivered_at IS NOT NULL)
  )
);

REVOKE ALL ON TABLE public.da_qa_fulfillment_state,
  public.da_qa_courier_offer FROM PUBLIC,
  da_qa_client_commerce_app,da_qa_merchant_commerce_app,
  da_qa_dispatch_commerce_app,da_qa_courier_commerce_app,
  da_qa_psp_verified_receiver,da_qa_stripe_finance_reconciler;

-- Merchant inbox is a projection of the actual captured and verified
-- financial receipt. A hold retains the row for review, never "ready".
-- The app passes a slug obtained ONLY from verified membership, not HTTP.
CREATE FUNCTION public.da_qa_merchant_visible_paid_orders(
  p_merchant varchar,p_limit integer DEFAULT 30)
RETURNS TABLE(
  order_id uuid,merchant_slug varchar,items jsonb,
  total_minor bigint,currency char(3),
  fulfillment_state text,financial_state text,
  dispatch_eligible boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT o.order_id,s.merchant_slug,s.line_items,
    o.total_minor,o.currency,
    COALESCE(f.state,'new')::text,
    CASE WHEN EXISTS (
       SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
       WHERE h.authority_id=a.authority_id
    ) THEN 'financial_hold' ELSE 'paid' END::text,
    public.da_qa_commerce_order_dispatch_eligible(o.order_id)
  FROM public.da_client_commerce_orders_qa o
  JOIN public.da_client_commerce_order_snapshot_qa s
    ON s.order_id=o.order_id AND s.merchant_slug=o.merchant_slug
      AND s.quote_fingerprint=o.quote_fingerprint
      AND s.cart_fingerprint=o.cart_fingerprint
      AND s.total_minor=o.total_minor AND s.currency=o.currency
  JOIN public.da_client_commerce_payment_authority_qa a
    ON a.order_id=o.order_id AND a.state='succeeded' AND a.provider_verified
    AND a.stripe_mode='test'
  JOIN public.da_stripe_test_financial_receipts_qa r
    ON r.authority_id=a.authority_id
      AND r.stripe_payment_intent_id=a.stripe_payment_intent_id
      AND r.amount_captured=o.total_minor AND r.currency=o.currency
  LEFT JOIN public.da_qa_fulfillment_state f ON f.order_id=o.order_id
  WHERE o.state='paid' AND o.merchant_slug=p_merchant
    AND p_merchant ~ '^[a-z0-9][a-z0-9_-]{1,119}$'
    AND p_limit BETWEEN 1 AND 50
  ORDER BY o.created_at DESC,o.order_id
  LIMIT LEAST(GREATEST(p_limit,1),50);
$$;
REVOKE ALL ON FUNCTION public.da_qa_merchant_visible_paid_orders(
  varchar,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_merchant_visible_paid_orders(
  varchar,integer) TO da_qa_merchant_commerce_app;

-- Ready requires accepting the exact paid merchant order first.
-- Lock the order before rechecking the financial proof each time.
CREATE FUNCTION public.da_qa_merchant_transition(
  p_order uuid,p_merchant varchar,p_next text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  f public.da_qa_fulfillment_state%ROWTYPE;
BEGIN
  IF p_next NOT IN ('accepted','ready')
    OR p_merchant IS NULL OR p_merchant !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
    THEN RAISE EXCEPTION 'qa_merchant_transition_invalid'; END IF;
  SELECT * INTO o FROM public.da_client_commerce_orders_qa
    WHERE public.da_client_commerce_orders_qa.order_id=p_order
      AND merchant_slug=p_merchant FOR UPDATE;
  IF NOT FOUND OR NOT public.da_qa_commerce_order_dispatch_eligible(p_order)
    THEN RAISE EXCEPTION 'qa_merchant_not_owned_or_financial_hold'; END IF;
  IF p_next='accepted' THEN
    INSERT INTO public.da_qa_fulfillment_state(order_id,merchant_slug,state)
      VALUES(p_order,p_merchant,'accepted') ON CONFLICT(order_id) DO NOTHING;
  END IF;
  SELECT * INTO f FROM public.da_qa_fulfillment_state
    WHERE public.da_qa_fulfillment_state.order_id=p_order FOR UPDATE;
  IF NOT FOUND OR f.merchant_slug<>p_merchant THEN
    RAISE EXCEPTION 'qa_merchant_accept_required_before_ready'; END IF;
  IF f.state=p_next THEN RETURN f.state; END IF;
  IF f.state='accepted' AND p_next='ready' THEN
    UPDATE public.da_qa_fulfillment_state
      SET state='ready',ready_at=statement_timestamp()
      WHERE order_id=p_order;
    RETURN 'ready';
  END IF;
  RAISE EXCEPTION 'qa_merchant_transition_regression_forbidden';
END;
$$;
REVOKE ALL ON FUNCTION public.da_qa_merchant_transition(
  uuid,varchar,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_merchant_transition(
  uuid,varchar,text) TO da_qa_merchant_commerce_app;

-- System dispatch only: the Courier app cannot self-select or self-offer.
-- One assigned Courier per order in QA. Reassignment requires a new,
-- independently audited contract; silent reassign is forbidden.
CREATE FUNCTION public.da_qa_dispatch_assign_offer(
  p_order uuid,p_courier_issuer text,p_courier_subject uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  f public.da_qa_fulfillment_state%ROWTYPE;
  c public.da_qa_courier_offer%ROWTYPE;
BEGIN
  IF p_courier_issuer IS NULL OR
    p_courier_issuer !~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$'
    OR p_courier_subject IS NULL THEN
    RAISE EXCEPTION 'qa_dispatch_verified_roster_required'; END IF;
  SELECT * INTO o FROM public.da_client_commerce_orders_qa
    WHERE public.da_client_commerce_orders_qa.order_id=p_order FOR UPDATE;
  SELECT * INTO f FROM public.da_qa_fulfillment_state
    WHERE public.da_qa_fulfillment_state.order_id=p_order FOR UPDATE;
  IF o.order_id IS NULL OR f.state IS DISTINCT FROM 'ready'
    OR NOT public.da_qa_commerce_order_dispatch_eligible(p_order) THEN
    RAISE EXCEPTION 'qa_dispatch_unpaid_or_not_ready'; END IF;
  INSERT INTO public.da_qa_courier_offer(
    order_id,courier_issuer,courier_subject,state
  ) VALUES(p_order,p_courier_issuer,p_courier_subject,'offered')
  ON CONFLICT(order_id) DO NOTHING;
  SELECT * INTO c FROM public.da_qa_courier_offer
    WHERE public.da_qa_courier_offer.order_id=p_order FOR UPDATE;
  IF c.courier_issuer<>p_courier_issuer OR
     c.courier_subject<>p_courier_subject THEN
     RAISE EXCEPTION 'qa_dispatch_assignee_immutable'; END IF;
  RETURN c.state;
END;
$$;
REVOKE ALL ON FUNCTION public.da_qa_dispatch_assign_offer(
  uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_dispatch_assign_offer(
  uuid,text,uuid) TO da_qa_dispatch_commerce_app;

-- Courier sees ONLY offers assigned to the verified issuer/subject.
CREATE FUNCTION public.da_qa_courier_assigned_offers(
  p_issuer text,p_subject uuid,p_limit integer DEFAULT 20)
RETURNS TABLE(
  order_id uuid,merchant_slug varchar,delivery_state text,
  financial_state text,action_eligible boolean
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
  SELECT c.order_id,o.merchant_slug,c.state,
    CASE WHEN public.da_qa_commerce_order_dispatch_eligible(c.order_id)
      THEN 'paid' ELSE 'financial_hold' END::text,
    public.da_qa_commerce_order_dispatch_eligible(c.order_id)
  FROM public.da_qa_courier_offer c
  JOIN public.da_client_commerce_orders_qa o ON o.order_id=c.order_id
  WHERE c.courier_issuer=p_issuer AND c.courier_subject=p_subject
    AND p_issuer ~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$'
    AND p_limit BETWEEN 1 AND 50
  ORDER BY c.offered_at DESC,c.order_id
  LIMIT LEAST(GREATEST(p_limit,1),50);
$$;
REVOKE ALL ON FUNCTION public.da_qa_courier_assigned_offers(
  text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_courier_assigned_offers(
  text,uuid,integer) TO da_qa_courier_commerce_app;

CREATE FUNCTION public.da_qa_courier_transition(
  p_order uuid,p_issuer text,p_subject uuid,p_next text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  c public.da_qa_courier_offer%ROWTYPE;
  next_expected text;
BEGIN
  IF p_next NOT IN ('accepted','picked_up','delivered')
     OR p_subject IS NULL OR p_issuer IS NULL OR
       p_issuer !~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'qa_courier_transition_invalid'; END IF;
  SELECT * INTO o FROM public.da_client_commerce_orders_qa
    WHERE public.da_client_commerce_orders_qa.order_id=p_order FOR UPDATE;
  SELECT * INTO c FROM public.da_qa_courier_offer
    WHERE public.da_qa_courier_offer.order_id=p_order FOR UPDATE;
  IF o.order_id IS NULL OR c.order_id IS NULL OR
     c.courier_issuer<>p_issuer OR c.courier_subject<>p_subject OR
     NOT public.da_qa_commerce_order_dispatch_eligible(p_order) THEN
    RAISE EXCEPTION 'qa_courier_not_assigned_or_financial_hold'; END IF;
  IF c.state=p_next THEN RETURN c.state; END IF;
  next_expected:=CASE c.state
    WHEN 'offered' THEN 'accepted'
    WHEN 'accepted' THEN 'picked_up'
    WHEN 'picked_up' THEN 'delivered'
    ELSE 'none' END;
  IF p_next<>next_expected THEN
    RAISE EXCEPTION 'qa_courier_transition_out_of_sequence'; END IF;
  UPDATE public.da_qa_courier_offer
    SET state=p_next,
      accepted_at=CASE WHEN p_next='accepted' THEN statement_timestamp()
                       ELSE accepted_at END,
      picked_up_at=CASE WHEN p_next='picked_up' THEN statement_timestamp()
                       ELSE picked_up_at END,
      delivered_at=CASE WHEN p_next='delivered' THEN statement_timestamp()
                       ELSE delivered_at END
    WHERE order_id=p_order;
  RETURN p_next;
END;
$$;
REVOKE ALL ON FUNCTION public.da_qa_courier_transition(
  uuid,text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_courier_transition(
  uuid,text,uuid,text) TO da_qa_courier_commerce_app;

COMMENT ON TABLE public.da_qa_fulfillment_state IS
  'QA ONLY: paid Merchant acceptance/ready; no legacy demo route integration';
COMMENT ON TABLE public.da_qa_courier_offer IS
  'QA ONLY: exact courier issuer/subject assignment; no customer PII';
COMMIT;
