-- DELISHAFRICA | 008 | PG17 QA ONLY | refund and dispatch row-lock serialization
-- Migration executes ONLY after 001..007 in disposable --network none Docker.
-- No real Stripe calls. No VPS. Existing finance function SQL only is replaced;
-- roles and privileges remain restricted. No changes to public API routes.
--
-- All Merchant/Dispatcher/Courier writes lock orders FOR UPDATE first.
-- Refund/dispute writes now lock that SAME order row FIRST, then authority.
-- The two cases have a defined linearization: if refund COMMIT is first, a
-- waiting pickup/dispatch fails. If pickup commits first, refund waits and
-- permanently disables any subsequent delivery; completed physical events
-- cannot be retroactively undone.
BEGIN;

CREATE OR REPLACE FUNCTION public.da_qa_finance_record_hold(
  p_authority uuid,p_adjustment text,p_kind text
) RETURNS TABLE(authority_id uuid,duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  v_order_id uuid;
  o public.da_client_commerce_orders_qa%ROWTYPE;
  a public.da_client_commerce_payment_authority_qa%ROWTYPE;
  e public.da_stripe_test_financial_holds_qa%ROWTYPE;
BEGIN
  IF p_authority IS NULL OR p_adjustment IS NULL OR
     p_adjustment !~ '^(re_|dp_)[A-Za-z0-9_]{6,120}$' OR
     p_kind NOT IN ('refund','dispute') THEN
    RAISE EXCEPTION 'qa_finance_adjustment_invalid';
  END IF;

  -- Initial lookup only discovers the order ID. It does not authorize a
  -- hold or trust a device-supplied principal.
  SELECT a0.order_id INTO v_order_id
    FROM public.da_client_commerce_payment_authority_qa a0
    WHERE a0.authority_id=p_authority;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qa_finance_hold_requires_captured_payment';
  END IF;

  -- LOCK ORDER is identical to the lock acquired by ALL transition functions
  -- in migration 007, and to finance captured commit migration 004.
  SELECT * INTO o FROM public.da_client_commerce_orders_qa o0
    WHERE o0.order_id=v_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qa_finance_hold_requires_captured_payment';
  END IF;

  SELECT * INTO a FROM public.da_client_commerce_payment_authority_qa a0
    WHERE a0.authority_id=p_authority FOR UPDATE;
  IF NOT FOUND OR a.order_id IS DISTINCT FROM o.order_id OR
     a.stripe_mode IS DISTINCT FROM 'test' OR
     a.state IS DISTINCT FROM 'succeeded' OR
     a.provider_verified IS DISTINCT FROM true OR
     o.state IS DISTINCT FROM 'paid' OR
     a.total_minor IS DISTINCT FROM o.total_minor OR
     a.currency IS DISTINCT FROM o.currency OR
     NOT EXISTS (
       SELECT 1 FROM public.da_stripe_test_financial_receipts_qa r
       WHERE r.authority_id=a.authority_id
         AND r.stripe_payment_intent_id=a.stripe_payment_intent_id
         AND r.amount_captured=o.total_minor AND r.currency=o.currency
     ) THEN
    RAISE EXCEPTION 'qa_finance_hold_requires_captured_payment';
  END IF;

  INSERT INTO public.da_stripe_test_financial_holds_qa(
    stripe_adjustment_id,authority_id,kind
  ) VALUES(p_adjustment,p_authority,p_kind)
  ON CONFLICT(stripe_adjustment_id) DO NOTHING RETURNING * INTO e;
  IF FOUND THEN
    authority_id:=p_authority;
    duplicate:=false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO e FROM public.da_stripe_test_financial_holds_qa h
    WHERE h.stripe_adjustment_id=p_adjustment;
  IF NOT FOUND OR e.authority_id IS DISTINCT FROM p_authority OR
     e.kind IS DISTINCT FROM p_kind THEN
    RAISE EXCEPTION 'qa_finance_hold_collision';
  END IF;
  authority_id:=p_authority;
  duplicate:=true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.da_qa_finance_record_hold(uuid,text,text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_finance_record_hold(uuid,text,text)
  TO da_qa_stripe_finance_reconciler;

COMMENT ON FUNCTION public.da_qa_finance_record_hold(uuid,text,text) IS
  'QA-only: order FOR UPDATE before refund/dispute hold; serializes with all Merchant/Courier/Dispatch transitions. No production usage.';

COMMIT;
