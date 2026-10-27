# ORCHIDPAY — Courier Payroll Party / Ledger Contract DRAFT V0.1

Date: 27 October 2026
Status: DESIGN ONLY — NO DB MIGRATION / NO LEDGER POST / NO PAYOUT

## Purpose

Define how a validated DelishAfrica® Fair Pay weekly statement should eventually become balanced ORCHIDPAY ledger obligations without making DelishAfrica itself a payment engine.

## Existing authoritative primitives observed

ORCHIDPAY runtime contains the current v1 ledger primitives:
- `Party`
- `LedgerAccount`
- `LedgerTx`
- `LedgerEntry`
- `ExternalRef`
- `OutboxEvent`

Existing ledger service posts balanced double-entry transactions and validates:
- positive amounts;
- matching currency;
- account existence;
- debit/credit balance;
- transaction state.

This contract should reuse those primitives.

## Important legacy warning

Some existing settlement/payout service files still reference older model names/fields that are not aligned with the current v1 `app.db.models` schema.

Therefore:
- do not reuse legacy settlement/payout services as Courier production authority;
- reconcile or retire them before financial activation;
- keep Courier integration on the current ledger/outbox model.

## 1. Courier Party mapping

Target:

```
Party
type        = COURIER
external_id = <DelishAfrica canonical courier ID>
name        = optional display/legal name
```

Rules:
- one ORCHIDPAY Courier Party per canonical Delish courier identity;
- mapping must be idempotent;
- no email/name should be used as the financial primary key;
- country/KYC/payee profile remains ORCHIDPAY-owned;
- Delish Fair Pay should not store payout credentials.

## 2. Courier payable account

Target account:

```
LedgerAccount
party_id = courier party
code     = COURIER_PAYABLE
kind     = COURIER
currency = statement currency
status   = ACTIVE
```

A statement in EUR must not post to a non-EUR payable account.

## 3. Statement components

The Fair Pay statement deliberately separates:
- gross pay due;
- tips;
- expense reimbursements.

ORCHIDPAY should preserve that separation in ledger evidence.

### Preferred V0.1 recognition

Use **three independent balanced/idempotent ledger transactions**, not one opaque total.

#### A. Gross/Fair Pay obligation

Idempotency key:
`courier_payroll:<statementId>:gross`

External reference:
- type: `courier_payroll_statement_gross`
- id: statement ID

Entries:
- DEBIT: dedicated SYSTEM courier-payroll clearing/expense account;
- CREDIT: courier `COURIER_PAYABLE`;
- amount: `gross_pay_due_minor`.

#### B. Tip pass-through

Idempotency key:
`courier_payroll:<statementId>:tips`

External reference:
- type: `courier_payroll_statement_tips`
- id: statement ID

Entries:
- DEBIT: dedicated SYSTEM tip-pass-through clearing account;
- CREDIT: courier `COURIER_PAYABLE`;
- amount: `tips_minor`.

#### C. Expense reimbursement

Idempotency key:
`courier_payroll:<statementId>:expense`

External reference:
- type: `courier_payroll_statement_expense`
- id: statement ID

Entries:
- DEBIT: dedicated SYSTEM expense-reimbursement clearing account;
- CREDIT: courier `COURIER_PAYABLE`;
- amount: `expense_reimbursements_minor`.

Zero-value components should not create zero ledger transactions.

## 4. Why three transactions

This preserves:
- Fair Pay wage/compensation visibility;
- tips as pass-through rather than wage floor;
- expenses as reimbursement rather than wage;
- independent reconciliation;
- component-specific reversal/correction evidence.

The statement total remains:

`gross + tips + expenses = total cash due`

## 5. Required SYSTEM accounts — DRAFT

Candidate codes:
- `SYSTEM_COURIER_PAYROLL_CLEARING`
- `SYSTEM_COURIER_TIP_CLEARING`
- `SYSTEM_COURIER_EXPENSE_CLEARING`

These names are design placeholders.

Accounting classification and chart-of-accounts treatment require finance/accounting validation.

## 6. Hash and evidence binding

Every ledger transaction metadata should include:
- statement ID;
- statement schema version;
- policy ID;
- policy hash;
- facts hash;
- country;
- week;
- component;
- source system = DelishAfrica Courier Fair Pay.

Before recognition:
- recompute/verify the received intent hash;
- reject changed economic payload under same statement ID;
- reject non-GREEN policy for production;
- reject `production_eligible=false`.

## 7. Correction behavior

A correction creates a **new Fair Pay statement ID**.

ORCHIDPAY must not mutate old ledger entries.

### If original statement has not been financially recognized
Accept the newer statement only according to an explicit statement-supersession policy still to be designed.

### If original obligation has been recognized but not paid
Use explicit reversal/adjustment transactions; never rewrite the old transaction.

### If already paid
Use a legally validated additional-credit/reconciliation/recovery process.

Negative clawbacks from future Courier pay must **not** be implemented automatically without Belgian legal/payroll validation.

## 8. Payout state — separate from entitlement

Recognition of courier payable does not mean money has reached the courier.

Target financial state machine:

```
SHADOW_RECEIVED
-> PAYABLE_RECOGNIZED
-> PAYOUT_QUEUED
-> PAYOUT_SUBMITTED
-> SETTLED
```

Exceptional:
- `ON_HOLD`
- `FAILED`
- `REVERSED`

The exact ledger entry for payout/in-transit/settlement remains OPEN pending:
- payment rail semantics;
- accounting review;
- provider reconciliation behavior.

## 9. Outbox

After each successful idempotent ledger recognition, emit an outbox event transactionally with the ledger transaction.

Candidate event types:
- `CourierPayrollGrossRecognized`
- `CourierTipPayableRecognized`
- `CourierExpenseReimbursementRecognized`
- `CourierPayrollStatementRecognized`

No external delivery should occur before the DB transaction commits.

## 10. Production gate

No Courier ledger recognition until:
- [ ] ORCHIDPAY production DB authority is reconciled;
- [ ] Alembic lineage is authoritative;
- [ ] Party mapping is implemented/tested;
- [ ] required system accounts exist;
- [ ] chart-of-accounts treatment approved;
- [ ] statement is GREEN + production eligible;
- [ ] idempotency/external-ref uniqueness tested;
- [ ] outbox transactionality tested;
- [ ] payout state machine approved;
- [ ] reconciliation/reversal tested;
- [ ] payment rail explicitly authorized.

## 11. Current implementation boundary

Current ORCHIDPAY Courier integration remains:

`SHADOW_RECEIVED`

It has:
- contract validation;
- internal auth;
- private append-only persistence;
- idempotency;
- tamper detection;
- outbox preview.

It does **not** have:
- Party creation;
- ledger posting;
- outbox publish;
- payout;
- rail execution.

This DRAFT intentionally does not change that boundary.
