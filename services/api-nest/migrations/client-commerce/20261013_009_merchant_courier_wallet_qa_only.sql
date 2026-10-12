-- DELISHAFRICA / QA 009 / TEST-only, disconnected PostgreSQL 17.
-- No real payout, transfer or Stripe API call. DO NOT RUN ON VPS.
-- Values in policy QA_FIXTURE_EUR_V1 are synthetic and NOT a contract.
-- Separate currencies must NEVER be aggregated. No FX or tax calculation.
BEGIN;

-- A pinned synthetic finance policy, immutable once used.
-- Real policy must be versioned at checkout + approved per territory/contract.
CREATE TABLE public.da_qa_wallet_policy (
  policy_id varchar(64) PRIMARY KEY CHECK (policy_id ~ '^QA_[A-Za-z0-9_]{3,61}$'),
  merchant_slug varchar(120) NOT NULL,
  currency char(3) NOT NULL CHECK (currency='EUR'),
  merchant_fee_bps integer NOT NULL CHECK (merchant_fee_bps BETWEEN 0 AND 9999),
  courier_delivery_bps integer NOT NULL CHECK (courier_delivery_bps BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE(merchant_slug,currency),
  CONSTRAINT da_qa_wallet_policy_slug_check
    CHECK(merchant_slug ~ '^[a-z0-9][a-z0-9_-]{1,119}$')
);

-- THIS IS A FAKE QA-ONLY EXAMPLE: 20% merchant menu fee, 100% of
-- delivery fee reserved for the assigned courier. Not approved for launch.
INSERT INTO public.da_qa_wallet_policy(
  policy_id,merchant_slug,currency,merchant_fee_bps,courier_delivery_bps)
VALUES('QA_FIXTURE_EUR_V1','qa-restaurant','EUR',2000,10000);

-- The settled, immutable allocation header binds exclusively to a
-- captured server-verified Stripe TEST receipt and immutable basket.
CREATE TABLE public.da_qa_wallet_allocation (
  order_id uuid PRIMARY KEY REFERENCES
    public.da_client_commerce_order_snapshot_qa(order_id) ON DELETE RESTRICT,
  authority_id uuid NOT NULL UNIQUE REFERENCES
    public.da_client_commerce_payment_authority_qa(authority_id) ON DELETE RESTRICT,
  policy_id varchar(64) NOT NULL REFERENCES
    public.da_qa_wallet_policy(policy_id),
  merchant_slug varchar(120) NOT NULL,
  currency char(3) NOT NULL CHECK (currency='EUR'),
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor BETWEEN 1 AND 100000000),
  delivery_fee_minor bigint NOT NULL CHECK(delivery_fee_minor BETWEEN 0 AND 100000000),
  captured_minor bigint NOT NULL CHECK(captured_minor BETWEEN 1 AND 100000000),
  merchant_fee_minor bigint NOT NULL CHECK(merchant_fee_minor BETWEEN 0 AND 100000000),
  merchant_earned_minor bigint NOT NULL CHECK(merchant_earned_minor BETWEEN 1 AND 100000000),
  courier_reserved_minor bigint NOT NULL CHECK(courier_reserved_minor BETWEEN 0 AND 100000000),
  platform_retained_minor bigint NOT NULL CHECK(platform_retained_minor BETWEEN 0 AND 100000000),
  allocated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT da_qa_wallet_exact_menu_breakdown CHECK(
    merchant_fee_minor+merchant_earned_minor=subtotal_minor),
  CONSTRAINT da_qa_wallet_delivery_cap CHECK(
    courier_reserved_minor<=delivery_fee_minor),
  CONSTRAINT da_qa_wallet_exact_capture_breakdown CHECK(
    merchant_earned_minor+courier_reserved_minor+
    platform_retained_minor=captured_minor AND
    captured_minor=subtotal_minor+delivery_fee_minor)
);

