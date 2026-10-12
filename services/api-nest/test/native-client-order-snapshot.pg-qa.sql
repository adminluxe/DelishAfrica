-- DelishAfrica | 006 SQL certification | ephemeral PG17 / network none.
-- No Stripe API, no VPS. This suite fails loudly on any unexpected success.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  oid uuid;
  owner_id uuid := 'a63f867f-9f42-4573-9268-dc65a164d2c1';
  issuer text := 'https://qa.example.invalid/realms/da-client';
  v_lines jsonb :=
    '[{"sku":"rice","name":"Jollof rice","category":"Menu","quantity":1,"unitAmountMinor":1500,"lineAmountMinor":1500},'
    ||'{"sku":"juice","name":"Bissap","category":"Drink","quantity":2,"unitAmountMinor":400,"lineAmountMinor":800}]';
BEGIN
  SELECT order_id INTO oid FROM public.da_qa_service_reserve_order(
    issuer,owner_id,'snapshot-merchant-order-0001',
    repeat('a',64)::char(64),repeat('b',64)::char(64),
    'qa-restaurant',2690,'EUR'::char(3));
  IF oid IS NULL THEN RAISE EXCEPTION 'qa_snapshot_order_missing'; END IF;
  PERFORM set_config('qa.snapshot.order',oid::text,true);

  BEGIN
    PERFORM public.da_qa_service_reserve_test_payment(
      oid,issuer,owner_id,'da-qa-test-v1-'||repeat('a',64));
    RAISE EXCEPTION 'qa_snapshot_missing_but_payment_reserved';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_payment_requires_canonical_order_snapshot' THEN
      RAISE;
    END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.da_client_commerce_payment_authority_qa
    WHERE order_id=oid) THEN
    RAISE EXCEPTION 'qa_snapshot_failed_payment_left_authority';
  END IF;
  RAISE NOTICE 'QA_SNAPSHOT_MISSING=PAYMENT_BLOCKED';

  BEGIN
    PERFORM public.da_qa_service_store_order_snapshot(
      oid,issuer,owner_id,repeat('a',64)::char(64),
      repeat('b',64)::char(64),'qa-restaurant',1890,390,
      v_lines);
    RAISE EXCEPTION 'qa_snapshot_wrong_subtotal_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_server_snapshot_order_binding_mismatch' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.da_qa_service_store_order_snapshot(
      oid,issuer,owner_id,repeat('a',64)::char(64),
      repeat('b',64)::char(64),'qa-restaurant',2300,390,
      v_lines || '[{"sku":"rice","name":"Rice","category":"Menu","quantity":1,"unitAmountMinor":1500,"lineAmountMinor":1500}]'::jsonb);
    RAISE EXCEPTION 'qa_snapshot_non_array_merge_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='qa_snapshot_non_array_merge_accepted' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'QA_SNAPSHOT_WRONG_TOTAL_OR_JSON=DENIED';
END
$$;

-- The restricted app login has EXECUTE on the 006 function but NO direct
-- SELECT/INSERT/UPDATE on the new snapshot table.
SET LOCAL ROLE da_qa_client_commerce_app;
DO $$
DECLARE
  oid uuid:=current_setting('qa.snapshot.order')::uuid;
  issuer text:='https://qa.example.invalid/realms/da-client';
  buyer uuid:='a63f867f-9f42-4573-9268-dc65a164d2c1';
  lines jsonb:=
    '[{"sku":"rice","name":"Jollof rice","category":"Menu","quantity":1,"unitAmountMinor":1500,"lineAmountMinor":1500},'
    ||'{"sku":"juice","name":"Bissap","category":"Drink","quantity":2,"unitAmountMinor":400,"lineAmountMinor":800}]';
  id uuid;
