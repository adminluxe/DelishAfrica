-- DelishAfrica® Courier Fair Pay Lab
-- DRAFT ONLY — NOT APPLIED
-- PostgreSQL append-only persistence model.

BEGIN;

CREATE TABLE IF NOT EXISTS courier_payroll_policy_ledger (
  policy_id text PRIMARY KEY,
  policy_hash char(64) NOT NULL UNIQUE,
  country_code text NOT NULL,
  currency text NOT NULL,
  worker_status text NOT NULL,
  validation_status text NOT NULL,
  effective_from date,
  production_activation_allowed boolean NOT NULL DEFAULT false,
  policy_json jsonb NOT NULL,
  sealed_at timestamptz NOT NULL,
  sealed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (validation_status IN ('DRAFT', 'LEGAL_REVIEW', 'GREEN')),
  CHECK (worker_status IN ('EMPLOYEE', 'INDEPENDENT')),
  CHECK (
    production_activation_allowed = false
    OR (validation_status = 'GREEN' AND effective_from IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS courier_payroll_clock_events (
  event_id text PRIMARY KEY,
  event_hash char(64) NOT NULL,
  courier_id text NOT NULL,
  country_code text NOT NULL,
  week_key text NOT NULL,
  policy_id text NOT NULL REFERENCES courier_payroll_policy_ledger(policy_id),
  event_type text NOT NULL,
  source text NOT NULL,
  occurred_at timestamptz NOT NULL,
  order_id text,
  mission_id text,
  merchant_id text,
  segment_id text,
  event_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courier_payroll_facts (
  fact_id text PRIMARY KEY,
  fact_hash char(64) NOT NULL,
  courier_id text NOT NULL,
  country_code text NOT NULL,
  week_key text NOT NULL,
  policy_id text NOT NULL REFERENCES courier_payroll_policy_ledger(policy_id),
  kind text NOT NULL,
  category text NOT NULL,
  recorded_at timestamptz NOT NULL,
  order_id text,
  mission_id text,
  merchant_id text,
  fact_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind IN ('TIME', 'MONEY', 'DURATION'))
);

CREATE TABLE IF NOT EXISTS courier_payroll_statements (
  statement_id char(64) PRIMARY KEY,
  statement_version text NOT NULL,
  courier_id text NOT NULL,
  country_code text NOT NULL,
  week_key text NOT NULL,
  policy_id text NOT NULL REFERENCES courier_payroll_policy_ledger(policy_id),
  policy_hash char(64) NOT NULL,
  facts_hash char(64) NOT NULL,
  production_eligible boolean NOT NULL DEFAULT false,
  statement_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS courier_payroll_clock_week_idx
  ON courier_payroll_clock_events (courier_id, week_key, policy_id);

CREATE INDEX IF NOT EXISTS courier_payroll_facts_week_idx
  ON courier_payroll_facts (courier_id, week_key, policy_id);

CREATE INDEX IF NOT EXISTS courier_payroll_statement_week_idx
  ON courier_payroll_statements (courier_id, week_key, policy_id);

CREATE OR REPLACE FUNCTION courier_payroll_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'courier_payroll_append_only_violation';
END;
$$;

DROP TRIGGER IF EXISTS courier_payroll_policy_no_update
  ON courier_payroll_policy_ledger;
CREATE TRIGGER courier_payroll_policy_no_update
BEFORE UPDATE OR DELETE ON courier_payroll_policy_ledger
FOR EACH ROW EXECUTE FUNCTION courier_payroll_forbid_mutation();

DROP TRIGGER IF EXISTS courier_payroll_clock_no_update
  ON courier_payroll_clock_events;
CREATE TRIGGER courier_payroll_clock_no_update
BEFORE UPDATE OR DELETE ON courier_payroll_clock_events
FOR EACH ROW EXECUTE FUNCTION courier_payroll_forbid_mutation();

DROP TRIGGER IF EXISTS courier_payroll_facts_no_update
  ON courier_payroll_facts;
CREATE TRIGGER courier_payroll_facts_no_update
BEFORE UPDATE OR DELETE ON courier_payroll_facts
FOR EACH ROW EXECUTE FUNCTION courier_payroll_forbid_mutation();

DROP TRIGGER IF EXISTS courier_payroll_statements_no_update
  ON courier_payroll_statements;
CREATE TRIGGER courier_payroll_statements_no_update
BEFORE UPDATE OR DELETE ON courier_payroll_statements
FOR EACH ROW EXECUTE FUNCTION courier_payroll_forbid_mutation();

COMMIT;

-- Deliberately absent:
-- 1) no UPDATE-based correction path;
-- 2) no DELETE path;
-- 3) no negative-pay adjustment table;
-- 4) no production scheduler;
-- 5) no migration execution command.
--
-- Corrections must be designed as explicit superseding facts/statements
-- with preserved audit history before this draft can move to implementation.
