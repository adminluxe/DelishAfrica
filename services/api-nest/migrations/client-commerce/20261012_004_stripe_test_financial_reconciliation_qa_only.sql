-- DELISHAFRICA — DISCONNECTED POSTGRESQL 17 QA ONLY.
-- Depends on 001, 002, 003. NEVER apply on VPS/production.
-- Permission boundary: app reserves, webhook receiver records signatures,
-- intent creator binds a Stripe TEST PI, finance verifier records a separately
-- retrieved/captured/unrefunded/undisputed TEST charge. No HTTP request may
-- supply a provider_verified flag. Roles are QA-only with Docker network=none.
BEGIN;
CREATE ROLE da_qa_stripe_intent_creator LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_stripe_finance_reconciler LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public
  TO da_qa_stripe_intent_creator, da_qa_stripe_finance_reconciler;

CREATE TABLE public.da_stripe_test_financial_receipts_qa (
  authority_id uuid PRIMARY KEY REFERENCES
    public.da_client_commerce_payment_authority_qa(authority_id)
    ON DELETE RESTRICT,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  stripe_charge_id text NOT NULL UNIQUE
    CHECK (stripe_charge_id ~ '^ch_[A-Za-z0-9_]{6,120}$'),
  stripe_account_id text NOT NULL
    CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]{6,120}$'),
  amount_captured bigint NOT NULL CHECK (amount_captured BETWEEN 1 AND 100000000),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  verification_hmac char(64) NOT NULL UNIQUE
    CHECK (verification_hmac ~ '^[0-9a-f]{64}$'),
  webhook_event_id text NULL REFERENCES
    public.da_stripe_test_webhook_inbox_qa(stripe_event_id),
  verified_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE public.da_stripe_test_financial_holds_qa (
  stripe_adjustment_id text PRIMARY KEY
    CHECK (stripe_adjustment_id ~ '^(re_|dp_)[A-Za-z0-9_]{6,120}$'),
  authority_id uuid NOT NULL REFERENCES
    public.da_client_commerce_payment_authority_qa(authority_id),
  kind text NOT NULL CHECK(kind IN ('refund','dispute')),
  observed_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE FUNCTION public.da_qa_finance_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION 'qa_financial_evidence_immutable';
END;
$$;
CREATE TRIGGER da_qa_financial_receipts_immutable
BEFORE UPDATE OR DELETE ON public.da_stripe_test_financial_receipts_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_finance_append_only();
CREATE TRIGGER da_qa_financial_holds_immutable
BEFORE UPDATE OR DELETE ON public.da_stripe_test_financial_holds_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_finance_append_only();

-- After Stripe TEST PI creation, record its identity. A replay must keep
-- exactly the same authority, intent, amount and currency. This port cannot
-- transition any payment to succeeded or order to paid.
CREATE FUNCTION public.da_qa_provider_bind_test_intent(
  p_authority uuid, p_intent text, p_amount bigint, p_currency char(3)
) RETURNS TABLE(authority_id uuid, stripe_payment_intent_id text, duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  a public.da_client_commerce_payment_authority_qa%ROWTYPE;
  existing_order uuid;
  was_duplicate boolean;
BEGIN
  IF p_intent IS NULL OR p_intent !~ '^pi_[A-Za-z0-9_]{6,120}$' THEN
    RAISE EXCEPTION 'qa_provider_intent_invalid';
  END IF;
  SELECT a0.order_id INTO existing_order
    FROM public.da_client_commerce_payment_authority_qa a0
    WHERE a0.authority_id=p_authority;
  SELECT * INTO o FROM public.da_client_commerce_orders_qa
    WHERE order_id=existing_order FOR UPDATE;
  SELECT * INTO a FROM public.da_client_commerce_payment_authority_qa a1
    WHERE a1.authority_id=p_authority FOR UPDATE;
  IF NOT FOUND OR o.order_id IS DISTINCT FROM a.order_id OR
     a.stripe_mode<>'test' OR a.total_minor IS DISTINCT FROM p_amount OR
     a.currency IS DISTINCT FROM p_currency OR o.state<>'pending_payment' OR
     a.state NOT IN ('reserved','intent_created') OR
     (a.stripe_payment_intent_id IS NOT NULL AND
       a.stripe_payment_intent_id<>p_intent) THEN
    RAISE EXCEPTION 'qa_provider_intent_authority_mismatch';
  END IF;
  was_duplicate := a.state='intent_created';
  IF NOT was_duplicate THEN
    UPDATE public.da_client_commerce_payment_authority_qa
      SET stripe_payment_intent_id=p_intent, state='intent_created'
      WHERE public.da_client_commerce_payment_authority_qa.authority_id=p_authority;
  END IF;
  authority_id := a.authority_id;
  stripe_payment_intent_id := p_intent;
  duplicate := was_duplicate;
  RETURN NEXT;
END;
$$;

-- Minimal read port for the separate TEST-only verifier. This never returns
-- client_secret or credentials; database data is authoritative, not HTTP.
CREATE FUNCTION public.da_qa_finance_read_authority(p_authority uuid)
RETURNS TABLE(
  authority_id uuid,order_id uuid,issuer text,client_subject uuid,
  client_mutation_id varchar,quote_fingerprint char(64),
  cart_fingerprint char(64),merchant_slug varchar,
  total_minor bigint,currency char(3),payment_intent_id text,
  payment_state text,order_state text
) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT a.authority_id,o.order_id,o.issuer,o.client_subject,
    o.client_mutation_id,o.quote_fingerprint,o.cart_fingerprint,
    o.merchant_slug,o.total_minor,o.currency,a.stripe_payment_intent_id,
    a.state,o.state
  FROM public.da_client_commerce_payment_authority_qa a
  JOIN public.da_client_commerce_orders_qa o ON o.order_id=a.order_id
  WHERE a.authority_id=p_authority AND a.stripe_mode='test'
    AND a.state IN ('intent_created','succeeded');
$$;

-- A creator may read only the exact issuer/subject-bound, reserved TEST
-- authority needed for PaymentIntent creation. No arbitrary money/price input
-- is returned from HTTP; all amounts originate in immutable PostgreSQL.
CREATE FUNCTION public.da_qa_provider_read_reserved_test_intent(
  p_authority uuid,p_issuer text,p_subject uuid
) RETURNS TABLE(
  authority_id uuid,order_id uuid,issuer text,client_subject uuid,
  client_mutation_id varchar,quote_fingerprint char(64),
  cart_fingerprint char(64),merchant_slug varchar,
  total_minor bigint,currency char(3),stripe_idempotency_key varchar,
  stripe_payment_intent_id text,payment_state text,created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
  SELECT a.authority_id,o.order_id,o.issuer,o.client_subject,
    o.client_mutation_id,o.quote_fingerprint,o.cart_fingerprint,
    o.merchant_slug,o.total_minor,o.currency,a.stripe_idempotency_key,
    a.stripe_payment_intent_id,a.state,a.created_at
  FROM public.da_client_commerce_payment_authority_qa a
  JOIN public.da_client_commerce_orders_qa o ON o.order_id=a.order_id
  WHERE a.authority_id=p_authority AND o.issuer=p_issuer
    AND o.client_subject=p_subject AND o.state='pending_payment'
    AND a.state IN ('reserved','intent_created') AND a.stripe_mode='test';
$$;

-- Crash-recovery enumeration of existing intents; may include already paid
-- orders so post-capture refunds/disputes can be checked again by the verifier.
CREATE FUNCTION public.da_qa_finance_scan(p_limit integer)
RETURNS TABLE(authority_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN
    RAISE EXCEPTION 'qa_finance_scan_limit_invalid';
  END IF;
  RETURN QUERY SELECT a.authority_id
    FROM public.da_client_commerce_payment_authority_qa a
    WHERE a.stripe_mode='test' AND a.stripe_payment_intent_id IS NOT NULL
      AND a.state IN ('intent_created','succeeded')
    ORDER BY a.updated_at ASC LIMIT p_limit;
END;
$$;

-- Only an independent verifier allowed to call this port, after checking
-- Stripe TEST via server-side Stripe API. SQL checks binding and does the
-- authority + order + receipt transition atomically under row locks.
CREATE FUNCTION public.da_qa_finance_commit_captured_test(
  p_authority uuid,p_intent text,p_charge text,p_account text,
  p_amount bigint,p_currency char(3),p_hmac char(64),
  p_webhook_event_id text DEFAULT NULL
) RETURNS TABLE(order_id uuid, paid boolean, duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  a public.da_client_commerce_payment_authority_qa%ROWTYPE;
  r public.da_stripe_test_financial_receipts_qa%ROWTYPE;
  existing_order uuid;
  was_duplicate boolean;
BEGIN
  IF p_intent IS NULL OR p_intent !~ '^pi_[A-Za-z0-9_]{6,120}$'
     OR p_charge IS NULL OR p_charge !~ '^ch_[A-Za-z0-9_]{6,120}$'
     OR p_account IS NULL OR p_account !~ '^acct_[A-Za-z0-9]{6,120}$'
     OR p_hmac IS NULL OR p_hmac !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'qa_finance_provider_identity_invalid';
  END IF;
  SELECT a0.order_id INTO existing_order
    FROM public.da_client_commerce_payment_authority_qa a0
    WHERE a0.authority_id=p_authority;
  SELECT * INTO o FROM public.da_client_commerce_orders_qa
    WHERE public.da_client_commerce_orders_qa.order_id=existing_order FOR UPDATE;
  SELECT * INTO a FROM public.da_client_commerce_payment_authority_qa
    WHERE public.da_client_commerce_payment_authority_qa.authority_id=p_authority
    FOR UPDATE;
  IF NOT FOUND OR o.order_id IS DISTINCT FROM a.order_id
     OR a.stripe_mode<>'test' OR a.stripe_payment_intent_id IS DISTINCT FROM p_intent
     OR a.total_minor IS DISTINCT FROM p_amount
     OR a.currency IS DISTINCT FROM p_currency
     OR a.state NOT IN ('intent_created','succeeded')
     OR o.state NOT IN ('pending_payment','paid') THEN
    RAISE EXCEPTION 'qa_finance_amount_currency_or_authority_mismatch';
  END IF;
  IF p_webhook_event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.da_stripe_test_webhook_inbox_qa i
    WHERE i.stripe_event_id=p_webhook_event_id
      AND i.authority_id=p_authority AND i.payment_intent_id=p_intent
      AND i.event_type='payment_intent.succeeded'
  ) THEN
    RAISE EXCEPTION 'qa_finance_signed_webhook_not_found';
  END IF;
  SELECT * INTO r FROM public.da_stripe_test_financial_receipts_qa
    WHERE public.da_stripe_test_financial_receipts_qa.authority_id=p_authority;
  was_duplicate := FOUND;
  IF was_duplicate THEN
    IF r.stripe_payment_intent_id<>p_intent OR r.stripe_charge_id<>p_charge
       OR r.stripe_account_id<>p_account OR r.amount_captured<>p_amount
       OR r.currency<>p_currency OR r.verification_hmac<>p_hmac
       OR a.state<>'succeeded' OR o.state<>'paid' THEN
      RAISE EXCEPTION 'qa_finance_reconciliation_collision';
    END IF;
  ELSE
    IF a.state<>'intent_created' OR o.state<>'pending_payment' THEN
      RAISE EXCEPTION 'qa_finance_state_not_pending';
    END IF;
    INSERT INTO public.da_stripe_test_financial_receipts_qa(
      authority_id,stripe_payment_intent_id,stripe_charge_id,
      stripe_account_id,amount_captured,currency,verification_hmac,
      webhook_event_id
    ) VALUES (p_authority,p_intent,p_charge,p_account,p_amount,
              p_currency,p_hmac,p_webhook_event_id);
    UPDATE public.da_client_commerce_payment_authority_qa
      SET state='succeeded',provider_verified=true,
        provider_verified_at=statement_timestamp(),
        provider_success_event_hmac=p_hmac
      WHERE authority_id=p_authority;
    UPDATE public.da_client_commerce_orders_qa
      SET state='paid' WHERE
      public.da_client_commerce_orders_qa.order_id=o.order_id;
  END IF;
  order_id := o.order_id;
  paid := true;
  duplicate := was_duplicate;
  RETURN NEXT;
END;
$$;

-- A late refund/dispute is a separate, append-only financial HOLD.
-- Never erase an already-captured payment or silently keep dispatching.
CREATE FUNCTION public.da_qa_finance_record_hold(
  p_authority uuid,p_adjustment text,p_kind text
) RETURNS TABLE(authority_id uuid, duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  a public.da_client_commerce_payment_authority_qa%ROWTYPE;
  e public.da_stripe_test_financial_holds_qa%ROWTYPE;
BEGIN
  IF p_adjustment IS NULL OR
     p_adjustment !~ '^(re_|dp_)[A-Za-z0-9_]{6,120}$'
     OR p_kind NOT IN ('refund','dispute') THEN
    RAISE EXCEPTION 'qa_finance_adjustment_invalid';
  END IF;
  SELECT * INTO a FROM public.da_client_commerce_payment_authority_qa
    WHERE public.da_client_commerce_payment_authority_qa.authority_id=p_authority;
  IF NOT FOUND OR a.state<>'succeeded' THEN
    RAISE EXCEPTION 'qa_finance_hold_requires_captured_payment';
  END IF;
  INSERT INTO public.da_stripe_test_financial_holds_qa(
    stripe_adjustment_id,authority_id,kind
  ) VALUES(p_adjustment,p_authority,p_kind)
  ON CONFLICT(stripe_adjustment_id) DO NOTHING RETURNING * INTO e;
  IF FOUND THEN
    authority_id:=p_authority;duplicate:=false;RETURN NEXT;RETURN;
  END IF;
  SELECT * INTO e FROM public.da_stripe_test_financial_holds_qa
    WHERE stripe_adjustment_id=p_adjustment;
  IF e.authority_id IS DISTINCT FROM p_authority OR e.kind<>p_kind THEN
    RAISE EXCEPTION 'qa_finance_hold_collision';
  END IF;
  authority_id:=p_authority;duplicate:=true;RETURN NEXT;
END;
$$;

CREATE FUNCTION public.da_qa_commerce_order_dispatch_eligible(p_order uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.da_client_commerce_orders_qa o
    JOIN public.da_client_commerce_payment_authority_qa a
      ON a.order_id=o.order_id
    JOIN public.da_stripe_test_financial_receipts_qa r
      ON r.authority_id=a.authority_id
    WHERE o.order_id=p_order AND o.state='paid' AND a.state='succeeded'
      AND a.provider_verified=true AND NOT EXISTS (
        SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
        WHERE h.authority_id=a.authority_id
      )
  );
$$;

REVOKE ALL ON TABLE public.da_stripe_test_financial_receipts_qa,
  public.da_stripe_test_financial_holds_qa
  FROM PUBLIC,da_qa_client_commerce_app,da_qa_psp_verified_receiver,
       da_qa_webhook_inbox_receiver,da_qa_stripe_intent_creator,
       da_qa_stripe_finance_reconciler;
REVOKE ALL ON FUNCTION public.da_qa_provider_bind_test_intent(
  uuid,text,bigint,character) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_provider_read_reserved_test_intent(uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_finance_read_authority(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_finance_scan(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_finance_commit_captured_test(
  uuid,text,text,text,bigint,character,character,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_finance_record_hold(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_commerce_order_dispatch_eligible(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.da_qa_provider_bind_test_intent(
  uuid,text,bigint,character) TO da_qa_stripe_intent_creator;
GRANT EXECUTE ON FUNCTION public.da_qa_provider_read_reserved_test_intent(uuid,text,uuid)
  TO da_qa_stripe_intent_creator;
GRANT EXECUTE ON FUNCTION public.da_qa_finance_read_authority(uuid),
  public.da_qa_finance_scan(integer),
  public.da_qa_finance_commit_captured_test(
    uuid,text,text,text,bigint,character,character,text),
  public.da_qa_finance_record_hold(uuid,text,text),
  public.da_qa_commerce_order_dispatch_eligible(uuid)
  TO da_qa_stripe_finance_reconciler;

COMMENT ON TABLE public.da_stripe_test_financial_receipts_qa IS
  'QA ONLY; financial confirmation retrieved from Stripe API by independent trusted verifier; never production.';
COMMIT;
