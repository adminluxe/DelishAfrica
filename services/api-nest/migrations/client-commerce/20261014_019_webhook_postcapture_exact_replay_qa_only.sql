-- DELISHAFRICA | 019 | QA-only exact webhook replay after capture.
-- New signed events are still forbidden once the authority is succeeded.
-- Surgical SQL function replacement derived from migration 003, with a
-- read-only exact-match replay path. NO persistent or production migration.
-- No role grants, schema rights, financial finality or AppModule changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.da_qa_record_signed_test_webhook(
  p_event_id text,
  p_event_type text,
  p_payment_intent_id text,
  p_raw_sha256 char(64),
  p_live_mode boolean
) RETURNS TABLE(
  event_id text,
  associated_authority_id uuid,
  duplicate boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE
  a public.da_client_commerce_payment_authority_qa%ROWTYPE;
  e public.da_stripe_test_webhook_inbox_qa%ROWTYPE;
  newly_inserted boolean := false;
BEGIN
  IF p_live_mode IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'qa_stripe_live_mode_forbidden';
  END IF;
  IF p_event_id IS NULL OR
    p_event_id !~ '^evt_[A-Za-z0-9_]{6,120}$' OR
    p_event_type IS NULL OR p_event_type NOT IN (
      'payment_intent.succeeded','payment_intent.payment_failed',
      'payment_intent.canceled'
    ) OR
    p_payment_intent_id IS NULL OR
    p_payment_intent_id !~ '^pi_[A-Za-z0-9_]{6,120}$' OR
    p_raw_sha256 IS NULL OR
    p_raw_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'qa_stripe_event_shape_rejected';
  END IF;

  -- 019 FIX: A signed EXACT duplicate may arrive after capture has
  -- committed and the payment authority moved to 'succeeded'. Accepting
  -- ONLY the preexisting identical immutable inbox event is safe: it is
  -- a pure acknowledgement; it does not insert or change finance state.
  SELECT * INTO e FROM public.da_stripe_test_webhook_inbox_qa
    WHERE stripe_event_id=p_event_id;
  IF FOUND THEN
    SELECT * INTO a FROM public.da_client_commerce_payment_authority_qa
      WHERE authority_id=e.authority_id
        AND stripe_payment_intent_id=p_payment_intent_id
        AND stripe_mode='test' AND state IN ('intent_created','succeeded');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'qa_stripe_payment_intent_not_reserved_or_active';
    END IF;
    IF e.authority_id IS DISTINCT FROM a.authority_id OR
       e.payment_intent_id IS DISTINCT FROM p_payment_intent_id OR
       e.event_type IS DISTINCT FROM p_event_type OR
       e.raw_payload_sha256 IS DISTINCT FROM p_raw_sha256 OR
       e.stripe_mode IS DISTINCT FROM 'test' THEN
      RAISE EXCEPTION 'qa_stripe_event_id_payload_collision_rejected';
    END IF;
    event_id := e.stripe_event_id;
    associated_authority_id := e.authority_id;
    duplicate := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Fresh events still require pre-capture reserved intent; never accept
  -- a NEW event ID after capture, refund or dispute as a shortcut.
  -- Do not accept a well-signed event for a foreign/unreserved intent.
  SELECT * INTO a FROM public.da_client_commerce_payment_authority_qa
    WHERE stripe_payment_intent_id=p_payment_intent_id
      AND stripe_mode='test'
      AND state='intent_created';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qa_stripe_payment_intent_not_reserved_or_active';
  END IF;

  INSERT INTO public.da_stripe_test_webhook_inbox_qa(
    stripe_event_id,authority_id,payment_intent_id,event_type,
    raw_payload_sha256
  ) VALUES (
    p_event_id,a.authority_id,p_payment_intent_id,
    p_event_type,p_raw_sha256
  ) ON CONFLICT (stripe_event_id) DO NOTHING
    RETURNING * INTO e;

  newly_inserted := FOUND;
  IF NOT newly_inserted THEN
    SELECT * INTO e FROM public.da_stripe_test_webhook_inbox_qa
      WHERE stripe_event_id=p_event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'qa_stripe_event_inbox_unresolved_fail_closed';
    END IF;
  END IF;
  IF e.authority_id IS DISTINCT FROM a.authority_id OR
     e.payment_intent_id IS DISTINCT FROM p_payment_intent_id OR
     e.event_type IS DISTINCT FROM p_event_type OR
     e.raw_payload_sha256 IS DISTINCT FROM p_raw_sha256 OR
     e.stripe_mode IS DISTINCT FROM 'test' THEN
    RAISE EXCEPTION 'qa_stripe_event_id_payload_collision_rejected';
  END IF;

  event_id := e.stripe_event_id;
  associated_authority_id := e.authority_id;
  duplicate := NOT newly_inserted;
  RETURN NEXT;
END;
$$;


COMMENT ON FUNCTION public.da_qa_record_signed_test_webhook(
  text,text,text,character,boolean) IS
  'QA-only 019: exact signed event replay after capture is an immutable ACK; fresh events after succeeded are denied. Never marks paid.';

COMMIT;
