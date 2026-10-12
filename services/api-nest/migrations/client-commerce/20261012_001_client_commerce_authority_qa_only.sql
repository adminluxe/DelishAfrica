-- DELISHAFRICA — QA CANDIDATE ONLY. NEVER run against VPS production.
-- No Stripe secrets or client_secret; SMS/email verified elsewhere.
-- New table/function names are intentionally suffixed _qa.
BEGIN;

CREATE TABLE public.da_client_commerce_orders_qa (
  order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL CHECK (
    issuer ~ '^https://[A-Za-z0-9.-]+/realms/[A-Za-z0-9_-]+$'),
  client_subject uuid NOT NULL,
  client_mutation_id varchar(128) NOT NULL CHECK (
    client_mutation_id ~ '^[A-Za-z0-9:_.-]{8,128}$'),
  quote_fingerprint char(64) NOT NULL CHECK (quote_fingerprint ~ '^[0-9a-f]{64}$'),
  cart_fingerprint char(64) NOT NULL CHECK (cart_fingerprint ~ '^[0-9a-f]{64}$'),
  merchant_slug varchar(120) NOT NULL CHECK (
    merchant_slug ~ '^[a-z0-9][a-z0-9_-]{1,119}$'),
  total_minor bigint NOT NULL CHECK (total_minor BETWEEN 1 AND 100000000),
  currency char(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  state text NOT NULL DEFAULT 'pending_payment' CHECK (
    state IN ('pending_payment','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT da_qa_order_client_mutation_unique
    UNIQUE (issuer,client_subject,client_mutation_id),
  CONSTRAINT da_qa_order_binding_unique
    UNIQUE (order_id,issuer,client_subject,quote_fingerprint,total_minor,currency)
);

CREATE TABLE public.da_client_commerce_payment_authority_qa (
  authority_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE,
  issuer text NOT NULL,
  client_subject uuid NOT NULL,
  quote_fingerprint char(64) NOT NULL,
  total_minor bigint NOT NULL,
  currency char(3) NOT NULL,
  stripe_mode text NOT NULL DEFAULT 'test' CHECK (stripe_mode='test'),
  stripe_idempotency_key varchar(128) NOT NULL UNIQUE CHECK (
    stripe_idempotency_key ~ '^[A-Za-z0-9:_.-]{8,128}$'),
  stripe_payment_intent_id text UNIQUE CHECK (
    stripe_payment_intent_id IS NULL OR
    stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]{6,120}$'),
  state text NOT NULL DEFAULT 'reserved' CHECK (
    state IN ('reserved','intent_created','succeeded','failed','cancelled')),
  provider_success_event_hmac char(64) UNIQUE CHECK (
    provider_success_event_hmac IS NULL OR
    provider_success_event_hmac ~ '^[0-9a-f]{64}$'),
  provider_verified boolean NOT NULL DEFAULT false,
  provider_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT da_qa_payment_exact_order_binding FOREIGN KEY (
    order_id,issuer,client_subject,quote_fingerprint,total_minor,currency
  ) REFERENCES public.da_client_commerce_orders_qa (
    order_id,issuer,client_subject,quote_fingerprint,total_minor,currency
  ) ON DELETE RESTRICT,
  CONSTRAINT da_qa_payment_verified_success CHECK (
    state <> 'succeeded' OR
    (stripe_payment_intent_id IS NOT NULL AND provider_verified IS TRUE
      AND provider_success_event_hmac IS NOT NULL
      AND provider_verified_at IS NOT NULL)),
  CONSTRAINT da_qa_payment_intent_before_result CHECK (
    state IN ('reserved','cancelled') OR stripe_payment_intent_id IS NOT NULL)
);

-- The unique issuer + client sub + mutation key is the database concurrency
-- authority. No mismatch can silently reuse an existing order.
CREATE FUNCTION public.da_qa_reserve_client_order (
  p_issuer text,
  p_subject uuid,
  p_mutation varchar,
  p_quote char(64),
  p_cart char(64),
  p_merchant varchar,
  p_total bigint,
  p_currency char(3)
) RETURNS public.da_client_commerce_orders_qa
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE rec public.da_client_commerce_orders_qa%ROWTYPE;
BEGIN
  INSERT INTO public.da_client_commerce_orders_qa (
    issuer,client_subject,client_mutation_id,quote_fingerprint,
    cart_fingerprint,merchant_slug,total_minor,currency
  ) VALUES (
    p_issuer,p_subject,p_mutation,p_quote,p_cart,p_merchant,p_total,p_currency
  ) ON CONFLICT (issuer,client_subject,client_mutation_id)
    DO NOTHING RETURNING * INTO rec;
  IF NOT FOUND THEN
    SELECT * INTO rec FROM public.da_client_commerce_orders_qa
      WHERE issuer=p_issuer AND client_subject=p_subject
      AND client_mutation_id=p_mutation;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'qa_order_reservation_unresolved_fail_closed';
    END IF;
  END IF;
  IF rec.quote_fingerprint IS DISTINCT FROM p_quote OR
     rec.cart_fingerprint IS DISTINCT FROM p_cart OR
     rec.merchant_slug IS DISTINCT FROM p_merchant OR
     rec.total_minor IS DISTINCT FROM p_total OR
     rec.currency IS DISTINCT FROM p_currency THEN
    RAISE EXCEPTION 'qa_idempotency_payload_mismatch';
  END IF;
  RETURN rec;
END;
$$;

CREATE FUNCTION public.da_qa_order_immutability_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'pending_payment' THEN
      RAISE EXCEPTION 'qa_order_must_start_pending_payment';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.issuer IS DISTINCT FROM OLD.issuer OR
     NEW.client_subject IS DISTINCT FROM OLD.client_subject OR
     NEW.client_mutation_id IS DISTINCT FROM OLD.client_mutation_id OR
     NEW.quote_fingerprint IS DISTINCT FROM OLD.quote_fingerprint OR
     NEW.cart_fingerprint IS DISTINCT FROM OLD.cart_fingerprint OR
     NEW.merchant_slug IS DISTINCT FROM OLD.merchant_slug OR
     NEW.total_minor IS DISTINCT FROM OLD.total_minor OR
     NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'qa_order_financial_binding_immutable';
  END IF;
  IF OLD.state='paid' AND NEW.state<>'paid' THEN
    RAISE EXCEPTION 'qa_paid_order_monotonic';
  END IF;
  IF OLD.state='cancelled' AND NEW.state<>'cancelled' THEN
    RAISE EXCEPTION 'qa_cancelled_order_monotonic';
  END IF;
  IF NEW.state='paid' AND OLD.state<>'paid' THEN
    IF OLD.state<>'pending_payment' OR NOT EXISTS (
      SELECT 1 FROM public.da_client_commerce_payment_authority_qa p
      WHERE p.order_id=NEW.order_id AND p.issuer=NEW.issuer
        AND p.client_subject=NEW.client_subject
        AND p.quote_fingerprint=NEW.quote_fingerprint
        AND p.total_minor=NEW.total_minor AND p.currency=NEW.currency
        AND p.state='succeeded' AND p.provider_verified IS TRUE
        AND p.provider_success_event_hmac IS NOT NULL
        AND p.provider_verified_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'qa_order_paid_without_verified_stripe_authority';
    END IF;
  END IF;
  NEW.updated_at=statement_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER da_qa_order_before_write
BEFORE INSERT OR UPDATE ON public.da_client_commerce_orders_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_order_immutability_guard();

CREATE FUNCTION public.da_qa_payment_immutability_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'reserved' THEN
      RAISE EXCEPTION 'qa_payment_must_start_reserved';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.order_id IS DISTINCT FROM OLD.order_id OR
     NEW.issuer IS DISTINCT FROM OLD.issuer OR
     NEW.client_subject IS DISTINCT FROM OLD.client_subject OR
     NEW.quote_fingerprint IS DISTINCT FROM OLD.quote_fingerprint OR
     NEW.total_minor IS DISTINCT FROM OLD.total_minor OR
     NEW.currency IS DISTINCT FROM OLD.currency OR
     NEW.stripe_mode IS DISTINCT FROM OLD.stripe_mode OR
     NEW.stripe_idempotency_key IS DISTINCT FROM OLD.stripe_idempotency_key THEN
    RAISE EXCEPTION 'qa_payment_binding_immutable';
  END IF;
  IF OLD.stripe_payment_intent_id IS NOT NULL AND
     NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id THEN
    RAISE EXCEPTION 'qa_payment_intent_immutable';
  END IF;
  IF (OLD.state='reserved' AND NEW.state NOT IN ('reserved','intent_created','cancelled'))
     OR (OLD.state='intent_created' AND NEW.state NOT IN
       ('intent_created','succeeded','failed','cancelled'))
     OR (OLD.state IN ('succeeded','failed','cancelled') AND NEW.state<>OLD.state) THEN
    RAISE EXCEPTION 'qa_payment_transition_forbidden';
  END IF;
  IF OLD.provider_success_event_hmac IS NOT NULL AND
     NEW.provider_success_event_hmac IS DISTINCT FROM OLD.provider_success_event_hmac THEN
    RAISE EXCEPTION 'qa_provider_receipt_immutable';
  END IF;
  NEW.updated_at=statement_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER da_qa_payment_before_write
BEFORE INSERT OR UPDATE ON public.da_client_commerce_payment_authority_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_payment_immutability_guard();

COMMENT ON TABLE public.da_client_commerce_orders_qa IS
  'QA ONLY: immutable Client order reservation. Never installed on VPS.';
COMMENT ON TABLE public.da_client_commerce_payment_authority_qa IS
  'QA ONLY: Stripe TEST correlation. Provider verification is NOT performed '
  'by this schema; independent Stripe API/webhook verification required.';
COMMIT;
