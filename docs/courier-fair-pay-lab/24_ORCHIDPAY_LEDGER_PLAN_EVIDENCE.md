# ORCHIDPAY — Courier Payroll Pure Ledger Plan Evidence

Date: 27 October 2026
Status: LAB / NON-EXECUTABLE

## Purpose

Prove the accounting shape of a Courier Fair Pay statement **before** granting any production database or payout capability.

## Input

Real DelishAfrica TypeScript settlement fixture:
`16_ORCHIDPAY_SETTLEMENT_INTENT_FIXTURE.json`

The ORCHIDPAY Python planner consumes the same validated settlement intent used by the SHADOW HTTP consumer.

## Pure planner

File:
`app/services/courier_payroll_ledger_plan.py`

The planner has:
- no SQLAlchemy session;
- no database write;
- no `commit()`;
- no ledger service call;
- no outbox publish;
- no payout call;
- no rail client.

Every planned transaction sets:
`execution_allowed = False`

The aggregate plan sets:
`production_execution = False`

## Planned components

For non-zero values:

1. **gross**
   - DEBIT SYSTEM gross clearing
   - CREDIT Courier payable
   - idempotency: `courier_payroll:<statementId>:gross`

2. **tips**
   - DEBIT SYSTEM tip clearing
   - CREDIT Courier payable
   - idempotency: `courier_payroll:<statementId>:tips`

3. **expense**
   - DEBIT SYSTEM expense-reimbursement clearing
   - CREDIT Courier payable
   - idempotency: `courier_payroll:<statementId>:expense`

Zero components produce no zero-value transaction.

## Evidence binding

Each planned transaction carries:
- statement ID;
- policy ID/hash;
- facts hash;
- Courier ID;
- week;
- country;
- component;
- policy validation status;
- production eligibility.

Total planned amount must equal the Fair Pay statement total cash due.

Each planned transaction is independently balanced:
`DEBIT = CREDIT = component amount`.

## QA

ORCHIDPAY total suite:
**13/13 PASS**

Ledger-plan tests prove:
- real TypeScript fixture produces 3 balanced transactions;
- component amounts preserve gross/tips/expense separation;
- zero tips/expenses are skipped;
- same economic intent creates identical plan;
- missing Party/payable mapping is rejected;
- no plan permits execution.

## Preservation

VPS isolated lab:
- baseline: `9bb7c14`
- shadow consumer: `78edc49`
- ledger-plan: `8586291`

GitHub ORCHIDPAY:
- branch: `lab/courier-fair-pay-orchestrator-contract-20261027`
- current commit: `5b9d4e2`

Evidence hashes:
- ledger-plan lab tar:
  `dcd8d23eeacfc67fca01bf3672be2566f7e4d76c529fd369d120cc7b1d79ce32`
- baseline→ledger-plan patch:
  `3a79d238b003156d0a0e151bd0c53fad85b555e0aa001fc14f07856cde686e30`

Evidence copied to Toshiba:
`/home/tontoncestcarre/DA_EXPORTS/ORCHIDPAY_COURIER_PAYROLL_LAB_20261027/8586291/`

## Still blocked

No production ledger posting until:
- production DB authority is reconciled;
- Party/payee mapping is implemented;
- system account codes are approved;
- accounting treatment is approved;
- official migration lineage is restored;
- GREEN Fair Pay statement is required;
- outbox transactionality is proven;
- reconciliation/reversal is proven;
- payout rail is explicitly authorized.