-- Four line types form an immutable, zero-sum internal allocation journal.
-- "allocation_clearing" is not a bank or PSP money balance.
CREATE TABLE public.da_qa_wallet_posting (
  order_id uuid NOT NULL REFERENCES public.da_qa_wallet_allocation(order_id)
    ON DELETE RESTRICT,
  account_code text NOT NULL CHECK(account_code IN (
    'allocation_clearing','merchant_earned',
    'courier_reserved','platform_retained')),
  signed_minor bigint NOT NULL CHECK(
    signed_minor BETWEEN -100000000 AND 100000000 AND signed_minor<>0),
  currency char(3) NOT NULL CHECK(currency='EUR'),
  posted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY(order_id,account_code)
);

CREATE FUNCTION public.da_qa_wallet_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION 'qa_wallet_immutable_audit';
END;
$$;
CREATE TRIGGER da_qa_wallet_policy_no_mutations
BEFORE UPDATE OR DELETE ON public.da_qa_wallet_policy
FOR EACH ROW EXECUTE FUNCTION public.da_qa_wallet_append_only();
CREATE TRIGGER da_qa_wallet_allocation_no_mutations
BEFORE UPDATE OR DELETE ON public.da_qa_wallet_allocation
FOR EACH ROW EXECUTE FUNCTION public.da_qa_wallet_append_only();
CREATE TRIGGER da_qa_wallet_posting_no_mutations
BEFORE UPDATE OR DELETE ON public.da_qa_wallet_posting
FOR EACH ROW EXECUTE FUNCTION public.da_qa_wallet_append_only();

REVOKE ALL ON TABLE public.da_qa_wallet_policy,
  public.da_qa_wallet_allocation,
  public.da_qa_wallet_posting FROM PUBLIC,
    da_qa_client_commerce_app,da_qa_merchant_commerce_app,
    da_qa_courier_commerce_app,da_qa_dispatch_commerce_app,
    da_qa_stripe_finance_reconciler,da_qa_psp_verified_receiver;

