-- DelishAfrica SQL-only receipt/read and least-privilege QA matrix.
-- MUST run only after migrations 001-005 on network-none PostgreSQL17.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  issuer text := 'https://qa.example.invalid/realms/da-client';
  buyer uuid := 'a63f867f-9f42-4573-9268-dc65a164d2c1';
  stranger uuid := 'b63f867f-9f42-4573-9268-dc65a164d2c2';
  order_uuid uuid;
  authority_uuid uuid;
  s record;
  n integer;
BEGIN
  SELECT order_id INTO order_uuid FROM public.da_qa_reserve_client_order(
    issuer,buyer,'mutation-owned-receipt-0001',
    repeat('a',64)::char(64),repeat('b',64)::char(64),
    'qa-restaurant',2690,'EUR'::char(3));
  SELECT * INTO s FROM public.da_qa_client_read_owned_order(order_uuid,issuer,buyer);
  IF NOT FOUND OR s.financial_status<>'awaiting_payment'
      OR s.dispatch_eligible IS DISTINCT FROM false
      OR s.payment_intent_id IS NOT NULL
      OR s.client_mutation_id<>'mutation-owned-receipt-0001' THEN
    RAISE EXCEPTION 'qa_receipt_pending_inconsistent';
  END IF;
  RAISE NOTICE 'QA_OWNED_RECEIPT_PENDING=NOT_PAID';
  SELECT COUNT(*) INTO n FROM public.da_qa_client_read_owned_order(
    order_uuid,issuer,stranger);
  IF n<>0 THEN RAISE EXCEPTION 'qa_receipt_cross_client_leak'; END IF;
  SELECT COUNT(*) INTO n FROM public.da_qa_client_read_owned_order(
    order_uuid,'https://qa.other.invalid/realms/da-client',buyer);
  IF n<>0 THEN RAISE EXCEPTION 'qa_receipt_cross_issuer_leak'; END IF;
  RAISE NOTICE 'QA_OWNED_RECEIPT_FOREIGN_PRINCIPAL=DENIED';

  SELECT authority_id INTO authority_uuid
    FROM public.da_qa_service_reserve_test_payment(
      order_uuid,issuer,buyer,'da-qa-test-v1-'||repeat('e',64));
  UPDATE public.da_client_commerce_payment_authority_qa
    SET state='intent_created',stripe_payment_intent_id='pi_QAOWNEDRECPT001'
    WHERE authority_id=authority_uuid;
  SELECT * INTO s FROM public.da_qa_client_read_owned_order(order_uuid,issuer,buyer);
  IF s.financial_status<>'awaiting_payment'
      OR s.dispatch_eligible IS DISTINCT FROM false
      OR s.payment_intent_id<>'pi_QAOWNEDRECPT001' THEN
    RAISE EXCEPTION 'qa_receipt_intent_created_marked_paid';
  END IF;
  RAISE NOTICE 'QA_OWNED_RECEIPT_INTENT_CREATED=NOT_PAID';

  -- The independently tested finance adapter normally supplies this proof;
  -- this SQL-only test calls the exact transaction port with synthetic values.
  PERFORM public.da_qa_finance_commit_captured_test(
    authority_uuid,'pi_QAOWNEDRECPT001','ch_QAOWNEDRECEIPT001',
    'acct_QAOWNED001',2690,'EUR'::char(3),
    repeat('d',64)::char(64),NULL);
  SELECT * INTO s FROM public.da_qa_client_read_owned_order(order_uuid,issuer,buyer);
  IF s.financial_status<>'paid'
      OR s.dispatch_eligible IS DISTINCT FROM true
      OR s.payment_intent_id<>'pi_QAOWNEDRECPT001'
      OR s.total_minor<>2690 THEN
    RAISE EXCEPTION 'qa_receipt_finance_capture_not_paid';
  END IF;
  RAISE NOTICE 'QA_OWNED_RECEIPT_VERIFIED_CAPTURE=PAID';

  PERFORM public.da_qa_finance_record_hold(
    authority_uuid,'re_QAOWNEDREFUND001','refund');
  SELECT * INTO s FROM public.da_qa_client_read_owned_order(order_uuid,issuer,buyer);
  IF s.financial_status<>'financial_hold'
      OR s.dispatch_eligible IS DISTINCT FROM false
      OR s.payment_intent_id<>'pi_QAOWNEDRECPT001' THEN
    RAISE EXCEPTION 'qa_receipt_refund_hold_not_enforced';
  END IF;
  RAISE NOTICE 'QA_OWNED_RECEIPT_REFUND_HOLD=NO_DISPATCH';
  SELECT COUNT(*) INTO n FROM public.da_qa_client_read_owned_order(
    order_uuid,issuer,stranger);
  IF n<>0 THEN RAISE EXCEPTION 'qa_paid_receipt_cross_client_leak'; END IF;
  RAISE NOTICE 'QA_OWNED_RECEIPT_PAID_FOREIGN_PRINCIPAL=DENIED';
END $$;

SET LOCAL ROLE da_qa_client_commerce_app;
DO $$
DECLARE n integer;
BEGIN
  SELECT COUNT(*) INTO n
    FROM public.da_qa_client_read_owned_order(
      'a63f867f-9f42-4573-9268-dc65a164d2c1'::uuid,
      'https://qa.example.invalid/realms/da-client',
      'a63f867f-9f42-4573-9268-dc65a164d2c1'::uuid);
  IF n<>0 THEN RAISE EXCEPTION 'qa_unknown_order_exposed'; END IF;
  RAISE NOTICE 'QA_APP_ROLE_OWNED_FUNCTION=EXECUTE_ONLY';
  BEGIN
    PERFORM 1 FROM public.da_client_commerce_orders_qa LIMIT 1;
    RAISE EXCEPTION 'qa_app_direct_select_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'QA_APP_ROLE_DIRECT_TABLE_SELECT=DENIED';
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE da_qa_webhook_inbox_receiver;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.da_qa_client_read_owned_order(
      'a63f867f-9f42-4573-9268-dc65a164d2c1'::uuid,
      'https://qa.example.invalid/realms/da-client',
      'a63f867f-9f42-4573-9268-dc65a164d2c1'::uuid);
    RAISE EXCEPTION 'qa_webhook_read_client_status_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'QA_WEBHOOK_ROLE_CLIENT_RECEIPT_READ=DENIED';
  END;
END $$;
RESET ROLE;
ROLLBACK;
