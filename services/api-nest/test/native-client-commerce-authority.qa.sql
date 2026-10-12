-- Transactional Client commerce QA matrix. Run only in Docker PostgreSQL
-- with no network and no host ports. No Stripe API is contacted.
\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  one public.da_client_commerce_orders_qa%ROWTYPE;
  repeated public.da_client_commerce_orders_qa%ROWTYPE;
  two public.da_client_commerce_orders_qa%ROWTYPE;
  issuer text := 'https://qa.example.invalid/realms/da-client';
  subject_a uuid := 'a63f867f-9f42-4573-9268-dc65a164d2c1';
  subject_b uuid := 'b63f867f-9f42-4573-9268-dc65a164d2c2';
BEGIN
  SELECT * INTO one FROM public.da_qa_reserve_client_order(
    issuer,subject_a,'mutation-qa-00001',repeat('a',64)::char(64),
    repeat('b',64)::char(64),'qa-merchant',1200::bigint,'EUR'::char(3));
  IF one.order_id IS NULL OR one.state<>'pending_payment' THEN
    RAISE EXCEPTION 'qa_reservation_missing';
  END IF;
  SELECT * INTO repeated FROM public.da_qa_reserve_client_order(
    issuer,subject_a,'mutation-qa-00001',repeat('a',64)::char(64),
    repeat('b',64)::char(64),'qa-merchant',1200::bigint,'EUR'::char(3));
  IF repeated.order_id<>one.order_id THEN
    RAISE EXCEPTION 'qa_identical_mutation_creates_second_order';
  END IF;
  RAISE NOTICE 'QA_PASS=exact_mutation_retry_same_order_id';

  BEGIN
    PERFORM public.da_qa_reserve_client_order(
      issuer,subject_a,'mutation-qa-00001',repeat('f',64)::char(64),
      repeat('b',64)::char(64),'qa-merchant',1200::bigint,'EUR'::char(3));
    RAISE EXCEPTION 'qa_mutation_payload_mismatch_was_accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_idempotency_payload_mismatch' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=mutated_quote_replay_denied';
  END;
  BEGIN
    PERFORM public.da_qa_reserve_client_order(
      issuer,subject_a,'mutation-qa-00001',repeat('a',64)::char(64),
      repeat('b',64)::char(64),'qa-merchant',1300::bigint,'EUR'::char(3));
    RAISE EXCEPTION 'qa_mutated_price_replay_accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_idempotency_payload_mismatch' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=mutated_amount_replay_denied';
  END;

  SELECT * INTO two FROM public.da_qa_reserve_client_order(
    issuer,subject_b,'mutation-qa-00001',repeat('a',64)::char(64),
    repeat('b',64)::char(64),'qa-merchant',1200::bigint,'EUR'::char(3));
  IF two.order_id=one.order_id THEN
    RAISE EXCEPTION 'qa_cross_subject_order_collision';
  END IF;
  RAISE NOTICE 'QA_PASS=issuer_subject_scoped_idempotency';

  BEGIN
    INSERT INTO public.da_client_commerce_orders_qa(
      issuer,client_subject,client_mutation_id,quote_fingerprint,
      cart_fingerprint,merchant_slug,total_minor,currency,state
    ) VALUES (
      issuer,subject_a,'mutation-qa-invalid-insert',
      repeat('a',64),repeat('b',64),'qa-merchant',1200,'EUR','paid');
    RAISE EXCEPTION 'qa_direct_paid_insert_accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_order_must_start_pending_payment' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=paid_order_cannot_be_inserted_directly';
  END;

  INSERT INTO public.da_client_commerce_payment_authority_qa (
    order_id,issuer,client_subject,quote_fingerprint,total_minor,currency,
    stripe_idempotency_key
  ) VALUES (
    one.order_id,issuer,subject_a,repeat('a',64),1200,'EUR',
    'stripe-idem-qa-0001');

  BEGIN
    INSERT INTO public.da_client_commerce_payment_authority_qa (
      order_id,issuer,client_subject,quote_fingerprint,total_minor,currency,
      stripe_idempotency_key
    ) VALUES (
      two.order_id,issuer,subject_b,repeat('a',64),1300,'EUR',
      'stripe-idem-qa-wrong-price');
    RAISE EXCEPTION 'qa_payment_wrong_order_amount_was_accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'QA_PASS=payment_foreign_key_binds_exact_order_amount';
  END;

  BEGIN
    UPDATE public.da_client_commerce_orders_qa SET state='paid'
      WHERE order_id=one.order_id;
    RAISE EXCEPTION 'qa_paid_without_stripe_proof_accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_order_paid_without_verified_stripe_authority' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=order_cannot_be_paid_without_verified_provider';
  END;

  BEGIN
    UPDATE public.da_client_commerce_payment_authority_qa
      SET state='succeeded',stripe_payment_intent_id='pi_test_qa_intent0001',
      provider_verified=true,provider_success_event_hmac=repeat('d',64),
      provider_verified_at=statement_timestamp()
      WHERE order_id=one.order_id;
    RAISE EXCEPTION 'qa_direct_payment_success_skipped_intent_creation';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_payment_transition_forbidden' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=stripe_result_requires_intent_created_first';
  END;

  UPDATE public.da_client_commerce_payment_authority_qa
    SET state='intent_created',stripe_payment_intent_id='pi_test_qa_intent0001'
    WHERE order_id=one.order_id;
  UPDATE public.da_client_commerce_payment_authority_qa
    SET state='succeeded',
      provider_verified=true,provider_success_event_hmac=repeat('d',64),
      provider_verified_at=statement_timestamp()
    WHERE order_id=one.order_id;
  UPDATE public.da_client_commerce_orders_qa SET state='paid'
    WHERE order_id=one.order_id;
  IF (SELECT state FROM public.da_client_commerce_orders_qa
      WHERE order_id=one.order_id) <> 'paid' THEN
    RAISE EXCEPTION 'qa_paid_order_not_committed';
  END IF;
  RAISE NOTICE 'QA_PASS=test_only_provider_success_allows_order_paid';

  BEGIN
    UPDATE public.da_client_commerce_orders_qa SET total_minor=10
      WHERE order_id=one.order_id;
    RAISE EXCEPTION 'qa_paid_amount_mutated';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_order_financial_binding_immutable' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=paid_order_amount_immutable';
  END;
  BEGIN
    UPDATE public.da_client_commerce_orders_qa SET state='pending_payment'
      WHERE order_id=one.order_id;
    RAISE EXCEPTION 'qa_paid_order_reverted';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_paid_order_monotonic' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=paid_order_state_monotonic';
  END;
  BEGIN
    UPDATE public.da_client_commerce_payment_authority_qa
      SET stripe_payment_intent_id='pi_test_qa_intent0002'
      WHERE order_id=one.order_id;
    RAISE EXCEPTION 'qa_payment_intent_swapped';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'qa_payment_intent_immutable' THEN RAISE; END IF;
    RAISE NOTICE 'QA_PASS=stripe_intent_immutable_after_creation';
  END;

  BEGIN
    INSERT INTO public.da_client_commerce_payment_authority_qa(
      order_id,issuer,client_subject,quote_fingerprint,total_minor,currency,
      stripe_idempotency_key
    ) VALUES (
      two.order_id,issuer,subject_b,repeat('a',64),1200,'EUR',
      'stripe-idem-qa-0001');
    RAISE EXCEPTION 'qa_stripe_idempotency_key_reused';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'QA_PASS=stripe_test_idempotency_key_unique';
  END;

  INSERT INTO public.da_client_commerce_payment_authority_qa(
    order_id,issuer,client_subject,quote_fingerprint,total_minor,currency,
    stripe_idempotency_key
  ) VALUES (
    two.order_id,issuer,subject_b,repeat('a',64),1200,'EUR',
    'stripe-idem-qa-0002');
  BEGIN
    UPDATE public.da_client_commerce_payment_authority_qa
      SET state='intent_created',
      stripe_payment_intent_id='pi_test_qa_intent0001'
      WHERE order_id=two.order_id;
    RAISE EXCEPTION 'qa_stripe_intent_reused';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'QA_PASS=stripe_payment_intent_unique_across_clients';
  END;
  UPDATE public.da_client_commerce_payment_authority_qa
    SET state='intent_created',
      stripe_payment_intent_id='pi_test_qa_intent0002'
    WHERE order_id=two.order_id;
  BEGIN
    UPDATE public.da_client_commerce_payment_authority_qa
      SET state='succeeded',provider_verified=true,
      provider_success_event_hmac=repeat('d',64),
      provider_verified_at=statement_timestamp()
      WHERE order_id=two.order_id;
    RAISE EXCEPTION 'qa_provider_event_replayed_across_clients';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'QA_PASS=provider_event_receipt_not_replayable_across_orders';
  END;
  RAISE NOTICE 'QA_CLIENT_COMMERCE_PG=PASS_TRANSACTIONAL_BINDINGS_SYNTHETIC';
END;
$$;
ROLLBACK;
