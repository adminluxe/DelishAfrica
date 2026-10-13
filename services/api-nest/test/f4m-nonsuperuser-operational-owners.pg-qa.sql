-- F4M real PG17 QA: verify 004 financial eligibility + five 007
-- operational SECURITY DEFINER functions are independently least-privileged.
-- This SQL runs in the disposable CI cluster and cannot be shipped to VPS.
DO $f4m$
DECLARE
  item record;
  n integer:=0;
  public_users text[]:=ARRAY['da_qa_merchant_commerce_app',
    'da_qa_courier_commerce_app','da_qa_dispatch_commerce_app'];
  actor text;
BEGIN
  FOR item IN
    SELECT p.oid::regprocedure::text AS signature,p.prosecdef,
           r.rolname AS owner,r.rolcanlogin,r.rolsuper,r.rolcreaterole,
           r.rolcreatedb,r.rolbypassrls,r.rolinherit,
           replace(array_to_string(p.proconfig,','),' ','') AS configuration
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
    WHERE p.oid IN(
      'public.da_qa_commerce_order_dispatch_eligible(uuid)'::regprocedure,
      'public.da_qa_merchant_visible_paid_orders(varchar,integer)'::regprocedure,
      'public.da_qa_courier_assigned_offers(text,uuid,integer)'::regprocedure,
      'public.da_qa_merchant_transition(uuid,varchar,text)'::regprocedure,
      'public.da_qa_dispatch_assign_offer(uuid,text,uuid)'::regprocedure,
      'public.da_qa_courier_transition(uuid,text,uuid,text)'::regprocedure
    )
  LOOP
    n:=n+1;
    IF NOT item.prosecdef OR item.rolcanlogin OR item.rolsuper OR
       item.rolcreaterole OR item.rolcreatedb OR item.rolbypassrls OR
       item.rolinherit OR
       item.configuration NOT LIKE '%search_path=pg_catalog,public,pg_temp%'
    THEN RAISE EXCEPTION 'qa_f4m_insecure_definer_%',item.signature; END IF;
    IF (item.signature LIKE '%dispatch_eligible%' AND
         item.owner<>'da_qa_f4m_finance_gate_owner_017') OR
       (item.signature LIKE '%visible_paid_orders%' OR
        item.signature LIKE '%courier_assigned_offers%') AND
         item.owner<>'da_qa_f4m_ops_reader_owner_017' OR
       (item.signature LIKE '%merchant_transition%' OR
        item.signature LIKE '%courier_transition%' OR
        item.signature LIKE '%dispatch_assign_offer%') AND
         item.owner<>'da_qa_f4m_ops_writer_owner_017'
    THEN RAISE EXCEPTION 'qa_f4m_wrong_owner_%',item.signature; END IF;
  END LOOP;
  IF n<>6 THEN RAISE EXCEPTION 'qa_f4m_definer_coverage_%',n; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members am
    JOIN pg_catalog.pg_roles r ON r.oid=am.roleid
    WHERE r.rolname IN(
      'da_qa_f4m_finance_gate_owner_017',
      'da_qa_f4m_ops_reader_owner_017',
      'da_qa_f4m_ops_writer_owner_017'
    )
  ) THEN RAISE EXCEPTION 'qa_f4m_privileged_role_membership'; END IF;

  FOREACH actor IN ARRAY public_users LOOP
    IF has_function_privilege(actor,
       'public.da_qa_merchant_transition(uuid,varchar,text)','EXECUTE')
       OR has_function_privilege(actor,
       'public.da_qa_courier_transition(uuid,text,uuid,text)','EXECUTE')
       OR has_function_privilege(actor,
       'public.da_qa_dispatch_assign_offer(uuid,text,uuid)','EXECUTE')
    THEN RAISE EXCEPTION 'qa_f4m_legacy_007_app_bypass_%',actor; END IF;
  END LOOP;

  IF NOT has_function_privilege('da_qa_fulfillment_writer_015',
       'public.da_qa_merchant_transition(uuid,varchar,text)','EXECUTE')
     OR NOT has_function_privilege('da_qa_fulfillment_writer_015',
       'public.da_qa_courier_transition(uuid,text,uuid,text)','EXECUTE')
     OR has_function_privilege('da_qa_fulfillment_writer_015',
       'public.da_qa_dispatch_assign_offer(uuid,text,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'qa_f4m_f4k_attested_ports_invalid'; END IF;

  -- QA superuser is permitted only for disposable fixture initialization.
  -- Each 017 definer has no right to mint finance, change identity,
  -- alter pricing, write ledger, or update captured order status.
  IF has_table_privilege('da_qa_f4m_finance_gate_owner_017',
       'public.da_stripe_test_financial_receipts_qa','INSERT')
     OR has_table_privilege('da_qa_f4m_finance_gate_owner_017',
       'public.da_stripe_test_financial_holds_qa','UPDATE')
     OR has_table_privilege('da_qa_f4m_ops_reader_owner_017',
       'public.da_qa_courier_offer','UPDATE')
     OR has_table_privilege('da_qa_f4m_ops_writer_owner_017',
       'public.da_stripe_test_financial_receipts_qa','SELECT')
     OR has_table_privilege('da_qa_f4m_ops_writer_owner_017',
       'public.da_qa_wallet_posting','INSERT')
     OR has_column_privilege('da_qa_f4m_ops_writer_owner_017',
       'public.da_client_commerce_orders_qa','state','UPDATE')
  THEN RAISE EXCEPTION 'qa_f4m_cross_domain_acl_escalation'; END IF;

  IF to_regrole('da_qa_dispatch_owner_016') IS NOT NULL AND
     NOT has_function_privilege('da_qa_dispatch_owner_016',
       'public.da_qa_dispatch_assign_offer(uuid,text,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'qa_f4m_f4l_dispatch_machine_port_lost'; END IF;

  RAISE NOTICE 'QA_F4M_SIX_SECURITY_DEFINERS_NOLOGIN_NOSUPERUSER=PASS';
  RAISE NOTICE 'QA_F4M_READ_WRITE_FINANCE_ROLES_NO_MEMBERSHIP=PASS';
  RAISE NOTICE 'QA_F4M_SQL_007_APP_BYPASS_AND_CROSS_DOMAIN_DML=DENIED';
  RAISE NOTICE 'QA_F4M_F4K_AND_F4L_WRAPPER_GRANTS_PRESERVED=PASS';
END $f4m$;
