-- DELISHAFRICA -- ISOLATED POSTGRESQL 17 QA ONLY.
-- Migration 005 depends on QA migrations 001..004 and must never run on VPS.
-- Read-only order status for a previously signed/committed Client session.
-- The app DB login obtains EXECUTE only, not table SELECT or paid writes.
-- A financial status of "paid" requires a provider-verified authority,
-- unique persisted captured charge receipt, and NO late refund/dispute hold.
-- Do not treat the callback of PaymentSheet or a webhook body as proof.
BEGIN;

CREATE FUNCTION public.da_qa_client_read_owned_order(
  p_order uuid,p_issuer text,p_subject uuid
) RETURNS TABLE(
  order_id uuid,client_mutation_id varchar,
  payment_intent_id text,financial_status text,
  dispatch_eligible boolean,quote_fingerprint char(64),
  cart_fingerprint char(64),merchant_slug varchar,
  total_minor bigint,currency char(3)
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
WITH scoped AS (
  SELECT o.order_id,o.client_mutation_id,o.quote_fingerprint,
    o.cart_fingerprint,o.merchant_slug,o.total_minor,o.currency,
    o.state AS order_state,a.authority_id,
    a.state AS authority_state,a.provider_verified,
    a.stripe_payment_intent_id,r.authority_id AS receipt_authority,
    EXISTS (
      SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
      WHERE h.authority_id=a.authority_id
    ) AS has_hold
  FROM public.da_client_commerce_orders_qa o
  LEFT JOIN public.da_client_commerce_payment_authority_qa a
    ON a.order_id=o.order_id AND a.stripe_mode='test'
  LEFT JOIN public.da_stripe_test_financial_receipts_qa r
    ON r.authority_id=a.authority_id
   AND r.stripe_payment_intent_id=a.stripe_payment_intent_id
   AND r.amount_captured=o.total_minor
   AND r.currency=o.currency
  WHERE o.order_id=p_order
    AND o.issuer=p_issuer
    AND o.client_subject=p_subject
)
SELECT s.order_id,s.client_mutation_id,s.stripe_payment_intent_id,
  CASE
    WHEN s.order_state='paid' AND
      s.authority_state='succeeded' AND
      s.provider_verified IS TRUE AND
      s.receipt_authority IS NOT NULL AND s.has_hold
      THEN 'financial_hold'
    WHEN s.order_state='paid' AND
      s.authority_state='succeeded' AND
      s.provider_verified IS TRUE AND
      s.receipt_authority IS NOT NULL AND NOT s.has_hold
      THEN 'paid'
    WHEN s.order_state='pending_payment' AND
      (s.authority_state IS NULL OR
       s.authority_state IN ('reserved','intent_created')) AND
      s.receipt_authority IS NULL AND NOT s.has_hold
      THEN 'awaiting_payment'
    ELSE 'needs_review'
  END::text AS financial_status,
  (s.order_state='paid' AND
     s.authority_state='succeeded' AND
     s.provider_verified IS TRUE AND
     s.receipt_authority IS NOT NULL AND NOT s.has_hold)
    AS dispatch_eligible,
  s.quote_fingerprint,s.cart_fingerprint,s.merchant_slug,
  s.total_minor,s.currency
FROM scoped s;
$$;

REVOKE ALL ON FUNCTION public.da_qa_client_read_owned_order(
  uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_client_read_owned_order(
  uuid,text,uuid) TO da_qa_client_commerce_app;

COMMENT ON FUNCTION public.da_qa_client_read_owned_order(
  uuid,text,uuid) IS
  'DISCONNECTED QA ONLY: read owned order financial proof and late hold; no direct table access, no secrets, no financial mutation.';
COMMIT;
