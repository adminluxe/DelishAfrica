-- QA DISPOSABLE DATABASE ONLY. NEVER APPLY TO PRODUCTION.
-- Required guard: SET da.qa_isolated = 'YES' in the same migration transaction.
-- No sample business data is inserted. API uses a separate SELECT-only principal.
BEGIN;
DO $$
BEGIN
  IF current_setting('da.qa_isolated', true) IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION 'Refusing ATM QA migration outside explicitly isolated database';
  END IF;
END
$$;
CREATE TABLE IF NOT EXISTS public.da_atm_suppliers_qa (
  merchant_id text NOT NULL CHECK (length(merchant_id) BETWEEN 1 AND 120),
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 120),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  specialty text NOT NULL CHECK (length(specialty) BETWEEN 1 AND 120),
  lead_days integer NOT NULL CHECK (lead_days BETWEEN 0 AND 120),
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT da_atm_suppliers_qa_pk PRIMARY KEY (merchant_id,id)
);
CREATE TABLE IF NOT EXISTS public.da_atm_inventory_items_qa (
  merchant_id text NOT NULL CHECK (length(merchant_id) BETWEEN 1 AND 120),
  id text NOT NULL CHECK (length(id) BETWEEN 1 AND 120),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  quantity integer NOT NULL CHECK (quantity >= 0),
  minimum integer NOT NULL CHECK (minimum >= 0),
  unit text NOT NULL CHECK (unit IN ('kg','L','piece')),
  supplier_id text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT da_atm_inventory_qa_pk PRIMARY KEY (merchant_id,id),
  CONSTRAINT da_atm_inventory_supplier_same_merchant
    FOREIGN KEY (merchant_id,supplier_id)
    REFERENCES public.da_atm_suppliers_qa(merchant_id,id)
);
REVOKE ALL ON public.da_atm_inventory_items_qa FROM PUBLIC;
REVOKE ALL ON public.da_atm_suppliers_qa FROM PUBLIC;
-- An independent DBA must provision and verify a SELECT-only QA role.
-- No GRANT to production runtime user and no DML from mobile are allowed.
COMMIT;
