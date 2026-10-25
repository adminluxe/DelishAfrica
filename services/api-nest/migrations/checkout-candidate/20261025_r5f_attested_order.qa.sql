-- R5F QA ONLY: HMAC-bind external JWT identity and mutation to a trusted
-- backend quote before SQL reserve. No public access or LIVE rollout.
-- The key is generated at runtime and stored ONLY in the isolated database
-- under postgres ownership; it is NOT readable by the limited checkout worker.
-- The exact Nest QA adapter must sign this binding after real AuthService checks.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('delishafrica:r5f:qa-attested-order'));
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE TABLE IF NOT EXISTS da_checkout_candidate.attestation_keys_qa (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton=true),
 key_bytes bytea NOT NULL CHECK(octet_length(key_bytes)=32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON da_checkout_candidate.attestation_keys_qa FROM PUBLIC;
CREATE OR REPLACE FUNCTION da_checkout_candidate.reserve_attested_qa(
 p_issuer text,p_subject text,p_partner text,p_mutation text,
 p_fingerprint text,p_quote jsonb,p_revision integer,p_attestation text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,da_checkout_candidate AS $fn$
DECLARE
 v_key bytea;
 v_message text;
 v_expected_hex text;
BEGIN
 IF p_issuer IS NULL OR p_subject IS NULL OR p_partner IS NULL OR
    p_mutation IS NULL OR p_fingerprint IS NULL OR p_revision IS NULL OR
    p_quote IS NULL OR jsonb_typeof(p_quote)<>'object' OR
    p_quote->>'total' IS NULL OR p_quote->>'currency' IS NULL OR
    p_attestation IS NULL OR p_attestation !~ '^[a-f0-9]{64}$' OR
    p_fingerprint !~ '^[a-f0-9]{64}$' OR
    p_mutation !~ '^[A-Za-z0-9_-]{12,80}$' OR
    p_subject !~ '^[0-9a-f-]{36}$' OR
    p_revision<1 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_attestation_input_invalid';
 END IF;
 SELECT key_bytes INTO v_key FROM da_checkout_candidate.attestation_keys_qa
 WHERE singleton=true;
 IF v_key IS NULL OR octet_length(v_key)<>32 THEN
   RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='checkout_attestation_key_missing';
 END IF;
 -- Explicit fixed-order components. chr(31) cannot appear in the issuer,
 -- subject, partner, mutation, digest or minor-amount fields as validated by
 -- the exact private Nest adapter (and SQL input controls).
 v_message := p_issuer||chr(31)||p_subject||chr(31)||p_partner||chr(31)||
     p_mutation||chr(31)||p_fingerprint||chr(31)||p_revision::text||chr(31)||
     (p_quote->>'total')||chr(31)||(p_quote->>'currency');
 v_expected_hex:=encode(public.hmac(convert_to(v_message,'UTF8'),v_key,'sha256'),'hex');
 IF v_expected_hex IS DISTINCT FROM p_attestation THEN
   RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='checkout_identity_attestation_invalid';
 END IF;
 -- Price, unit, fee, revision and buyer status are independently checked by
 -- the R5E/R5C functions before PostgreSQL COMMIT.
 RETURN da_checkout_candidate.reserve_verified_qa(
   p_issuer,p_subject,p_partner,p_mutation,p_fingerprint,p_quote,p_revision
 );
END;$fn$;
REVOKE ALL ON FUNCTION da_checkout_candidate.reserve_attested_qa(
 text,text,text,text,text,jsonb,integer,text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION da_checkout_candidate.reserve_verified_qa(
 text,text,text,text,text,jsonb,integer
) FROM r5d_checkout_worker;
GRANT EXECUTE ON FUNCTION da_checkout_candidate.reserve_attested_qa(
 text,text,text,text,text,jsonb,integer,text
) TO r5d_checkout_worker;
COMMIT;
