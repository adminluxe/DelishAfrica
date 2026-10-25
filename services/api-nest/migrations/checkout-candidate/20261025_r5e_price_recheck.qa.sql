-- R5E QA ONLY: independent SQL price revalidation from the canonical-shaped
-- published catalog, even if a limited checkout worker forges the quote JSON.
-- This is NOT approved for production, Stripe, wallets or payouts.
-- Depends on R5D QA revision guard and private r5d_checkout_worker.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('delishafrica:r5e:qa-price-revalidation'));
CREATE OR REPLACE FUNCTION da_checkout_candidate.reserve_verified_qa(
 p_issuer text, p_subject text, p_partner text, p_mutation text,
 p_fingerprint text, p_quote jsonb, p_expected_published_revision integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,da_checkout_candidate AS $fn$
DECLARE
 v_partner record;
 v_menu jsonb;
 v_quote_item jsonb;
 v_catalog_item jsonb;
 v_sku text;
 v_quantity integer;
 v_unit bigint;
 v_line bigint;
 v_subtotal bigint := 0;
 v_delivery bigint;
 v_total bigint;
 v_raw numeric;
 v_items jsonb;
BEGIN
 IF p_expected_published_revision IS NULL OR p_expected_published_revision<1
   OR p_quote IS NULL OR jsonb_typeof(p_quote)<>'object' OR
   p_quote->>'partnerSlug' IS NULL OR
   p_quote->>'currency' IS DISTINCT FROM 'eur' OR
   p_quote->>'version' IS DISTINCT FROM '1' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_qa_quote_invalid';
 END IF;
 -- Price source locked until the INSERT and outbox transaction commits.
 SELECT published_revision,published_payload INTO v_partner
 FROM public.da_catalog_partners
 WHERE partner_id=p_partner AND slug=p_quote->>'partnerSlug'
 AND lifecycle_status='published' FOR SHARE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='checkout_partner_not_published';
 END IF;
 IF v_partner.published_revision IS DISTINCT FROM p_expected_published_revision
 THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_catalog_revision_changed';
 END IF;
 IF v_partner.published_payload->>'status' IS DISTINCT FROM 'active' OR
    v_partner.published_payload->'delivery'->>'enabled'='false' THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='checkout_catalog_not_orderable';
 END IF;
 IF jsonb_typeof(v_partner.published_payload->'menuItems')='array' THEN
   v_menu:=v_partner.published_payload->'menuItems';
 ELSE
   v_menu:=v_partner.published_payload->'menu';
 END IF;
 v_items:=p_quote->'items';
 IF jsonb_typeof(v_menu) IS DISTINCT FROM 'array' OR
    jsonb_typeof(v_items) IS DISTINCT FROM 'array' OR
    jsonb_array_length(v_items)<1 OR jsonb_array_length(v_items)>8 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_qa_menu_invalid';
 END IF;
 FOR v_quote_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
   IF jsonb_typeof(v_quote_item)<>'object' THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_qa_item_invalid';
   END IF;
   v_sku:=v_quote_item->>'sku';
   v_quantity:=(v_quote_item->>'quantity')::integer;
   IF v_sku IS NULL OR v_sku !~ '^[a-z0-9_-]{3,80}$' OR
      v_quantity NOT BETWEEN 1 AND 30 THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_qa_item_invalid';
   END IF;
   v_catalog_item:=NULL;
   SELECT value INTO v_catalog_item FROM jsonb_array_elements(v_menu)
   WHERE COALESCE(NULLIF(value->>'sku',''),value->>'id')=v_sku
   LIMIT 1;
   IF v_catalog_item IS NULL THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_qa_unknown_sku';
   END IF;
   -- Same *positive* monetary priority as CatalogOrderPolicyService.itemAmount:
   -- amount minor units; else priceEUR *100; else price (>100 minor, <=100 EUR).
   v_unit:=NULL;
   v_raw:=NULLIF(v_catalog_item->>'amount','')::numeric;
   IF v_raw>0 THEN
      v_unit:=round(v_raw)::bigint;
   ELSE
      v_raw:=NULLIF(v_catalog_item->>'priceEUR','')::numeric;
      IF v_raw>0 THEN
        v_unit:=round(v_raw*100)::bigint;
      ELSE
        v_raw:=NULLIF(v_catalog_item->>'price','')::numeric;
        IF v_raw>0 THEN
          IF v_raw>100 THEN v_unit:=round(v_raw)::bigint;
          ELSE v_unit:=round(v_raw*100)::bigint; END IF;
        END IF;
      END IF;
   END IF;
   IF v_unit IS NULL OR v_unit<1 THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='checkout_qa_unit_unavailable';
   END IF;
   v_line:=v_unit*v_quantity;
   IF (v_quote_item->>'unitAmount')::bigint IS DISTINCT FROM v_unit OR
      (v_quote_item->>'lineAmount')::bigint IS DISTINCT FROM v_line THEN
     RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_qa_price_forged';
   END IF;
   v_subtotal:=v_subtotal+v_line;
 END LOOP;
 v_raw:=COALESCE(NULLIF(v_partner.published_payload->'delivery'->>'deliveryFee','')::numeric,0);
 v_delivery:=greatest(0,round(v_raw)::bigint);
 v_total:=v_subtotal+v_delivery;
 IF v_total<1 OR v_total>20000000 OR
    (p_quote->>'subtotal')::bigint IS DISTINCT FROM v_subtotal OR
    (p_quote->>'deliveryFee')::bigint IS DISTINCT FROM v_delivery OR
    (p_quote->>'total')::bigint IS DISTINCT FROM v_total THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='checkout_qa_price_forged';
 END IF;
 -- No PUBLIC EXECUTE, no table SELECT for checkout worker. The function
 -- verifies actual published menu, quantity and fee before R5C reserve_trusted.
 RETURN da_checkout_candidate.reserve_trusted(
   p_issuer,p_subject,p_partner,p_mutation,p_fingerprint,p_quote
 );
END;$fn$;
REVOKE ALL ON FUNCTION da_checkout_candidate.reserve_verified_qa(
 text,text,text,text,text,jsonb,integer
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION da_checkout_candidate.reserve_revision_qa(
 text,text,text,text,text,jsonb,integer
) FROM r5d_checkout_worker;
GRANT EXECUTE ON FUNCTION da_checkout_candidate.reserve_verified_qa(
 text,text,text,text,text,jsonb,integer
) TO r5d_checkout_worker;
COMMIT;
