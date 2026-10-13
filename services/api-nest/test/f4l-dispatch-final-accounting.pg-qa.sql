-- F4L after-stage verification. Real PG17, synthetic facts only.
DO $qa$
DECLARE n integer; postings bigint; total bigint; out_count integer;
BEGIN
 SELECT count(*),coalesce(sum(signed_minor),0) INTO postings,total
 FROM public.da_qa_wallet_posting;
 IF postings<>64 OR total<>0 THEN
  RAISE EXCEPTION 'qa_f4l_ledger_imbalance_%_%',postings,total;
 END IF;
 SELECT count(*) INTO n FROM public.da_qa_wallet_allocation;
 IF n<>16 THEN RAISE EXCEPTION 'qa_f4l_allocation_count_%',n; END IF;
 SELECT count(*) INTO out_count FROM public.da_qa_dispatch_receipt_016;
 IF out_count<>5 THEN RAISE EXCEPTION 'qa_f4l_receipt_count_%',out_count; END IF;
 SELECT count(*) INTO n FROM public.da_qa_courier_offer
 WHERE state='offered' AND order_id IN(
  SELECT order_id FROM public.da_qa_dispatch_receipt_016);
 IF n<>4 THEN RAISE EXCEPTION 'qa_f4l_offer_state_count_%',n; END IF;
 IF EXISTS(
  SELECT 1 FROM pg_roles WHERE rolname='da_qa_dispatch_owner_016'
   AND (rolcanlogin OR rolsuper OR rolcreaterole)
 ) THEN RAISE EXCEPTION 'qa_f4l_definer_privileged'; END IF;
 IF has_function_privilege('da_qa_dispatch_commerce_app',
  'public.da_qa_dispatch_assign_offer(uuid,text,uuid)','EXECUTE')
 OR has_function_privilege('da_qa_merchant_commerce_app',
  'public.da_qa_dispatch_assign_attested_016(uuid)','EXECUTE')
 OR has_function_privilege('da_qa_courier_commerce_app',
  'public.da_qa_dispatch_assign_attested_016(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'qa_f4l_legacy_or_new_app_dispatch_grant'; END IF;
 BEGIN
  UPDATE public.da_qa_dispatch_receipt_016 SET operation='assigned';
  RAISE EXCEPTION 'qa_f4l_receipt_mutable';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'qa_wallet_immutable_audit' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'QA_F4L_LEDGER_ZERO_SUM_64_POSTINGS=PASS';
 RAISE NOTICE 'QA_F4L_MACHINE_ASSIGNMENT_RECEIPTS_IMMUTABLE_5=PASS';
 RAISE NOTICE 'QA_F4L_NO_LEGACY_SQL_007_APP_GRANTS=PASS';
END $qa$;
