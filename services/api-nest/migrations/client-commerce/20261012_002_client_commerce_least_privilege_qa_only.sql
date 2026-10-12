-- QA SECURITY MIGRATION ONLY. FOR A THROWAWAY POSTGRES 17 CI CONTAINER.
-- This is NOT a production-role recipe. In production, SECURITY DEFINER
-- functions must be owned by a dedicated NOLOGIN, NON-SUPERUSER owner
-- after an external independent security review.
-- The entire container has Docker --network none, no host ports.
BEGIN;

-- LOGIN is permitted ONLY inside the disconnected CI namespace with host
-- trust authentication. Never enable trust or passwordless DB users on VPS.
CREATE ROLE da_qa_client_commerce_app LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_psp_verified_receiver LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;

REVOKE ALL ON TABLE
  public.da_client_commerce_orders_qa,
  public.da_client_commerce_payment_authority_qa
  FROM PUBLIC, da_qa_client_commerce_app, da_qa_psp_verified_receiver;

GRANT USAGE ON SCHEMA public
  TO da_qa_client_commerce_app, da_qa_psp_verified_receiver;

-- Existing transactional helper is callable ONLY by its owner/definer.
REVOKE ALL ON FUNCTION public.da_qa_reserve_client_order(
  text,uuid,varchar,character,character,varchar,bigint,character)
  FROM PUBLIC,da_qa_client_commerce_app,da_qa_psp_verified_receiver;

-- App has EXECUTE ONLY on the two locked, parameterized reservation ports.
-- Never grant table INSERT/UPDATE/SELECT or payment-success APIs.
CREATE FUNCTION public.da_qa_service_reserve_order(
  p_issuer text, p_subject uuid, p_mutation varchar,
  p_quote char(64),p_cart char(64),p_merchant varchar,
  p_total bigint,p_currency char(3))
RETURNS public.da_client_commerce_orders_qa
LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT public.da_qa_reserve_client_order(
    p_issuer,p_subject,p_mutation,p_quote,p_cart,p_merchant,p_total,p_currency);
$$;
REVOKE ALL ON FUNCTION public.da_qa_service_reserve_order(
  text,uuid,varchar,character,character,varchar,bigint,character)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_service_reserve_order(
  text,uuid,varchar,character,character,varchar,bigint,character)
  TO da_qa_client_commerce_app;

CREATE FUNCTION public.da_qa_service_reserve_test_payment(
  p_order uuid,p_issuer text,p_subject uuid,p_stripe_key varchar)
RETURNS public.da_client_commerce_payment_authority_qa
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  p public.da_client_commerce_payment_authority_qa%ROWTYPE;
BEGIN
  -- The order lock serializes payment reservation across all application
  -- nodes. The FK additionally ties amount/currency/quote/issuer/sub.
  SELECT * INTO o FROM public.da_client_commerce_orders_qa
    WHERE order_id=p_order AND issuer=p_issuer AND client_subject=p_subject
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qa_order_missing_or_cross_principal';
  END IF;
  IF o.state<>'pending_payment' THEN
    RAISE EXCEPTION 'qa_payment_order_not_pending';
  END IF;
  INSERT INTO public.da_client_commerce_payment_authority_qa(
    order_id,issuer,client_subject,quote_fingerprint,total_minor,currency,
    stripe_idempotency_key)
  VALUES (
    o.order_id,o.issuer,o.client_subject,o.quote_fingerprint,o.total_minor,
    o.currency,p_stripe_key)
  ON CONFLICT (order_id) DO NOTHING RETURNING * INTO p;
  IF NOT FOUND THEN
    SELECT * INTO p FROM public.da_client_commerce_payment_authority_qa
      WHERE order_id=p_order FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'qa_payment_authority_missing';
    END IF;
  END IF;
  IF p.stripe_mode<>'test' OR
     p.stripe_idempotency_key<>p_stripe_key OR
     p.issuer<>o.issuer OR p.client_subject<>o.client_subject OR
     p.quote_fingerprint<>o.quote_fingerprint OR
     p.total_minor<>o.total_minor OR p.currency<>o.currency THEN
    RAISE EXCEPTION 'qa_payment_authority_binding_mismatch';
  END IF;
  RETURN p;
END;
$$;
REVOKE ALL ON FUNCTION public.da_qa_service_reserve_test_payment(
  uuid,text,uuid,varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_service_reserve_test_payment(
  uuid,text,uuid,varchar) TO da_qa_client_commerce_app;

-- Deliberately NO PSP success function. The PSP role has no ability to
-- set provider_verified, provider receipt, paid, or change payment status.
-- Those privileged transitions require a separately certified Stripe
-- TEST signature validator, API retrieval, exact financial reconciliation,
-- and a transactionally isolated service, NOT an HTTP-client boolean.
COMMENT ON ROLE da_qa_client_commerce_app IS
  'DISCONNECTED CI ONLY: EXECUTE reservations, no direct DML or payment success';
COMMENT ON ROLE da_qa_psp_verified_receiver IS
  'DISCONNECTED CI ONLY: no payment write permission until PSP certification';

COMMIT;
