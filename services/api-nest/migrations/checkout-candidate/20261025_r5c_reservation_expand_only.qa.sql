-- R5C QA ONLY: candidate additive schema. DO NOT deploy to canonical database.
-- Requires existing catalog-foundation schema; no financial settlement or Stripe.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('delishafrica:r5c:checkout-candidate'));
CREATE SCHEMA IF NOT EXISTS da_checkout_candidate;
REVOKE ALL ON SCHEMA da_checkout_candidate FROM PUBLIC;
CREATE TABLE IF NOT EXISTS da_checkout_candidate.reservation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 issuer text NOT NULL,
 subject text NOT NULL,
 partner_id text NOT NULL REFERENCES public.da_catalog_partners(partner_id) ON DELETE RESTRICT,
 mutation_key text NOT NULL CHECK (mutation_key ~ '^[A-Za-z0-9_-]{12,80}$'),
 quote_fingerprint text NOT NULL CHECK (quote_fingerprint ~ '^[a-f0-9]{64}$'),
 quote_snapshot jsonb NOT NULL,
 amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 1 AND 20000000),
 currency text NOT NULL CHECK (currency='eur'),
 status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','intent_claimed','intent_recorded')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE (issuer,subject,mutation_key),
 CONSTRAINT reservation_client_fk FOREIGN KEY (issuer,subject)
   REFERENCES public.da_identity_subjects(issuer,subject) ON DELETE RESTRICT,
 CONSTRAINT quote_snapshot_object CHECK (jsonb_typeof(quote_snapshot)='object')
);
CREATE TABLE IF NOT EXISTS da_checkout_candidate.outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reservation_id uuid NOT NULL REFERENCES da_checkout_candidate.reservation(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type='payment_intent_requested'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(reservation_id,event_type)
);
REVOKE ALL ON ALL TABLES IN SCHEMA da_checkout_candidate FROM PUBLIC;
-- API cannot directly INSERT or SELECT. SECDEF function verifies active Client,
-- published partner, and server-supplied quote snapshot. Caller must be trusted
-- server-only adapter: *not* a public RPC nor browser-supplied payload.
CREATE OR REPLACE FUNCTION da_checkout_candidate.reserve_trusted(
 p_issuer text,p_subject text,p_partner text,p_mutation text,
 p_fingerprint text,p_quote jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,da_checkout_candidate AS $fn$
DECLARE existing da_checkout_candidate.reservation%ROWTYPE;
 v_total bigint; v_currency text; v_slug text; v_items jsonb;
BEGIN
 IF p_issuer IS NULL OR p_issuer !~ '^https?://' OR length(p_issuer)>300 OR
    p_subject IS NULL OR length(p_subject)<3 OR length(p_subject)>300 OR
    p_mutation IS NULL OR p_mutation !~ '^[A-Za-z0-9_-]{12,80}$' OR
    p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR
    p_quote IS NULL OR jsonb_typeof(p_quote)<>'object' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_bad_trusted_input';
 END IF;
 SELECT (p_quote->>'total')::bigint,(p_quote->>'currency'),p_quote->>'partnerSlug',p_quote->'items'
   INTO v_total,v_currency,v_slug,v_items;
 IF v_total IS NULL OR v_total<1 OR v_total>20000000 OR v_currency<>'eur'
    OR jsonb_typeof(v_items)<>'array' OR jsonb_array_length(v_items)=0 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_quote_invalid';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.da_identity_subjects
   WHERE issuer=p_issuer AND subject=p_subject
    AND identity_kind='client' AND identity_status='active'
 ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='checkout_client_not_active'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.da_catalog_partners
   WHERE partner_id=p_partner AND slug=v_slug AND lifecycle_status='published'
 ) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='checkout_partner_unavailable'; END IF;
 -- Important: p_quote/p_fingerprint MUST be supplied from a trusted
 -- CatalogOrderPolicyService.quote() adapter, never directly from client.
 INSERT INTO da_checkout_candidate.reservation
 (issuer,subject,partner_id,mutation_key,quote_fingerprint,quote_snapshot,amount_minor,currency)
 VALUES(p_issuer,p_subject,p_partner,p_mutation,p_fingerprint,p_quote,v_total,v_currency)
 ON CONFLICT(issuer,subject,mutation_key) DO NOTHING RETURNING * INTO existing;
 IF NOT FOUND THEN
   SELECT * INTO existing FROM da_checkout_candidate.reservation
   WHERE issuer=p_issuer AND subject=p_subject AND mutation_key=p_mutation;
 END IF;
 IF existing.id IS NULL OR existing.partner_id<>p_partner OR
    existing.quote_fingerprint<>p_fingerprint OR existing.quote_snapshot<>p_quote OR
    existing.amount_minor<>v_total OR existing.currency<>v_currency THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_idempotency_conflict';
 END IF;
 INSERT INTO da_checkout_candidate.outbox(reservation_id,event_type)
 VALUES(existing.id,'payment_intent_requested')
 ON CONFLICT(reservation_id,event_type) DO NOTHING;
 RETURN jsonb_build_object('reservation_id',existing.id,'amount_minor',existing.amount_minor,
   'currency',existing.currency,'status',existing.status);
END;$fn$;
REVOKE ALL ON FUNCTION da_checkout_candidate.reserve_trusted(text,text,text,text,text,jsonb) FROM PUBLIC;
COMMIT;
