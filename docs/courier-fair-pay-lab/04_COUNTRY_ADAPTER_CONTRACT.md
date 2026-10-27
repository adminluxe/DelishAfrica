# Country Adapter Contract

Every market must implement the same semantic contract.

## Required policy identity

- `policyId`
- country code
- currency
- worker status
- validation status
- effective date
- production activation flag

## Required pay configuration

- legal floor per paid hour, when applicable;
- POG fairness floor, if POG chooses a higher voluntary standard;
- explicit paid-time rules for:
  - active mission;
  - platform-controlled waiting;
  - required reposition;
  - other paid time;
- weekly activity guarantee if the country/status uses one;
- tips policy;
- expense reimbursement policy.

## Activation lifecycle

`DRAFT -> LEGAL_REVIEW -> GREEN`

DRAFT:
- hypotheses allowed;
- simulation allowed;
- production payroll forbidden.

LEGAL_REVIEW:
- legal sources mapped;
- operational interpretation under review;
- simulation allowed;
- production payroll forbidden.

GREEN:
- legal review recorded;
- data mapping tested;
- payroll statement tested;
- disputes/appeals defined;
- production activation may be explicitly enabled.

## Universal rule

No country adapter is allowed to infer that an absent rule means unpaid.

Ambiguous time/pay categories must remain OPEN and block GREEN where material.

## Initial adapters

Belgium:
`BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1`

France:
`FR-INDEPENDENT-ARPE-2026-09-01-v1`

Future:
- Luxembourg;
- Cameroon;
- any subsequent DelishAfrica® market.

The kernel remains stable while policy adapters evolve.