-- Finance-only accrual. It accepts an order UUID only, no device fee.
-- It locks the same order and authority rows as Stripe finality and
-- refund/pickup (008) so retries and holds cannot mutate the booked split.
CREATE FUNCTION public.da_qa_wallet_accrue_verified_capture(
  p_order uuid
) RETURNS TABLE(order_id uuid,duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  a public.da_client_commerce_payment_authority_qa%ROWTYPE;
  s public.da_client_commerce_order_snapshot_qa%ROWTYPE;
  r public.da_stripe_test_financial_receipts_qa%ROWTYPE;
  policy public.da_qa_wallet_policy%ROWTYPE;
  old public.da_qa_wallet_allocation%ROWTYPE;
  menu_fee bigint;
  courier_fee bigint;
  merchant_net bigint;
  platform_fee bigint;
  journal_count integer;
  journal_sum bigint;
BEGIN
  IF p_order IS NULL THEN RAISE EXCEPTION 'qa_wallet_order_required'; END IF;
  SELECT * INTO o FROM public.da_client_commerce_orders_qa o0
    WHERE o0.order_id=p_order FOR UPDATE;
  IF NOT FOUND OR o.state<>'paid' THEN
    RAISE EXCEPTION 'qa_wallet_capture_not_verified';
  END IF;
  SELECT * INTO a FROM public.da_client_commerce_payment_authority_qa a0
    WHERE a0.order_id=p_order FOR UPDATE;
  IF NOT FOUND OR a.stripe_mode<>'test' OR a.state<>'succeeded' OR
     a.provider_verified IS DISTINCT FROM true OR
     a.provider_verified_at IS NULL OR
     a.provider_success_event_hmac IS NULL OR
     a.total_minor<>o.total_minor OR a.currency<>o.currency THEN
    RAISE EXCEPTION 'qa_wallet_capture_not_verified';
  END IF;
  SELECT * INTO s FROM public.da_client_commerce_order_snapshot_qa s0
    WHERE s0.order_id=p_order;
  IF NOT FOUND OR s.currency<>'EUR' OR s.merchant_slug<>o.merchant_slug
    OR s.total_minor<>o.total_minor OR
       s.quote_fingerprint<>o.quote_fingerprint OR
       s.cart_fingerprint<>o.cart_fingerprint THEN
    RAISE EXCEPTION 'qa_wallet_canonical_basket_required';
  END IF;
  SELECT * INTO r FROM public.da_stripe_test_financial_receipts_qa r0
    WHERE r0.authority_id=a.authority_id;
  IF NOT FOUND OR r.stripe_payment_intent_id IS DISTINCT FROM
      a.stripe_payment_intent_id OR r.amount_captured<>o.total_minor OR
     r.currency<>o.currency OR r.verification_hmac<>a.provider_success_event_hmac THEN
    RAISE EXCEPTION 'qa_wallet_exact_financial_receipt_required';
  END IF;
  SELECT * INTO policy FROM public.da_qa_wallet_policy p
    WHERE p.merchant_slug=o.merchant_slug AND p.currency=o.currency;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qa_wallet_approved_policy_missing';
  END IF;
  menu_fee:=floor(
    s.subtotal_minor::numeric*policy.merchant_fee_bps/10000)::bigint;
  courier_fee:=floor(
    s.delivery_fee_minor::numeric*policy.courier_delivery_bps/10000)::bigint;
  merchant_net:=s.subtotal_minor-menu_fee;
  platform_fee:=o.total_minor-merchant_net-courier_fee;
  IF merchant_net<1 OR courier_fee<0 OR platform_fee<0 OR
     menu_fee+merchant_net<>s.subtotal_minor OR
     merchant_net+courier_fee+platform_fee<>o.total_minor THEN
    RAISE EXCEPTION 'qa_wallet_policy_non_balanced';
  END IF;

  SELECT * INTO old FROM public.da_qa_wallet_allocation x
    WHERE x.order_id=p_order;
  IF FOUND THEN
    IF old.authority_id IS DISTINCT FROM a.authority_id OR
       old.policy_id<>policy.policy_id OR
       old.merchant_slug<>o.merchant_slug OR
       old.currency<>o.currency OR
       old.subtotal_minor<>s.subtotal_minor OR
       old.delivery_fee_minor<>s.delivery_fee_minor OR
       old.captured_minor<>o.total_minor OR
       old.merchant_fee_minor<>menu_fee OR
       old.merchant_earned_minor<>merchant_net OR
       old.courier_reserved_minor<>courier_fee OR
       old.platform_retained_minor<>platform_fee THEN
      RAISE EXCEPTION 'qa_wallet_idempotency_collision';
    END IF;
    SELECT count(*),COALESCE(sum(signed_minor),0)
    INTO journal_count,journal_sum
    FROM public.da_qa_wallet_posting j WHERE j.order_id=p_order;
    IF journal_count<>(2+(courier_fee>0)::integer+(platform_fee>0)::integer)
        OR journal_sum<>0 THEN
      RAISE EXCEPTION 'qa_wallet_unbalanced_existing_journal';
    END IF;
    order_id:=p_order;duplicate:=true;RETURN NEXT;RETURN;
  END IF;

  INSERT INTO public.da_qa_wallet_allocation(
    order_id,authority_id,policy_id,merchant_slug,currency,
    subtotal_minor,delivery_fee_minor,captured_minor,merchant_fee_minor,
    merchant_earned_minor,courier_reserved_minor,platform_retained_minor)
  VALUES(p_order,a.authority_id,policy.policy_id,o.merchant_slug,
    o.currency,s.subtotal_minor,s.delivery_fee_minor,o.total_minor,
    menu_fee,merchant_net,courier_fee,platform_fee);

  INSERT INTO public.da_qa_wallet_posting(
    order_id,account_code,signed_minor,currency)
  VALUES
    (p_order,'allocation_clearing',-o.total_minor,o.currency),
    (p_order,'merchant_earned',merchant_net,o.currency);
  IF courier_fee>0 THEN
    INSERT INTO public.da_qa_wallet_posting(
      order_id,account_code,signed_minor,currency)
    VALUES(p_order,'courier_reserved',courier_fee,o.currency);
  END IF;
  IF platform_fee>0 THEN
    INSERT INTO public.da_qa_wallet_posting(
      order_id,account_code,signed_minor,currency)
    VALUES(p_order,'platform_retained',platform_fee,o.currency);
  END IF;
  SELECT count(*),COALESCE(sum(signed_minor),0)
    INTO journal_count,journal_sum
    FROM public.da_qa_wallet_posting j WHERE j.order_id=p_order;
  IF journal_count<>(2+(courier_fee>0)::integer+(platform_fee>0)::integer)
      OR journal_sum<>0 THEN
    RAISE EXCEPTION 'qa_wallet_unbalanced_journal';
  END IF;
  order_id:=p_order;duplicate:=false;RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.da_qa_wallet_accrue_verified_capture(uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_wallet_accrue_verified_capture(uuid)
TO da_qa_stripe_finance_reconciler;

-- Merchant sees only captured allocations for the slug admitted by the
-- server's verified membership gate. Shared SQL role by itself is NOT
-- principal-bound; this remains QA-only pending cryptographic DB attestation.
CREATE FUNCTION public.da_qa_wallet_merchant_summary(
  p_merchant varchar
) RETURNS TABLE(
  merchant_slug varchar,currency char(3),accrued_minor bigint,
  pending_minor bigint,available_minor bigint,held_minor bigint,
  withdrawable_minor bigint,order_count bigint,payout_enabled boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_merchant IS NULL OR p_merchant !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
      OR NOT EXISTS (
        SELECT 1 FROM public.da_qa_wallet_policy p
        WHERE p.merchant_slug=p_merchant AND p.currency='EUR'
      ) THEN RAISE EXCEPTION 'qa_wallet_merchant_policy_not_configured'; END IF;
  RETURN QUERY
  WITH ledger AS (
    SELECT x.merchant_earned_minor AS amount,
      COALESCE(f.state='ready',false) AS ready,
      EXISTS(
        SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
        WHERE h.authority_id=x.authority_id
      ) AS held
    FROM public.da_qa_wallet_allocation x
    LEFT JOIN public.da_qa_fulfillment_state f ON f.order_id=x.order_id
    WHERE x.merchant_slug=p_merchant AND x.currency='EUR'
  )
  SELECT p_merchant,'EUR'::char(3),
    COALESCE(sum(amount),0)::bigint,
    COALESCE(sum(CASE WHEN NOT held AND NOT ready
      THEN amount ELSE 0 END),0)::bigint,
    COALESCE(sum(CASE WHEN NOT held AND ready
      THEN amount ELSE 0 END),0)::bigint,
    COALESCE(sum(CASE WHEN held THEN amount ELSE 0 END),0)::bigint,
    0::bigint,count(*)::bigint,false
  FROM ledger;
END;
$$;

CREATE FUNCTION public.da_qa_wallet_courier_summary(
  p_issuer text,p_subject uuid
) RETURNS TABLE(
  currency char(3),accrued_minor bigint,pending_minor bigint,
  available_minor bigint,held_minor bigint,withdrawable_minor bigint,
  order_count bigint,payout_enabled boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_issuer IS NULL OR
    p_issuer !~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$'
    OR p_subject IS NULL THEN
    RAISE EXCEPTION 'qa_wallet_courier_identity_invalid';
  END IF;
  RETURN QUERY
  WITH ledger AS (
    SELECT x.courier_reserved_minor AS amount,
      c.state='delivered' AS completed,
      EXISTS(
        SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
        WHERE h.authority_id=x.authority_id
      ) AS held
    FROM public.da_qa_courier_offer c
    JOIN public.da_qa_wallet_allocation x ON x.order_id=c.order_id
    WHERE c.courier_issuer=p_issuer AND c.courier_subject=p_subject
      AND x.currency='EUR' AND x.courier_reserved_minor>0
  )
  SELECT 'EUR'::char(3),
    COALESCE(sum(amount),0)::bigint,
    COALESCE(sum(CASE WHEN NOT held AND NOT completed
      THEN amount ELSE 0 END),0)::bigint,
    COALESCE(sum(CASE WHEN NOT held AND completed
      THEN amount ELSE 0 END),0)::bigint,
    COALESCE(sum(CASE WHEN held THEN amount ELSE 0 END),0)::bigint,
    0::bigint,count(*)::bigint,false
  FROM ledger;
END;
$$;

-- Histories have no buyer PII, no bank details, no Stripe client_secret.
CREATE FUNCTION public.da_qa_wallet_merchant_activity(
  p_merchant varchar,p_limit integer DEFAULT 30
) RETURNS TABLE(
  order_id uuid,policy_id varchar,gross_minor bigint,
  fee_minor bigint,earned_minor bigint,currency char(3),
  financial_state text,fulfillment_state text,occurred_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT x.order_id,x.policy_id,x.subtotal_minor,
    x.merchant_fee_minor,x.merchant_earned_minor,x.currency,
    (CASE WHEN EXISTS(
      SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
      WHERE h.authority_id=x.authority_id
    ) THEN 'financial_hold' ELSE 'captured' END)::text,
    COALESCE(f.state,'new')::text,x.allocated_at
  FROM public.da_qa_wallet_allocation x
  LEFT JOIN public.da_qa_fulfillment_state f ON f.order_id=x.order_id
  WHERE x.merchant_slug=p_merchant AND x.currency='EUR'
    AND p_merchant ~ '^[a-z0-9][a-z0-9_-]{1,119}$'
    AND p_limit BETWEEN 1 AND 50
  ORDER BY x.allocated_at DESC,x.order_id
  LIMIT LEAST(GREATEST(p_limit,1),50);
$$;

CREATE FUNCTION public.da_qa_wallet_courier_activity(
  p_issuer text,p_subject uuid,p_limit integer DEFAULT 20
) RETURNS TABLE(
  order_id uuid,earned_minor bigint,currency char(3),
  financial_state text,delivery_state text,occurred_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT x.order_id,x.courier_reserved_minor,x.currency,
    (CASE WHEN EXISTS(
      SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
      WHERE h.authority_id=x.authority_id
    ) THEN 'financial_hold' ELSE 'captured' END)::text,
    c.state::text,c.offered_at
  FROM public.da_qa_courier_offer c
  JOIN public.da_qa_wallet_allocation x ON x.order_id=c.order_id
  WHERE c.courier_issuer=p_issuer AND c.courier_subject=p_subject
    AND x.currency='EUR' AND x.courier_reserved_minor>0
    AND p_issuer ~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$'
    AND p_limit BETWEEN 1 AND 50
  ORDER BY c.offered_at DESC,x.order_id
  LIMIT LEAST(GREATEST(p_limit,1),50);
$$;

REVOKE ALL ON FUNCTION public.da_qa_wallet_merchant_summary(varchar),
  public.da_qa_wallet_courier_summary(text,uuid),
  public.da_qa_wallet_merchant_activity(varchar,integer),
  public.da_qa_wallet_courier_activity(text,uuid,integer)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.da_qa_wallet_merchant_summary(varchar),
  public.da_qa_wallet_merchant_activity(varchar,integer)
TO da_qa_merchant_commerce_app;

GRANT EXECUTE ON FUNCTION
  public.da_qa_wallet_courier_summary(text,uuid),
  public.da_qa_wallet_courier_activity(text,uuid,integer)
TO da_qa_courier_commerce_app;

COMMENT ON TABLE public.da_qa_wallet_allocation IS
  'QA ONLY. Synthetic split of independently verified captured TEST payment. NO real payouts or platform bank balance. No PII.';
COMMENT ON TABLE public.da_qa_wallet_posting IS
  'QA ONLY. Balanced immutable accounting allocation; negative clearing is not real cash movement.';
COMMENT ON FUNCTION public.da_qa_wallet_merchant_summary(varchar) IS
  'QA ONLY. Available = merchant prepared and no hold; withdrawable = 0; payout disabled.';
COMMENT ON FUNCTION public.da_qa_wallet_courier_summary(text,uuid) IS
  'QA ONLY. Available = delivered and no hold; withdrawable = 0; payout disabled.';
COMMIT;
