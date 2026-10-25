-- R5A P0-C PRIVATE CANDIDATE ONLY; PostgreSQL 16 disposable QA.
-- This file DOES NOT migrate the canonical DelishAfrica database.
-- No public checkout, no production AppModule, no Stripe API, no balances.
-- The trusted Nest adapter MUST authenticate issuer, subject and tenant
-- before invoking these SECURITY DEFINER functions.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA r5a_checkout_qa;
REVOKE ALL ON SCHEMA r5a_checkout_qa FROM PUBLIC;
CREATE ROLE r5a_checkout_worker LOGIN;
GRANT USAGE ON SCHEMA r5a_checkout_qa TO r5a_checkout_worker;

CREATE TABLE r5a_checkout_qa.catalog_item (
  tenant_id text NOT NULL,
  merchant_id uuid NOT NULL,
  sku text NOT NULL,
  currency text NOT NULL CHECK (currency='EUR'),
  price_minor bigint NOT NULL CHECK (price_minor > 0),
  available boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id,merchant_id,sku)
);
CREATE TABLE r5a_checkout_qa.reservation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer text NOT NULL,
  subject uuid NOT NULL,
  tenant_id text NOT NULL,
  merchant_id uuid NOT NULL,
  sku text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 30),
  currency text NOT NULL CHECK (currency='EUR'),
  unit_minor bigint NOT NULL CHECK (unit_minor > 0),
  total_minor bigint NOT NULL CHECK (total_minor > 0),
  fingerprint text NOT NULL,
  mutation_key text NOT NULL,
  stripe_idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved','intent_claimed','intent_recorded')),
  claim_owner uuid,
  lease_until timestamptz,
  payment_intent_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (issuer,subject,mutation_key)
);
CREATE TABLE r5a_checkout_qa.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES r5a_checkout_qa.reservation(id),
  event_type text NOT NULL CHECK (event_type='create_payment_intent'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz,
  UNIQUE (reservation_id,event_type)
);
REVOKE ALL ON ALL TABLES IN SCHEMA r5a_checkout_qa FROM PUBLIC;
INSERT INTO r5a_checkout_qa.catalog_item
 (tenant_id,merchant_id,sku,currency,price_minor,available) VALUES
 ('tenant-alpha','00000000-0000-4000-8000-000000000001','qa-rice','EUR',2190,true),
 ('tenant-beta','00000000-0000-4000-8000-000000000002','qa-mango','EUR',950,true),
 ('tenant-alpha','00000000-0000-4000-8000-000000000001','qa-inactive','EUR',499,false);

