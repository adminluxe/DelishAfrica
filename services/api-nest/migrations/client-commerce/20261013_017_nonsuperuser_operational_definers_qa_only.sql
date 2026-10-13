-- DELISHAFRICA F4M / SQL 017 / DISPOSABLE PG17 QA ONLY.
-- Hardens legacy 004 financial gate and 007 Merchant/Dispatch/Courier
-- SECURITY DEFINER owners without changing business logic or restoring 007.
-- Apply ONLY to the isolated GitHub Actions F4M laboratory. NOT VPS.
BEGIN;
DO $f4m$
BEGIN
 IF current_setting('server_version_num')::integer < 170000 OR
    to_regrole('da_qa_fulfillment_writer_015') IS NULL OR
    to_regprocedure('public.da_qa_partner_transition_attested_015(uuid,text,uuid,text)') IS NULL OR
    to_regprocedure('public.da_qa_commerce_order_dispatch_eligible(uuid)') IS NULL OR
    to_regprocedure('public.da_qa_dispatch_assign_offer(uuid,text,uuid)') IS NULL
 THEN RAISE EXCEPTION 'qa_f4m_pg17_f4k_prerequisites_required'; END IF;
END $f4m$;

-- No login, superuser, inherited app identities, role-management privileges
-- or membership grants. Read, write and finance-definer functions are split.
CREATE ROLE da_qa_f4m_finance_gate_owner_017
 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE da_qa_f4m_ops_reader_owner_017
 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE da_qa_f4m_ops_writer_owner_017
 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO
 da_qa_f4m_finance_gate_owner_017,
 da_qa_f4m_ops_reader_owner_017,
 da_qa_f4m_ops_writer_owner_017;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Finance predicate is a READ-ONLY SECURITY DEFINER, never allowed
-- to mutate a payment, financial receipt, hold or wallet.
GRANT SELECT ON TABLE
 public.da_client_commerce_orders_qa,
 public.da_client_commerce_order_snapshot_qa,
 public.da_client_commerce_payment_authority_qa,
 public.da_stripe_test_financial_receipts_qa,
 public.da_stripe_test_financial_holds_qa
 TO da_qa_f4m_finance_gate_owner_017;
ALTER FUNCTION public.da_qa_commerce_order_dispatch_eligible(uuid)
 OWNER TO da_qa_f4m_finance_gate_owner_017;
ALTER FUNCTION public.da_qa_commerce_order_dispatch_eligible(uuid)
 SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON FUNCTION public.da_qa_commerce_order_dispatch_eligible(uuid)
 FROM PUBLIC,da_qa_merchant_commerce_app,da_qa_courier_commerce_app,
 da_qa_dispatch_commerce_app;
GRANT EXECUTE ON FUNCTION public.da_qa_commerce_order_dispatch_eligible(uuid)
 TO da_qa_f4m_ops_reader_owner_017,da_qa_f4m_ops_writer_owner_017;

-- Reader projection: never owns or receives UPDATE/INSERT/DELETE.
GRANT SELECT ON TABLE
 public.da_client_commerce_orders_qa,
 public.da_client_commerce_order_snapshot_qa,
 public.da_client_commerce_payment_authority_qa,
 public.da_stripe_test_financial_receipts_qa,
 public.da_stripe_test_financial_holds_qa,
 public.da_qa_fulfillment_state,
 public.da_qa_courier_offer
 TO da_qa_f4m_ops_reader_owner_017;
ALTER FUNCTION public.da_qa_merchant_visible_paid_orders(varchar,integer)
 OWNER TO da_qa_f4m_ops_reader_owner_017;
ALTER FUNCTION public.da_qa_courier_assigned_offers(text,uuid,integer)
 OWNER TO da_qa_f4m_ops_reader_owner_017;
ALTER FUNCTION public.da_qa_merchant_visible_paid_orders(varchar,integer)
 SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION public.da_qa_courier_assigned_offers(text,uuid,integer)
 SET search_path=pg_catalog,public,pg_temp;

-- Legacy 007 operational definer: only the exact two mutable QA tables.
-- Column-level UPDATE keys are needed by PostgreSQL SELECT FOR UPDATE.
-- NO privileges to change finance, identities, catalog, contracts or ledger.
GRANT SELECT ON TABLE
 public.da_client_commerce_orders_qa,
 public.da_qa_fulfillment_state,
 public.da_qa_courier_offer
 TO da_qa_f4m_ops_writer_owner_017;
GRANT UPDATE(order_id) ON TABLE public.da_client_commerce_orders_qa
 TO da_qa_f4m_ops_writer_owner_017;
GRANT INSERT(order_id,merchant_slug,state) ON TABLE public.da_qa_fulfillment_state
 TO da_qa_f4m_ops_writer_owner_017;
GRANT UPDATE(order_id,state,ready_at) ON TABLE public.da_qa_fulfillment_state
 TO da_qa_f4m_ops_writer_owner_017;
GRANT INSERT(order_id,courier_issuer,courier_subject,state)
 ON TABLE public.da_qa_courier_offer TO da_qa_f4m_ops_writer_owner_017;
GRANT UPDATE(order_id,state,accepted_at,picked_up_at,delivered_at)
 ON TABLE public.da_qa_courier_offer TO da_qa_f4m_ops_writer_owner_017;
GRANT EXECUTE ON FUNCTION public.da_qa_commerce_order_dispatch_eligible(uuid)
 TO da_qa_f4m_ops_writer_owner_017;

ALTER FUNCTION public.da_qa_merchant_transition(uuid,varchar,text)
 OWNER TO da_qa_f4m_ops_writer_owner_017;
ALTER FUNCTION public.da_qa_dispatch_assign_offer(uuid,text,uuid)
 OWNER TO da_qa_f4m_ops_writer_owner_017;
ALTER FUNCTION public.da_qa_courier_transition(uuid,text,uuid,text)
 OWNER TO da_qa_f4m_ops_writer_owner_017;
ALTER FUNCTION public.da_qa_merchant_transition(uuid,varchar,text)
 SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION public.da_qa_dispatch_assign_offer(uuid,text,uuid)
 SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION public.da_qa_courier_transition(uuid,text,uuid,text)
 SET search_path=pg_catalog,public,pg_temp;

-- Do not modify existing 015/016 grants to the NOLOGIN service owners.
-- Mobile SQL roles may invoke only their attested wrappers and permitted
-- read projections; never legacy transition/dispatch functions.
REVOKE EXECUTE ON FUNCTION
 public.da_qa_merchant_transition(uuid,varchar,text),
 public.da_qa_dispatch_assign_offer(uuid,text,uuid),
 public.da_qa_courier_transition(uuid,text,uuid,text)
 FROM PUBLIC,da_qa_merchant_commerce_app,da_qa_courier_commerce_app,
 da_qa_dispatch_commerce_app;
-- 016 owner has already received the original Dispatch function EXECUTE;
-- it remains restricted to this NOLOGIN role and to 015's NOLOGIN writer.
COMMENT ON ROLE da_qa_f4m_finance_gate_owner_017 IS
 'F4M QA ONLY. Non-login finance eligibility read predicate, no payment writes.';
COMMENT ON ROLE da_qa_f4m_ops_reader_owner_017 IS
 'F4M QA ONLY. Non-login Merchant/Courier operational read projections.';
COMMENT ON ROLE da_qa_f4m_ops_writer_owner_017 IS
 'F4M QA ONLY. Non-login 007 operational writes on exactly fulfillment and offer columns.';
COMMIT;
