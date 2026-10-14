-- DELISHAFRICA QA 007: full paid Merchant -> assigned Courier progression.
-- PostgreSQL 17 disposable --network none, all synthetic values, ROLLBACK.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  issuer text:='https://qa.example.invalid/realms/da-client';
  buyer uuid:='a63f867f-9f42-4573-9268-dc65a164d2c1';
  o uuid;
  pay uuid;
  items jsonb:='[{"sku":"rice","name":"Jollof rice","category":"Menu","quantity":1,"unitAmountMinor":1500,"lineAmountMinor":1500},{"sku":"juice","name":"Bissap","category":"Drink","quantity":2,"unitAmountMinor":400,"lineAmountMinor":800}]';
  n bigint;
BEGIN
  SELECT order_id INTO o FROM public.da_qa_service_reserve_order(
    issuer,buyer,'qa-merchant-courier-007-order-001',
    repeat('a',64)::char(64),repeat('b',64)::char(64),
    'qa-restaurant',2690,'EUR'::char(3));
  PERFORM public.da_qa_service_store_order_snapshot(
    o,issuer,buyer,repeat('a',64)::char(64),repeat('b',64)::char(64),
    'qa-restaurant',2300,390,items);
  PERFORM set_config('da.qa.fulfillment.order',o::text,true);
  SELECT count(*) INTO n FROM public.da_qa_merchant_visible_paid_orders(
    'qa-restaurant',20) WHERE order_id=o;
  IF n<>0 THEN RAISE EXCEPTION 'qa_merchant_saw_unpaid_order'; END IF;
  BEGIN
    PERFORM public.da_qa_merchant_transition(o,'qa-restaurant','accepted');
    RAISE EXCEPTION 'qa_merchant_accepted_unpaid';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_merchant_not_owned_or_financial_hold' THEN RAISE; END IF;
  END;
  SELECT authority_id INTO pay FROM public.da_qa_service_reserve_test_payment(
    o,issuer,buyer,'da-qa-test-v1-'||repeat('c',64));
  PERFORM public.da_qa_provider_bind_test_intent(
    pay,'pi_QA007MERCHANTCOURIER001',2690,'EUR'::char(3));
  SELECT count(*) INTO n FROM public.da_qa_merchant_visible_paid_orders(
    'qa-restaurant',20) WHERE order_id=o;
  IF n<>0 THEN RAISE EXCEPTION 'qa_merchant_saw_intent_without_capture'; END IF;
  PERFORM public.da_qa_finance_commit_captured_test(
    pay,'pi_QA007MERCHANTCOURIER001','ch_QA007MERCHANTCOURIER001',
    'acct_QA007MERCHANTCOURIER','2690'::bigint,'EUR'::char(3),
    repeat('e',64)::char(64),NULL);
  PERFORM set_config('da.qa.fulfillment.authority',pay::text,true);
  SELECT count(*) INTO n FROM public.da_qa_merchant_visible_paid_orders(
    'qa-restaurant',20) AS q WHERE q.order_id=o
      AND q.financial_state='paid' AND q.dispatch_eligible
      AND jsonb_array_length(q.items)=2;
  IF n<>1 THEN RAISE EXCEPTION 'qa_merchant_missing_finance_proof_or_items'; END IF;
  SELECT count(*) INTO n FROM public.da_qa_merchant_visible_paid_orders(
    'other-restaurant',20) WHERE order_id=o;
  IF n<>0 THEN RAISE EXCEPTION 'qa_merchant_foreign_slug_read'; END IF;
  RAISE NOTICE 'QA_007_MERCHANT_UNPAID_HIDDEN_VERIFIED_CAPTURE_VISIBLE=PASS';
END $$;

SET LOCAL ROLE da_qa_merchant_commerce_app;
DO $$
DECLARE
  oid uuid:=current_setting('da.qa.fulfillment.order')::uuid;
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.da_qa_merchant_visible_paid_orders(
    'qa-restaurant',20) WHERE order_id=oid;
  IF n<>1 THEN RAISE EXCEPTION 'qa_merchant_role_inbox_missing'; END IF;
  IF public.da_qa_merchant_transition(oid,'qa-restaurant','accepted')<>'accepted'
    THEN RAISE EXCEPTION 'qa_merchant_accept_failed'; END IF;
  IF public.da_qa_merchant_transition(oid,'qa-restaurant','accepted')<>'accepted'
    THEN RAISE EXCEPTION 'qa_merchant_accept_replay_failed'; END IF;
  BEGIN
    PERFORM public.da_qa_merchant_transition(oid,'other-restaurant','ready');
    RAISE EXCEPTION 'qa_foreign_merchant_ready_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_merchant_not_owned_or_financial_hold' THEN RAISE; END IF;
  END;
  IF public.da_qa_merchant_transition(oid,'qa-restaurant','ready')<>'ready'
    THEN RAISE EXCEPTION 'qa_merchant_ready_failed'; END IF;
  IF public.da_qa_merchant_transition(oid,'qa-restaurant','ready')<>'ready'
    THEN RAISE EXCEPTION 'qa_merchant_ready_replay_failed'; END IF;
  BEGIN
    PERFORM public.da_qa_merchant_transition(oid,'qa-restaurant','accepted');
    RAISE EXCEPTION 'qa_merchant_regression_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_merchant_transition_regression_forbidden' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM 1 FROM public.da_qa_fulfillment_state LIMIT 1;
    RAISE EXCEPTION 'qa_merchant_direct_table_leak';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.da_qa_dispatch_assign_offer(
      oid,'https://qa.example.invalid/realms/da-courier',
      'c63f867f-9f42-4573-9268-dc65a164d2c3'::uuid);
    RAISE EXCEPTION 'qa_merchant_self_dispatch_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'QA_007_MERCHANT_OWNED_ACCEPT_READY_REPLAY_AND_ROLE_ACL=PASS';