-- Returns only a server-confirmed COMMITTED reservation; p_claimed_minor
-- is for adversarial testing, never an authority for the charge amount.
CREATE FUNCTION r5a_checkout_qa.reserve(
  p_issuer text,p_subject uuid,p_tenant text,p_merchant uuid,
  p_sku text,p_quantity integer,p_currency text,
  p_mutation text,p_claimed_minor bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,r5a_checkout_qa
AS $fn$
DECLARE
  c record;
  v_total bigint;
  v_fingerprint text;
  v_stripe_key text;
  r r5a_checkout_qa.reservation%ROWTYPE;
BEGIN
  IF p_subject IS NULL OR p_issuer NOT LIKE 'http://127.0.0.1:%'
     OR p_tenant NOT IN ('tenant-alpha','tenant-beta')
     OR p_quantity NOT BETWEEN 1 AND 30
     OR p_currency <> 'EUR'
     OR p_mutation !~ '^[A-Za-z0-9_-]{12,80}$'
     OR length(p_sku) > 100 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_invalid_trusted_input';
  END IF;
  SELECT currency,price_minor,available
    INTO c FROM r5a_checkout_qa.catalog_item
    WHERE tenant_id=p_tenant AND merchant_id=p_merchant AND sku=p_sku
    FOR SHARE;
  IF NOT FOUND OR c.available IS NOT true THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_catalog_missing_or_unavailable';
  END IF;
  v_total := c.price_minor * p_quantity;
  IF v_total <= 0 OR v_total > 200000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_server_quote_out_of_bounds';
  END IF;
  IF p_claimed_minor IS NOT NULL AND p_claimed_minor<>v_total THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_client_amount_mismatch';
  END IF;
  v_fingerprint := encode(public.digest(
    p_tenant||':'||p_merchant||':'||p_sku||':'||p_quantity||':'||
    c.price_minor||':'||c.currency,'sha256'),'hex');
  v_stripe_key := 'da-r5a-qa-'||encode(public.digest(
    p_issuer||':'||p_subject||':'||p_mutation,'sha256'),'hex');
  INSERT INTO r5a_checkout_qa.reservation
    (issuer,subject,tenant_id,merchant_id,sku,quantity,currency,
     unit_minor,total_minor,fingerprint,mutation_key,stripe_idempotency_key)
  VALUES
    (p_issuer,p_subject,p_tenant,p_merchant,p_sku,p_quantity,c.currency,
     c.price_minor,v_total,v_fingerprint,p_mutation,v_stripe_key)
  ON CONFLICT (issuer,subject,mutation_key) DO NOTHING
  RETURNING * INTO r;
  IF NOT FOUND THEN
    SELECT * INTO r FROM r5a_checkout_qa.reservation
    WHERE issuer=p_issuer AND subject=p_subject AND mutation_key=p_mutation;
  END IF;
  IF r.id IS NULL OR r.tenant_id<>p_tenant OR
     r.merchant_id<>p_merchant OR r.sku<>p_sku OR
     r.quantity<>p_quantity OR r.currency<>p_currency OR
     r.total_minor<>v_total OR r.fingerprint<>v_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_idempotency_conflict';
  END IF;
  INSERT INTO r5a_checkout_qa.outbox(reservation_id,event_type)
    VALUES(r.id,'create_payment_intent')
    ON CONFLICT (reservation_id,event_type) DO NOTHING;
  RETURN jsonb_build_object('reservation_id',r.id,
    'issuer',r.issuer,'subject',r.subject,'tenant',r.tenant_id,
    'merchant',r.merchant_id,'currency',r.currency,'amount_minor',r.total_minor,
    'fingerprint',r.fingerprint,'stripe_idempotency_key',r.stripe_idempotency_key,
    'status',r.status,'payment_intent_id',r.payment_intent_id);
END;
$fn$;

CREATE FUNCTION r5a_checkout_qa.claim_intent(
  p_id uuid,p_issuer text,p_subject uuid,p_tenant text,p_worker uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,r5a_checkout_qa
AS $fn$
DECLARE r r5a_checkout_qa.reservation%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_subject IS NULL OR p_worker IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_claim_invalid_identity';
  END IF;
  UPDATE r5a_checkout_qa.reservation SET
    status='intent_claimed',claim_owner=p_worker,
    lease_until=clock_timestamp()+INTERVAL '90 seconds',
    updated_at=clock_timestamp()
  WHERE id=p_id AND issuer=p_issuer AND subject=p_subject AND tenant_id=p_tenant
    AND (status='reserved' OR
      (status='intent_claimed' AND
       (claim_owner=p_worker OR lease_until<clock_timestamp())))
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('reservation_id',r.id,
    'amount_minor',r.total_minor,'currency',r.currency,
    'stripe_idempotency_key',r.stripe_idempotency_key,
    'status',r.status,'worker',r.claim_owner);
END;
$fn$;

CREATE FUNCTION r5a_checkout_qa.record_intent(
  p_id uuid,p_issuer text,p_subject uuid,p_tenant text,
  p_worker uuid,p_pi_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,r5a_checkout_qa
AS $fn$
DECLARE r r5a_checkout_qa.reservation%ROWTYPE;
BEGIN
  IF p_pi_id !~ '^pi_test_[A-Za-z0-9_-]{8,100}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_intent_id_not_test';
  END IF;
  UPDATE r5a_checkout_qa.reservation SET status='intent_recorded',
    payment_intent_id=p_pi_id,updated_at=clock_timestamp()
  WHERE id=p_id AND issuer=p_issuer AND subject=p_subject AND tenant_id=p_tenant
    AND status='intent_claimed' AND claim_owner=p_worker
  RETURNING * INTO r;
  IF NOT FOUND THEN
    SELECT * INTO r FROM r5a_checkout_qa.reservation
    WHERE id=p_id AND issuer=p_issuer AND subject=p_subject AND tenant_id=p_tenant;
    IF r.id IS NULL OR r.status<>'intent_recorded' OR
       r.payment_intent_id IS DISTINCT FROM p_pi_id THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_intent_binding_conflict';
    END IF;
  END IF;
  UPDATE r5a_checkout_qa.outbox SET processed_at=clock_timestamp()
  WHERE reservation_id=p_id AND event_type='create_payment_intent';
  RETURN jsonb_build_object('reservation_id',r.id,
    'payment_intent_id',r.payment_intent_id,'status',r.status);
END;
$fn$;

CREATE FUNCTION r5a_checkout_qa.read_by_mutation(
  p_issuer text,p_subject uuid,p_mutation text
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,r5a_checkout_qa
AS $fn$
  SELECT jsonb_build_object('reservation_id',id,'amount_minor',total_minor,
    'currency',currency,'merchant',merchant_id,'tenant',tenant_id,
    'status',status,'payment_intent_id',payment_intent_id,
    'stripe_idempotency_key',stripe_idempotency_key)
  FROM r5a_checkout_qa.reservation
  WHERE issuer=p_issuer AND subject=p_subject AND mutation_key=p_mutation
$fn$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA r5a_checkout_qa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION r5a_checkout_qa.reserve(
 text,uuid,text,uuid,text,integer,text,text,bigint) TO r5a_checkout_worker;
GRANT EXECUTE ON FUNCTION r5a_checkout_qa.claim_intent(
 uuid,text,uuid,text,uuid) TO r5a_checkout_worker;
GRANT EXECUTE ON FUNCTION r5a_checkout_qa.record_intent(
 uuid,text,uuid,text,uuid,text) TO r5a_checkout_worker;
GRANT EXECUTE ON FUNCTION r5a_checkout_qa.read_by_mutation(
 text,uuid,text) TO r5a_checkout_worker;
