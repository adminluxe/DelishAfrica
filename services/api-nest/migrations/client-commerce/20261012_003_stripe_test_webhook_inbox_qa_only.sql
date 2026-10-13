-- DELISHAFRICA: DISCONNECTED POSTGRESQL 17 QA ONLY, NEVER EXECUTE ON VPS.
-- Inbound Stripe TEST webhooks are NOT financial settlement authorization.
-- A signed event is NOT enough to transition a payment/order to paid.
-- No Stripe secret, customer PII, raw payload, or payment client_secret stored.
BEGIN;

CREATE ROLE da_qa_webhook_inbox_receiver LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT USAGE ON SCHEMA public TO da_qa_webhook_inbox_receiver;

CREATE TABLE public.da_stripe_test_webhook_inbox_qa (
  stripe_event_id text PRIMARY KEY
    CHECK (stripe_event_id ~ '^evt_[A-Za-z0-9_]{6,120}$'),
  authority_id uuid NOT NULL REFERENCES
    public.da_client_commerce_payment_authority_qa(authority_id)
    ON DELETE RESTRICT,
  payment_intent_id text NOT NULL
    CHECK (payment_intent_id ~ '^pi_[A-Za-z0-9_]{6,120}$'),
  event_type text NOT NULL CHECK (event_type IN (
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled'
  )),
  stripe_mode text NOT NULL DEFAULT 'test' CHECK (stripe_mode='test'),
  raw_payload_sha256 char(64) NOT NULL
    CHECK (raw_payload_sha256 ~ '^[0-9a-f]{64}$'),
  received_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX da_stripe_webhook_inbox_authority_qa_idx
  ON public.da_stripe_test_webhook_inbox_qa(authority_id, received_at);

-- The inbox is append-only: only inserts via the restricted function below.
-- Internal finance roles cannot alter stored event identity/fingerprints.
CREATE FUNCTION public.da_qa_webhook_inbox_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  RAISE EXCEPTION 'qa_stripe_webhook_inbox_immutable';
END;
$$;
CREATE TRIGGER da_stripe_webhook_inbox_immutable_qa
BEFORE UPDATE OR DELETE ON public.da_stripe_test_webhook_inbox_qa
FOR EACH ROW EXECUTE FUNCTION public.da_qa_webhook_inbox_immutable();

-- The caller MUST independently check HMAC Stripe-Signature with RAW bytes,
-- time tolerance and TEST mode before invoking the function.
-- This function provides ONLY durable deduplication and exact association.
-- It NEVER sets provider_verified, succeeded or order paid.
CREATE FUNCTION public.da_qa_record_signed_test_webhook(
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

REVOKE ALL ON TABLE public.da_stripe_test_webhook_inbox_qa
  FROM PUBLIC,da_qa_webhook_inbox_receiver,
       da_qa_client_commerce_app,da_qa_psp_verified_receiver;
REVOKE ALL ON FUNCTION public.da_qa_record_signed_test_webhook(
  text,text,text,character,boolean)
  FROM PUBLIC,da_qa_client_commerce_app,da_qa_psp_verified_receiver;
GRANT EXECUTE ON FUNCTION public.da_qa_record_signed_test_webhook(
  text,text,text,character,boolean)
  TO da_qa_webhook_inbox_receiver;

COMMENT ON TABLE public.da_stripe_test_webhook_inbox_qa IS
  'DISCONNECTED QA ONLY. Signed Stripe TEST inbound event fingerprint, '
  'NOT provider financial verification. Never marks order paid.';
COMMENT ON ROLE da_qa_webhook_inbox_receiver IS
  'DISCONNECTED QA ONLY. EXECUTE idempotent inbox function, no DML '
  'or ability to mark orders/payments paid. NOT production credentials.';
COMMIT;