END $$;
RESET ROLE;

SET LOCAL ROLE da_qa_dispatch_commerce_app;
DO $$
DECLARE oid uuid:=current_setting('da.qa.fulfillment.order')::uuid;
BEGIN
  IF public.da_qa_dispatch_assign_offer(
    oid,'https://qa.example.invalid/realms/da-courier',
    'c63f867f-9f42-4573-9268-dc65a164d2c3'::uuid)<>'offered' THEN
    RAISE EXCEPTION 'qa_dispatch_offer_failed';
  END IF;
  BEGIN
    PERFORM public.da_qa_dispatch_assign_offer(
      oid,'https://qa.example.invalid/realms/da-courier',
      'd63f867f-9f42-4573-9268-dc65a164d2c4'::uuid);
    RAISE EXCEPTION 'qa_dispatch_assignee_changed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_dispatch_assignee_immutable' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'QA_007_DISPATCH_SERVICE_ONLY_OFFER_ASSIGNEE_IMMUTABLE=PASS';
END $$;
RESET ROLE;

SET LOCAL ROLE da_qa_courier_commerce_app;
DO $$
DECLARE
  oid uuid:=current_setting('da.qa.fulfillment.order')::uuid;
  issuer text:='https://qa.example.invalid/realms/da-courier';
  courier uuid:='c63f867f-9f42-4573-9268-dc65a164d2c3';
  stranger uuid:='d63f867f-9f42-4573-9268-dc65a164d2c4';
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.da_qa_courier_assigned_offers(
    issuer,courier,20) WHERE order_id=oid AND action_eligible;
  IF n<>1 THEN RAISE EXCEPTION 'qa_courier_missing_owned_offer'; END IF;
  SELECT count(*) INTO n FROM public.da_qa_courier_assigned_offers(
    issuer,stranger,20) WHERE order_id=oid;
  IF n<>0 THEN RAISE EXCEPTION 'qa_courier_cross_subject_offer_leak'; END IF;
  BEGIN
    PERFORM public.da_qa_courier_transition(oid,issuer,stranger,'accepted');
    RAISE EXCEPTION 'qa_courier_stranger_accept_allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_courier_not_assigned_or_financial_hold' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.da_qa_courier_transition(oid,issuer,courier,'delivered');
    RAISE EXCEPTION 'qa_courier_skipped_pickup';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_courier_transition_out_of_sequence' THEN RAISE; END IF;
  END;
  IF public.da_qa_courier_transition(oid,issuer,courier,'accepted')<>'accepted'
    THEN RAISE EXCEPTION 'qa_courier_accept_failed'; END IF;
  IF public.da_qa_courier_transition(oid,issuer,courier,'accepted')<>'accepted'
    THEN RAISE EXCEPTION 'qa_courier_replay_failed'; END IF;
  BEGIN
    PERFORM 1 FROM public.da_qa_courier_offer LIMIT 1;
    RAISE EXCEPTION 'qa_courier_direct_assignment_table_read_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.da_qa_merchant_transition(oid,'qa-restaurant','ready');
    RAISE EXCEPTION 'qa_courier_merchant_transition_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'QA_007_COURIER_ASSIGNED_ONLY_ACCEPT_ORDERED_TRANSITIONS=PASS';
END $$;
RESET ROLE;

DO $$
DECLARE auth uuid:=current_setting('da.qa.fulfillment.authority')::uuid;
BEGIN
  PERFORM public.da_qa_finance_record_hold(
    auth,'re_QA007REFUND001','refund');
END $$;

SET LOCAL ROLE da_qa_courier_commerce_app;
DO $$
DECLARE
  oid uuid:=current_setting('da.qa.fulfillment.order')::uuid;
  issuer text:='https://qa.example.invalid/realms/da-courier';
  courier uuid:='c63f867f-9f42-4573-9268-dc65a164d2c3';
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.da_qa_courier_assigned_offers(
    issuer,courier,20) WHERE order_id=oid
      AND financial_state='financial_hold' AND NOT action_eligible;
  IF n<>1 THEN RAISE EXCEPTION 'qa_courier_refund_not_visible_as_hold'; END IF;
  BEGIN
    PERFORM public.da_qa_courier_transition(oid,issuer,courier,'picked_up');
    RAISE EXCEPTION 'qa_courier_pickup_allowed_after_refund';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'qa_courier_not_assigned_or_financial_hold' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'QA_007_COURIER_LATE_REFUND_FREEZES_PICKUP=PASS';
END $$;
RESET ROLE;
ROLLBACK;
