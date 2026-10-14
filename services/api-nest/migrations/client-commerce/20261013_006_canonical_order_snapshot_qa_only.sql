-- DelishAfrica | 006 | NETWORK-NONE POSTGRES17 QA ONLY
-- After migrations 001..005. No VPS, production schema or real payment.
-- A payment authority can no longer be reserved without a durable, immutable
-- server-canonical basket snapshot. This migration is applied only AFTER the
-- existing 001..005 tests in CI, then it runs its own adversarial QA matrix.
BEGIN;

CREATE TABLE public.da_client_commerce_order_snapshot_qa (
  order_id uuid PRIMARY KEY,
  issuer text NOT NULL,
  client_subject uuid NOT NULL,
  merchant_slug varchar(120) NOT NULL,
  quote_fingerprint char(64) NOT NULL,
  cart_fingerprint char(64) NOT NULL,
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor BETWEEN 1 AND 100000000),
  delivery_fee_minor bigint NOT NULL CHECK (delivery_fee_minor BETWEEN 0 AND 100000000),
  total_minor bigint NOT NULL CHECK (total_minor BETWEEN 1 AND 100000000),
  currency char(3) NOT NULL CHECK (currency='EUR'),
  line_items jsonb NOT NULL CHECK (
    jsonb_typeof(line_items)='array' AND
    jsonb_array_length(line_items) BETWEEN 1 AND 40
  ),
  snapshot_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT da_qa_snapshot_financial_owner_fk FOREIGN KEY (
    order_id,issuer,client_subject,quote_fingerprint,total_minor,currency
  ) REFERENCES public.da_client_commerce_orders_qa(
    order_id,issuer,client_subject,quote_fingerprint,total_minor,currency
  ) ON DELETE RESTRICT
);

CREATE FUNCTION public.da_qa_order_snapshot_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION 'qa_server_order_snapshot_immutable';
END;
$$;

CREATE TRIGGER da_qa_order_snapshot_immutable
BEFORE UPDATE OR DELETE ON public.da_client_commerce_order_snapshot_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_order_snapshot_immutable();

