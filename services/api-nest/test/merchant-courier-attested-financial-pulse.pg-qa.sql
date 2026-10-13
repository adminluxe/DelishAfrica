-- F4K DISCONNECTED QA-only assertion helper, not a schema migration.
-- Installs a test-only assert procedure in disposable PostgreSQL 17.
-- It is never registered in the production AppModule or deployed to VPS.
CREATE OR REPLACE FUNCTION public.da_qa_f4k_assert_pulse(p_stage text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $q$
DECLARE
  m jsonb;
  c jsonb;
  courier_sub uuid;
  expected_m_pending bigint;
  expected_m_available bigint;
  expected_m_held bigint;
  expected_c_accrued bigint;
  expected_c_pending bigint;
  expected_c_available bigint;
  expected_c_held bigint;
  receipt_total bigint;
  posting_sum bigint;
  posting_lines bigint;
  captures bigint;
  platform_fee bigint;
BEGIN
  IF p_stage NOT IN (
    'captured','merchant_ready','offered',
    'courier_progress','refund_held','revoked'
  ) THEN RAISE EXCEPTION 'qa_f4k_unknown_pulse_stage'; END IF;
  SELECT subject::uuid INTO STRICT courier_sub
    FROM public.da_qa_finance_courier_roster_012
    WHERE organization_id='a43f867f-9f42-4573-9268-dc65a164d2c2'::uuid;
  SELECT to_jsonb(s) INTO STRICT m
    FROM public.da_qa_wallet_merchant_summary('qa-restaurant') s;
  SELECT to_jsonb(s) INTO STRICT c
    FROM public.da_qa_wallet_courier_summary(
      'https://127.0.0.1/realms/da-wallet-partners-qa',
      courier_sub) s;
  IF m->>'currency'<>'EUR' OR c->>'currency'<>'EUR' OR
     (m->>'withdrawable_minor')::bigint<>0 OR
     (c->>'withdrawable_minor')::bigint<>0 OR
     (m->>'payout_enabled')::boolean IS DISTINCT FROM false OR
     (c->>'payout_enabled')::boolean IS DISTINCT FROM false OR
     (m->>'accrued_minor')::bigint<>5520
  THEN RAISE EXCEPTION 'qa_f4k_financial_pulse_identity_or_payout'; END IF;

  IF p_stage='captured' THEN
    expected_m_pending:=3680;expected_m_available:=0;
    expected_m_held:=1840;expected_c_accrued:=0;
    expected_c_pending:=0;expected_c_available:=0;expected_c_held:=0;
  ELSIF p_stage='merchant_ready' THEN
    expected_m_pending:=0;expected_m_available:=3680;
    expected_m_held:=1840;expected_c_accrued:=0;
    expected_c_pending:=0;expected_c_available:=0;expected_c_held:=0;
  ELSIF p_stage='offered' THEN
    expected_m_pending:=0;expected_m_available:=3680;
    expected_m_held:=1840;expected_c_accrued:=780;
    expected_c_pending:=780;expected_c_available:=0;expected_c_held:=0;
  ELSIF p_stage='courier_progress' THEN
    expected_m_pending:=0;expected_m_available:=3680;
    expected_m_held:=1840;expected_c_accrued:=780;
    expected_c_pending:=390;expected_c_available:=390;expected_c_held:=0;
  ELSE
    expected_m_pending:=0;expected_m_available:=1840;
    expected_m_held:=3680;expected_c_accrued:=780;
    expected_c_pending:=0;expected_c_available:=390;expected_c_held:=390;
  END IF;
  IF (m->>'pending_minor')::bigint<>expected_m_pending OR
     (m->>'available_minor')::bigint<>expected_m_available OR
     (m->>'held_minor')::bigint<>expected_m_held OR
     (c->>'accrued_minor')::bigint<>expected_c_accrued OR
     (c->>'pending_minor')::bigint<>expected_c_pending OR
     (c->>'available_minor')::bigint<>expected_c_available OR
     (c->>'held_minor')::bigint<>expected_c_held
  THEN
    RAISE EXCEPTION 'qa_f4k_financial_pulse_stage_mismatch_%',p_stage;
  END IF;

  SELECT count(*),coalesce(sum(signed_minor),0)
    INTO posting_lines,posting_sum
    FROM public.da_qa_wallet_posting;
  SELECT count(*),coalesce(sum(platform_retained_minor),0)
    INTO captures,platform_fee
    FROM public.da_qa_wallet_allocation;
  IF posting_lines<>12 OR posting_sum<>0 OR captures<>3 OR
     platform_fee<>1380 OR
     (SELECT merchant_fee_bps FROM public.da_qa_wallet_policy
       WHERE policy_id='QA_FIXTURE_EUR_V1')<>2000 OR
     (SELECT count(*) FROM public.da_qa_wallet_allocation
       WHERE merchant_earned_minor=1840 AND merchant_fee_minor=460 AND
             courier_reserved_minor=390 AND captured_minor=2690)<>3
  THEN
    RAISE EXCEPTION 'qa_f4k_posting_balance_or_synthetic_commission_mismatch';
  END IF;

  IF p_stage IN ('refund_held','revoked') THEN
    SELECT count(*) INTO receipt_total
      FROM public.da_qa_fulfillment_receipt_015;
    IF receipt_total<>8 THEN
      RAISE EXCEPTION 'qa_f4k_immutable_operational_receipts_mismatch';
    END IF;
    BEGIN
      UPDATE public.da_qa_fulfillment_receipt_015
        SET committed_state='forged';
      RAISE EXCEPTION 'qa_f4k_receipt_mutation_was_allowed';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='qa_f4k_receipt_mutation_was_allowed' OR
         SQLERRM<>'qa_wallet_immutable_audit'
      THEN RAISE; END IF;
    END;
  END IF;
  RAISE NOTICE 'QA_F4K_FINANCE_PULSE_%=PASS',p_stage;
END
$q$;
REVOKE ALL ON FUNCTION public.da_qa_f4k_assert_pulse(text)
  FROM PUBLIC,da_qa_merchant_commerce_app,
    da_qa_courier_commerce_app,da_qa_dispatch_commerce_app;
