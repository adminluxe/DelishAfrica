-- DelishAfrica P0 | 018 | PG17 isolated synthetic QA only.
-- Transactional finance outbox. NO live provider / VPS / persistent DB migration.
-- Requires existing isolated client-commerce migrations 001..008.
-- Receipt and hold triggers are in the SAME transaction as financial writes.
-- No worker, notifications, payout, merchant or courier financial mutation.
BEGIN;

CREATE ROLE da_qa_finance_outbox_reader_018 LOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO da_qa_finance_outbox_reader_018;

CREATE TABLE public.da_qa_financial_outbox_018 (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_id uuid NOT NULL REFERENCES
    public.da_client_commerce_payment_authority_qa(authority_id)
    ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES
    public.da_client_commerce_orders_qa(order_id) ON DELETE RESTRICT,
  event_kind text NOT NULL CHECK (
    event_kind IN ('payment_captured','financial_hold')
  ),
  source_id text NOT NULL CHECK (
    source_id ~ '^(ch_|re_|dp_)[A-Za-z0-9_]{6,120}$'
  ),
  source_mode text NOT NULL DEFAULT 'test' CHECK (source_mode='test'),
  recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT da_qa_financial_outbox_unique_018
    UNIQUE(authority_id,event_kind,source_id)
);
CREATE INDEX da_qa_financial_outbox_time_018
  ON public.da_qa_financial_outbox_018(recorded_at,event_id);

-- Append-only evidence. Never put raw webhook JSON, secrets, payment
-- client_secret, email, phone, balances or personal names in the queue.
CREATE FUNCTION public.da_qa_financial_outbox_immutable_018()
RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION 'qa_financial_outbox_immutable';
END;
$$;
CREATE TRIGGER da_qa_financial_outbox_immutable_018
BEFORE UPDATE OR DELETE ON public.da_qa_financial_outbox_018
FOR EACH ROW EXECUTE FUNCTION public.da_qa_financial_outbox_immutable_018();

CREATE FUNCTION public.da_qa_financial_outbox_capture_018()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
  -- This trigger is reached ONLY when the finance reconciler's verified
  -- receipt is actually inserted. Signed webhook inbox alone is insufficient.
  INSERT INTO public.da_qa_financial_outbox_018(
    authority_id,order_id,event_kind,source_id,source_mode
  )
  SELECT NEW.authority_id,a.order_id,'payment_captured',
    NEW.stripe_charge_id,'test'
  FROM public.da_client_commerce_payment_authority_qa a
  WHERE a.authority_id=NEW.authority_id
    AND a.stripe_payment_intent_id=NEW.stripe_payment_intent_id
    AND a.stripe_mode='test'
    AND a.total_minor=NEW.amount_captured
    AND a.currency=NEW.currency;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>1 THEN
    RAISE EXCEPTION 'qa_outbox_capture_authority_binding_failed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.da_qa_financial_outbox_hold_018()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.da_qa_financial_outbox_018(
    authority_id,order_id,event_kind,source_id,source_mode
  )
  SELECT NEW.authority_id,a.order_id,'financial_hold',
    NEW.stripe_adjustment_id,'test'
  FROM public.da_client_commerce_payment_authority_qa a
  WHERE a.authority_id=NEW.authority_id AND a.stripe_mode='test';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n<>1 THEN
    RAISE EXCEPTION 'qa_outbox_hold_authority_binding_failed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER da_qa_financial_outbox_capture_018
AFTER INSERT ON public.da_stripe_test_financial_receipts_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_financial_outbox_capture_018();
CREATE TRIGGER da_qa_financial_outbox_hold_018
AFTER INSERT ON public.da_stripe_test_financial_holds_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_financial_outbox_hold_018();

-- The QA application, webhook, finance and partner roles cannot read raw
-- outbox tables, forge events or mutate dispatch. A dedicated restricted
-- reader has only a narrowly scoped, bounded SELECT function.
CREATE FUNCTION public.da_qa_financial_outbox_read_018(p_limit integer)
RETURNS TABLE(
  event_id uuid,authority_id uuid,order_id uuid,
  event_kind text,source_id text,recorded_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'qa_outbox_limit_invalid';
  END IF;
  RETURN QUERY
    SELECT q.event_id,q.authority_id,q.order_id,q.event_kind,
      q.source_id,q.recorded_at
    FROM public.da_qa_financial_outbox_018 q
    ORDER BY q.recorded_at,q.event_id LIMIT p_limit;
END;
$$;

REVOKE ALL ON TABLE public.da_qa_financial_outbox_018 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_financial_outbox_capture_018() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_financial_outbox_hold_018() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_financial_outbox_immutable_018() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_financial_outbox_read_018(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_financial_outbox_read_018(integer)
  TO da_qa_finance_outbox_reader_018;

COMMENT ON TABLE public.da_qa_financial_outbox_018 IS
  'Disconnected QA 018: transactional append-only capture/hold ledger; no delivery worker or production outbox.';
COMMIT;