-- The ONLY app-accessible snapshot insertion path, requiring a genuine
-- server-priced CanonicalOrderQuote before the payment reservation step.
-- Caller must be the authenticated API, never a browser/mobile-origin field.
CREATE FUNCTION public.da_qa_service_store_order_snapshot(
  p_order uuid,p_issuer text,p_subject uuid,p_quote char(64),
  p_cart char(64),p_merchant varchar,p_subtotal bigint,
  p_delivery bigint,p_lines jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  o public.da_client_commerce_orders_qa%ROWTYPE;
  s public.da_client_commerce_order_snapshot_qa%ROWTYPE;
  line jsonb;
  sku text;
  line_name text;
  category_name text;
  q integer;
  unit bigint;
  line_minor bigint;
  sum_minor bigint := 0;
  sum_qty integer := 0;
  seen_skus text[] := ARRAY[]::text[];
BEGIN
  IF p_order IS NULL OR p_issuer IS NULL OR p_subject IS NULL
     OR p_quote IS NULL OR p_quote !~ '^[0-9a-f]{64}$'
     OR p_cart IS NULL OR p_cart !~ '^[0-9a-f]{64}$'
     OR p_merchant IS NULL OR
        p_merchant !~ '^[a-z0-9][a-z0-9_-]{1,119}$'
     OR p_subtotal IS NULL OR p_subtotal<1 OR p_subtotal>100000000
     OR p_delivery IS NULL OR p_delivery<0 OR p_delivery>100000000
     OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'qa_server_canonical_snapshot_invalid';
  END IF;

  SELECT * INTO o FROM public.da_client_commerce_orders_qa
    WHERE order_id=p_order AND issuer=p_issuer AND
      client_subject=p_subject FOR UPDATE;
  IF NOT FOUND OR o.state<>'pending_payment' OR
      o.quote_fingerprint<>p_quote OR o.cart_fingerprint<>p_cart OR
      o.merchant_slug<>p_merchant OR o.currency<>'EUR' OR
      o.total_minor IS DISTINCT FROM p_subtotal+p_delivery THEN
    RAISE EXCEPTION 'qa_server_snapshot_order_binding_mismatch';
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF jsonb_typeof(line) IS DISTINCT FROM 'object'
      OR line - 'sku' - 'name' - 'category' - 'quantity' -
         'unitAmountMinor' - 'lineAmountMinor' <> '{}'::jsonb
      OR jsonb_typeof(line->'sku') IS DISTINCT FROM 'string'
      OR jsonb_typeof(line->'name') IS DISTINCT FROM 'string'
      OR jsonb_typeof(line->'category') IS DISTINCT FROM 'string'
      OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number'
      OR jsonb_typeof(line->'unitAmountMinor') IS DISTINCT FROM 'number'
      OR jsonb_typeof(line->'lineAmountMinor') IS DISTINCT FROM 'number'
      THEN RAISE EXCEPTION 'qa_server_snapshot_item_structure_invalid';
    END IF;
    sku := line->>'sku';
    line_name := line->>'name';
    category_name := line->>'category';
    IF sku !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$' OR
      sku=ANY(seen_skus) OR
      char_length(line_name) NOT BETWEEN 1 AND 180 OR
      char_length(category_name) NOT BETWEEN 1 AND 90 OR
      line_name ~ '[<>[:cntrl:]]' OR category_name ~ '[<>[:cntrl:]]' OR
      (line->>'quantity') !~ '^[1-9][0-9]{0,1}$' OR
      (line->>'unitAmountMinor') !~ '^[1-9][0-9]{0,7}$' OR
      (line->>'lineAmountMinor') !~ '^[1-9][0-9]{0,8}$'
      THEN RAISE EXCEPTION 'qa_server_snapshot_item_value_invalid';
    END IF;
    q := (line->>'quantity')::integer;
    unit := (line->>'unitAmountMinor')::bigint;
    line_minor := (line->>'lineAmountMinor')::bigint;
    IF q>50 OR line_minor>100000000 OR
       line_minor<>q*unit THEN
      RAISE EXCEPTION 'qa_server_snapshot_line_money_mismatch';
    END IF;
    seen_skus := array_append(seen_skus,sku);
    sum_qty := sum_qty + q;
    sum_minor := sum_minor + line_minor;
    IF sum_qty>100 OR sum_minor>100000000 THEN
      RAISE EXCEPTION 'qa_server_snapshot_limits_exceeded';
    END IF;
  END LOOP;
  IF sum_minor<>p_subtotal OR array_length(seen_skus,1)<1 THEN
    RAISE EXCEPTION 'qa_server_snapshot_subtotal_mismatch';
  END IF;

  INSERT INTO public.da_client_commerce_order_snapshot_qa(
    order_id,issuer,client_subject,merchant_slug,
    quote_fingerprint,cart_fingerprint,
    subtotal_minor,delivery_fee_minor,total_minor,currency,line_items
  ) VALUES(p_order,p_issuer,p_subject,p_merchant,p_quote,p_cart,
       p_subtotal,p_delivery,o.total_minor,o.currency,p_lines)
  ON CONFLICT(order_id) DO NOTHING;
  SELECT * INTO s FROM public.da_client_commerce_order_snapshot_qa
    WHERE order_id=p_order;
  IF NOT FOUND OR s.issuer<>p_issuer OR s.client_subject<>p_subject
    OR s.merchant_slug<>p_merchant OR s.quote_fingerprint<>p_quote
    OR s.cart_fingerprint<>p_cart OR s.subtotal_minor<>p_subtotal
    OR s.delivery_fee_minor<>p_delivery
    OR s.total_minor<>o.total_minor OR s.currency<>o.currency
    OR s.line_items<>p_lines THEN
    RAISE EXCEPTION 'qa_server_snapshot_idempotency_collision';
  END IF;
  RETURN p_order;
END;
$$;

REVOKE ALL ON TABLE public.da_client_commerce_order_snapshot_qa FROM
  PUBLIC,da_qa_client_commerce_app,da_qa_psp_verified_receiver,
  da_qa_webhook_inbox_receiver,da_qa_stripe_intent_creator,
  da_qa_stripe_finance_reconciler;
REVOKE ALL ON FUNCTION public.da_qa_service_store_order_snapshot(
  uuid,text,uuid,character,character,varchar,bigint,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_service_store_order_snapshot(
  uuid,text,uuid,character,character,varchar,bigint,bigint,jsonb)
  TO da_qa_client_commerce_app;

-- The existing Stripe TEST authority INSERT cannot occur for an orphan
-- basket, even if application code or an old mobile client omits the new
-- atomic server-side snapshot call. No payment is created in this trigger.
CREATE FUNCTION public.da_qa_payment_requires_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.da_client_commerce_order_snapshot_qa s
    WHERE s.order_id=NEW.order_id AND s.issuer=NEW.issuer
      AND s.client_subject=NEW.client_subject
      AND s.quote_fingerprint=NEW.quote_fingerprint
      AND s.total_minor=NEW.total_minor AND s.currency=NEW.currency
  ) THEN
    RAISE EXCEPTION 'qa_payment_requires_canonical_order_snapshot';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER da_qa_payment_requires_snapshot
BEFORE INSERT ON public.da_client_commerce_payment_authority_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_payment_requires_snapshot();

-- Dispatch must pass a fresh DB check at every offer/accept/hand-off.
-- Existing QA finance authorization is tightened to require a durable
-- snapshot as well as the captured/unrefunded/undisputed Stripe receipt.
CREATE OR REPLACE FUNCTION public.da_qa_commerce_order_dispatch_eligible(
  p_order uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.da_client_commerce_orders_qa o
    JOIN public.da_client_commerce_order_snapshot_qa s
      ON s.order_id=o.order_id AND s.quote_fingerprint=o.quote_fingerprint
      AND s.cart_fingerprint=o.cart_fingerprint
      AND s.merchant_slug=o.merchant_slug
      AND s.total_minor=o.total_minor AND s.currency=o.currency
    JOIN public.da_client_commerce_payment_authority_qa a
      ON a.order_id=o.order_id
    JOIN public.da_stripe_test_financial_receipts_qa r
      ON r.authority_id=a.authority_id
      AND r.stripe_payment_intent_id=a.stripe_payment_intent_id
      AND r.amount_captured=o.total_minor AND r.currency=o.currency
    WHERE o.order_id=p_order AND o.state='paid' AND a.state='succeeded'
      AND a.stripe_mode='test' AND a.provider_verified IS TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.da_stripe_test_financial_holds_qa h
        WHERE h.authority_id=a.authority_id
      )
  );
$$;
COMMENT ON TABLE public.da_client_commerce_order_snapshot_qa IS
  'QA DISCONNECTED only; immutable server-priced article lines, no customer PII. Never run on VPS.';

COMMIT;
