-- QA ONLY, additive R5D guard. Not approved for canonical deployment.
-- Use in disposable PostgreSQL16 after the canonical-foundation and R5C SQL.
-- Role r5d_checkout_worker must be pre-created in the disposable QA DB.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('delishafrica:r5d:qa-revision-guard'));
CREATE OR REPLACE FUNCTION da_checkout_candidate.reserve_revision_qa(
  p_issuer text, p_subject text, p_partner text, p_mutation text,
  p_fingerprint text, p_quote jsonb, p_expected_published_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,da_checkout_candidate AS $fn$
DECLARE v_revision integer;
BEGIN
  IF p_expected_published_revision IS NULL OR
     p_expected_published_revision < 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='checkout_revision_required';
  END IF;
  -- Hold a share lock on the published price source until reservation commit.
  -- A publisher updating this catalog row must wait for this transaction.
  SELECT published_revision INTO v_revision
  FROM public.da_catalog_partners
  WHERE partner_id=p_partner
    AND slug=p_quote->>'partnerSlug'
    AND lifecycle_status='published'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='checkout_partner_not_published';
  END IF;
  IF v_revision IS DISTINCT FROM p_expected_published_revision THEN
    RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_catalog_revision_changed';
  END IF;
  RETURN da_checkout_candidate.reserve_trusted(
    p_issuer,p_subject,p_partner,p_mutation,p_fingerprint,p_quote
  );
END;$fn$;
REVOKE ALL ON FUNCTION da_checkout_candidate.reserve_revision_qa(
 text,text,text,text,text,jsonb,integer
) FROM PUBLIC;
GRANT USAGE ON SCHEMA da_checkout_candidate TO r5d_checkout_worker;
GRANT EXECUTE ON FUNCTION da_checkout_candidate.reserve_revision_qa(
 text,text,text,text,text,jsonb,integer
) TO r5d_checkout_worker;
-- Neither the raw reserve_trusted function nor the underlying tables are
-- exposed to the checkout worker. Auditing role gets SELECT only in QA.
COMMIT;
