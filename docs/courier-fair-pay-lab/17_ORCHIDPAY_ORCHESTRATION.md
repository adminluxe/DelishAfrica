# ORCHIDPAY — Silent Orchestrator Contract for Courier Fair Pay

Date: 27 October 2026  
Status: LAB / SHADOW — NO FINANCIAL EXECUTION

## Separation of authority

### DelishAfrica® Courier Fair Pay
Owns the labour/pay entitlement truth:
- raw work facts;
- country policy/version;
- Fair Pay calculation;
- human-approved corrections;
- immutable weekly statement.

### ORCHIDPAY
Owns financial orchestration:
- settlement-intent intake;
- financial idempotency;
- future ledger posting;
- outbox/reconciliation;
- future payout-rail execution.

**DelishAfrica must never call a payout rail directly from the Fair Pay engine.**

## Implemented shadow boundary

Contract:
`ORCHIDPAY_COURIER_SETTLEMENT_INTENT_V0.1`

Delish sends:
- statement ID;
- policy ID/hash;
- facts hash;
- courier/week/country/currency;
- eligible income;
- governing floor;
- differential;
- gross pay due;
- tips;
- expense reimbursements;
- total cash due;
- policy validation status;
- production eligibility;
- evidence refs;
- warnings.

ORCHIDPAY:
- requires internal API authentication;
- accepts only `mode=SHADOW`;
- stores append-only NDJSON with 0700/0600 permissions and fsync;
- hashes the economic intent with SHA-256;
- is idempotent by statement ID;
- rejects same statement ID with changed economic payload;
- tolerates a changed transport `generated_at` during retry because it is excluded from the economic intent hash;
- provides an outbox **preview**, never a publish/payment call.

## Feature flags

Delish network bridge:
`DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_ENABLED`

ORCHIDPAY consumer:
`ORCHIDPAY_COURIER_PAYROLL_SHADOW_ENABLED`

Both default OFF.

No send occurs unless the two laboratories are deliberately configured.

## Settlement state model

### Implemented
`SHADOW_RECEIVED`

This means:
- contract validated;
- intent persisted;
- no ledger transaction;
- no payout;
- no rail call.

### Future production state machine

```
STATEMENT_VALIDATED_GREEN
  -> LEDGER_POSTED
  -> PAYOUT_QUEUED
  -> PAYOUT_SUBMITTED
  -> SETTLED
```

Exceptional states:
- `ON_HOLD`
- `FAILED`
- `REVERSED`

These future states are **design only** until the production DB authority, ledger mapping, outbox and payout rails are formally reconciled.

## Production gates

ORCHIDPAY must refuse financial execution unless:
1. country policy is `GREEN`;
2. statement says `productionEligible=true`;
3. statement/policy/facts hashes are present and verified;
4. statement ID is idempotent;
5. courier payee/party mapping is validated;
6. balanced ledger-entry specification is approved;
7. payout rail is explicitly authorized;
8. reconciliation is operational;
9. correction/reversal handling is legally approved;
10. no silent negative adjustment is possible.

## Correction boundary

A corrected Delish payroll fact creates a new immutable statement ID.

ORCHIDPAY must never mutate an already accepted settlement intent to hide the correction.

If an earlier settlement has already executed, the later production design must use a visible reconciliation/reversal or additional credit workflow, subject to the country legal rules.

## Current evidence

DelishAfrica:
- 61/61 Fair Pay/OrchidPay tests PASS;
- TypeScript PASS;
- Nest build PASS.

ORCHIDPAY:
- 9/9 shadow consumer tests PASS;
- real TypeScript Delish fixture accepted by Python consumer;
- HTTP internal-key/feature-flag behavior PASS;
- no payout execution path in this lab.

VPS isolated ORCHIDPAY lab:
- baseline commit: `9bb7c14`;
- shadow consumer commit: `78edc49`.

GitHub ORCHIDPAY preservation:
- branch: `lab/courier-fair-pay-orchestrator-contract-20261027`;
- commit: `7bce84d`.

Evidence hashes:
- ORCHIDPAY lab tar: `0966d94ad6b5f4c164eb168121b8075a36bed463013626cca2806cd0be623220`;
- ORCHIDPAY patch: `333cc26df24650b8d9b0485cfcdf12bcc0737fd39d553847886221b563f27e7a`.

## Current blocker deliberately preserved

The production ORCHIDPAY PostgreSQL environment rejected a read-only schema connection during this lab pass.

Therefore:
- no production migration was attempted;
- the bundled migration is unbound DRAFT;
- no existing ledger/outbox schema was mutated.

This is a hard safety gate, not a reason to bypass database authority.