BEGIN
  SELECT public.da_qa_service_store_order_snapshot(
    oid,issuer,buyer,repeat('a',64)::char(64),
    repeat('b',64)::char(64),'qa-restaurant',2300,390,lines
  ) INTO id;
  IF id<>oid THEN RAISE EXCEPTION 'qa_snapshot_commit_uuid_mismatch'; END IF;
  SELECT public.da_qa_service_store_order_snapshot(
    oid,issuer,buyer,repeat('a',64)::char(64),
    repeat('b',64)::char(64),'qa-restaurant',2300,390,lines
  ) INTO id;
  IF id<>oid THEN RAISE EXCEPTION 'qa_snapshot_replay_uuid_mismatch'; END IF;
  RAISE NOTICE 'QA_SNAPSHOT_APP_ROLE_ATOMIC_COMMIT_AND_REPLAY=ONE_ORDER';

  BEGIN
    PERFORM 1 FROM public.da_client_commerce_order_snapshot_qa LIMIT 1;
    RAISE EXCEPTION 'qa_snapshot_direct_table_read_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'QA_SNAPSHOT_APP_ROLE_DIRECT_SELECT=DENIED';
  END;
  BEGIN
    PERFORM public.da_qa_service_store_order_snapshot(
      oid,issuer,'b63f867f-9f42-4573-9268-dc65a164d2c2',
      repeat('a',64)::char(64),repeat('b',64)::char(64),
      'qa-restaurant',2300,390,lines);
    RAISE EXCEPTION 'qa_snapshot_foreign_client_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='qa_snapshot_foreign_client_accepted' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.da_qa_service_store_order_snapshot(
      oid,issuer,buyer,repeat('a',64)::char(64),
      repeat('b',64)::char(64),'qa-restaurant',2300,390,
      jsonb_set(lines,'{0,lineAmountMinor}','1'::jsonb));
    RAISE EXCEPTION 'qa_snapshot_mutated_price_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='qa_snapshot_mutated_price_accepted' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.da_qa_service_store_order_snapshot(
      oid,issuer,buyer,repeat('a',64)::char(64),
      repeat('b',64)::char(64),'qa-restaurant',2300,390,
      lines || jsonb_build_array(lines->0));
    RAISE EXCEPTION 'qa_snapshot_duplicate_sku_accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='qa_snapshot_duplicate_sku_accepted' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'QA_SNAPSHOT_FOREIGN_CLIENT_DUP_SKU_OR_PRICE=DENIED';
END $$;
RESET ROLE;

DO $$
DECLARE
  oid uuid:=current_setting('qa.snapshot.order')::uuid;
  issuer text:='https://qa.example.invalid/realms/da-client';
  buyer uuid:='a63f867f-9f42-4573-9268-dc65a164d2c1';
  auth uuid;
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.da_client_commerce_order_snapshot_qa
    WHERE order_id=oid;
  IF n<>1 THEN RAISE EXCEPTION 'qa_snapshot_not_unique'; END IF;
  BEGIN
    UPDATE public.da_client_commerce_order_snapshot_qa
      SET delivery_fee_minor=0 WHERE order_id=oid;
    RAISE EXCEPTION 'qa_snapshot_update_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_server_order_snapshot_immutable' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.da_client_commerce_order_snapshot_qa WHERE order_id=oid;
    RAISE EXCEPTION 'qa_snapshot_delete_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_server_order_snapshot_immutable' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'QA_SNAPSHOT_IMMUTABLE_AFTER_COMMIT=PASS';

  IF public.da_qa_commerce_order_dispatch_eligible(oid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'qa_snapshot_unpaid_dispatch_allowed';
  END IF;
  SELECT authority_id INTO auth FROM public.da_qa_service_reserve_test_payment(
    oid,issuer,buyer,'da-qa-test-v1-'||repeat('a',64));
  IF auth IS NULL THEN RAISE EXCEPTION 'qa_snapshot_payment_authority_missing'; END IF;
  PERFORM public.da_qa_provider_bind_test_intent(
    auth,'pi_QASNAPSHOTPAYMENT001',2690,'EUR'::char(3));
  IF public.da_qa_commerce_order_dispatch_eligible(oid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'qa_snapshot_intent_only_dispatch_allowed';
  END IF;
  PERFORM public.da_qa_finance_commit_captured_test(
    auth,'pi_QASNAPSHOTPAYMENT001','ch_QASNAPSHOTCHARGE001',
    'acct_QASNAPSHOT001',2690,'EUR'::char(3),repeat('f',64)::char(64),NULL);
  IF public.da_qa_commerce_order_dispatch_eligible(oid) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'qa_snapshot_captured_order_not_dispatchable';
  END IF;
  RAISE NOTICE 'QA_SNAPSHOT_CAPTURED_PAYMENT_AND_IMMUTABLE_LINES=DISPATCH_ALLOWED';

  PERFORM public.da_qa_finance_record_hold(auth,'re_QASNAPSHOTREFUND001','refund');
  IF public.da_qa_commerce_order_dispatch_eligible(oid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'qa_snapshot_refund_did_not_revoke_dispatch';
  END IF;
  RAISE NOTICE 'QA_SNAPSHOT_REFUND_HOLD=DISPATCH_REVOKED';
END $$;
ROLLBACK;
