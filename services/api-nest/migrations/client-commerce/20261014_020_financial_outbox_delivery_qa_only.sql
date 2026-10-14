-- DELISHAFRICA P0 / 020 / DISCONNECTED PG17 QA ONLY
-- At-least-once outbox delivery: leased claim, fencing token, bounded
-- retries, terminal dead-letter, and synthetic consumer idempotency.
-- Depends on 001-008 and 018-019. NEVER run on production/VPS.
-- No Stripe calls, paid balances, payout, network worker, or AppModule wiring.
BEGIN;

CREATE ROLE da_qa_finance_delivery_worker_020 LOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
CREATE ROLE da_qa_finance_mock_consumer_020 LOGIN NOSUPERUSER
  NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO
  da_qa_finance_delivery_worker_020,da_qa_finance_mock_consumer_020;

-- Source evidence 018 is strictly append-only; operations are tracked in
-- a SEPARATE state table. No payload, token, raw error, secrets, or PII stored.
CREATE TABLE public.da_qa_financial_delivery_state_020 (
  event_id uuid PRIMARY KEY REFERENCES
    public.da_qa_financial_outbox_018(event_id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'pending'
    CHECK(state IN ('pending','leased','delivered','dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
  lease_token uuid,
  lease_owner text,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  delivered_at timestamptz,
  dead_at timestamptz,
  last_error_code text
    CHECK(last_error_code IS NULL OR last_error_code IN
      ('consumer_timeout','consumer_unavailable',
       'consumer_rejected','lease_expired')),
  CONSTRAINT da_qa_delivery_state_consistency_020 CHECK (
    (state='pending' AND lease_token IS NULL
      AND lease_owner IS NULL AND lease_expires_at IS NULL
      AND delivered_at IS NULL AND dead_at IS NULL AND attempts < 3)
    OR
    (state='leased' AND lease_token IS NOT NULL
      AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL
      AND delivered_at IS NULL AND dead_at IS NULL AND attempts BETWEEN 1 AND 3)
    OR
    (state='delivered' AND lease_token IS NULL
      AND lease_owner IS NULL AND lease_expires_at IS NULL
      AND delivered_at IS NOT NULL AND dead_at IS NULL)
    OR
    (state='dead' AND lease_token IS NULL
      AND lease_owner IS NULL AND lease_expires_at IS NULL
      AND delivered_at IS NULL AND dead_at IS NOT NULL AND attempts=3)
  )
);
CREATE INDEX da_qa_delivery_due_020
  ON public.da_qa_financial_delivery_state_020(next_attempt_at,event_id)
  WHERE state IN ('pending','leased');

-- Audited consumer simulator: separate SQL role, separate transactions.
-- This is NOT a genuine external bus or a production idempotency contract.
CREATE TABLE public.da_qa_mock_consumer_effects_020 (
  event_id uuid PRIMARY KEY REFERENCES
    public.da_qa_financial_outbox_018(event_id) ON DELETE RESTRICT,
  order_id uuid NOT NULL,
  event_kind text NOT NULL CHECK(event_kind IN ('payment_captured','financial_hold')),
  applied_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE FUNCTION public.da_qa_delivery_claim_020(
  p_worker text,p_limit integer,p_lease_seconds integer
) RETURNS TABLE(
  event_id uuid,order_id uuid,event_kind text,source_id text,
  lease_token uuid,attempt integer
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_worker IS NULL OR
    p_worker !~ '^qa-worker-[a-z0-9-]{3,40}$'
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25
    OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 5 AND 300
  THEN RAISE EXCEPTION 'qa_delivery_claim_parameters_invalid'; END IF;

  -- Lazily project newly committed source records, including those produced
  -- after this migration. Source outbox remains untouched.
  INSERT INTO public.da_qa_financial_delivery_state_020(event_id)
    SELECT q.event_id FROM public.da_qa_financial_outbox_018 q
    WHERE NOT EXISTS (SELECT 1
      FROM public.da_qa_financial_delivery_state_020 d
      WHERE d.event_id=q.event_id)
    ORDER BY q.recorded_at,q.event_id
    LIMIT 1000
  ON CONFLICT(event_id) DO NOTHING;

  -- Last attempt crashed and its lease expired: terminal DLQ, not limbo.
  UPDATE public.da_qa_financial_delivery_state_020 d
    SET state='dead',lease_token=NULL,lease_owner=NULL,
        lease_expires_at=NULL,dead_at=statement_timestamp(),
        last_error_code='lease_expired'
    WHERE d.state='leased' AND d.attempts=3
      AND d.lease_expires_at<=statement_timestamp();

  RETURN QUERY
  WITH due AS (
    SELECT d.event_id
    FROM public.da_qa_financial_delivery_state_020 d
    WHERE (d.state='pending' AND d.next_attempt_at<=statement_timestamp()
       OR d.state='leased' AND d.lease_expires_at<=statement_timestamp())
      AND d.attempts<3
    ORDER BY d.next_attempt_at,d.event_id
    FOR UPDATE OF d SKIP LOCKED LIMIT p_limit
  ), updated AS (
    UPDATE public.da_qa_financial_delivery_state_020 d
      SET state='leased',
        attempts=d.attempts+1,
        lease_token=gen_random_uuid(),
        lease_owner=p_worker,
        lease_expires_at=statement_timestamp()+
          make_interval(secs=>p_lease_seconds),
        last_error_code=NULL
    FROM due WHERE d.event_id=due.event_id
    RETURNING d.event_id,d.lease_token,d.attempts
  )
  SELECT q.event_id,q.order_id,q.event_kind,q.source_id,
    u.lease_token,u.attempts
  FROM updated u JOIN public.da_qa_financial_outbox_018 q
    ON q.event_id=u.event_id ORDER BY q.recorded_at,q.event_id;
END;
$$;

CREATE FUNCTION public.da_qa_delivery_ack_020(
  p_event uuid,p_worker text,p_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
  IF p_event IS NULL OR p_worker IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'qa_delivery_ack_invalid';
  END IF;
  UPDATE public.da_qa_financial_delivery_state_020 d
    SET state='delivered',lease_owner=NULL,lease_token=NULL,
        lease_expires_at=NULL,delivered_at=statement_timestamp(),
        last_error_code=NULL
    WHERE d.event_id=p_event AND d.state='leased'
      AND d.lease_owner=p_worker AND d.lease_token=p_token
      AND d.lease_expires_at>statement_timestamp();
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'qa_delivery_stale_or_foreign_lease'; END IF;
  RETURN true;
END;
$$;

CREATE FUNCTION public.da_qa_delivery_fail_020(
  p_event uuid,p_worker text,p_token uuid,p_error_code text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE n integer; next_state text;
BEGIN
  IF p_error_code IS NULL OR p_error_code NOT IN
    ('consumer_timeout','consumer_unavailable','consumer_rejected') THEN
    RAISE EXCEPTION 'qa_delivery_error_code_invalid';
  END IF;
  UPDATE public.da_qa_financial_delivery_state_020 d
    SET state=CASE WHEN d.attempts>=3 THEN 'dead' ELSE 'pending' END,
        lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,
        dead_at=CASE WHEN d.attempts>=3
          THEN statement_timestamp() ELSE NULL END,
        next_attempt_at=statement_timestamp()+
          make_interval(secs=>5*(2 ^ (d.attempts-1))::integer),
        last_error_code=p_error_code
    WHERE d.event_id=p_event AND d.state='leased'
      AND d.lease_owner=p_worker AND d.lease_token=p_token
      AND d.lease_expires_at>statement_timestamp()
    RETURNING d.state INTO next_state;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'qa_delivery_stale_or_foreign_lease'; END IF;
  RETURN next_state;
END;
$$;

CREATE FUNCTION public.da_qa_mock_consumer_apply_020(p_event uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
  IF p_event IS NULL THEN
    RAISE EXCEPTION 'qa_mock_consumer_event_invalid';
  END IF;
  INSERT INTO public.da_qa_mock_consumer_effects_020(
    event_id,order_id,event_kind)
  SELECT q.event_id,q.order_id,q.event_kind
  FROM public.da_qa_financial_outbox_018 q
  WHERE q.event_id=p_event AND q.source_mode='test'
  ON CONFLICT(event_id) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=1 THEN RETURN true; END IF;
  IF NOT EXISTS(SELECT 1
    FROM public.da_qa_mock_consumer_effects_020 WHERE event_id=p_event)
  THEN RAISE EXCEPTION 'qa_mock_consumer_unknown_event'; END IF;
  RETURN false;
END;
$$;

-- Prevent *all* direct DML/SELECT by worker, consumer and standard app roles.
REVOKE ALL ON public.da_qa_financial_delivery_state_020,
  public.da_qa_mock_consumer_effects_020 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.da_qa_delivery_claim_020(text,integer,integer),
  public.da_qa_delivery_ack_020(uuid,text,uuid),
  public.da_qa_delivery_fail_020(uuid,text,uuid,text),
  public.da_qa_mock_consumer_apply_020(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.da_qa_delivery_claim_020(text,integer,integer),
  public.da_qa_delivery_ack_020(uuid,text,uuid),
  public.da_qa_delivery_fail_020(uuid,text,uuid,text)
  TO da_qa_finance_delivery_worker_020;
GRANT EXECUTE ON FUNCTION public.da_qa_mock_consumer_apply_020(uuid)
  TO da_qa_finance_mock_consumer_020;

COMMENT ON TABLE public.da_qa_financial_delivery_state_020 IS
  'QA 020 stateful lease/retry/DLQ, sourced from immutable 018; no real deliveries.';
COMMENT ON TABLE public.da_qa_mock_consumer_effects_020 IS
  'QA 020 synthetic idempotent consumer. Separate DB role; no external effect.';
COMMIT;
