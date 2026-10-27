# Belgium Fair Pay Lab Policy V0.1

Date: 27 October 2026  
Status: DRAFT — simulation only

## Purpose

Belgium is the first test market for the country-agnostic Fair Pay Kernel.

This document deliberately does **not** declare a final Belgian worker classification, joint committee, CBA wage scale or production pay rate.

## Current LAB hypothesis

Primary design scenario: **Core Fleet employee model**.

For laboratory simulation only:
- POG fairness hypothesis: **19.00 EUR per paid hour**;
- this is **not** represented as the Belgian legal wage;
- legal/CBA floor remains unset until competent Belgian review;
- if the validated legal floor is higher, the kernel automatically uses the higher floor.

## Paid-time LAB rule

The employee lab adapter currently counts as paid:
- active mission time;
- platform-controlled waiting;
- required repositioning;
- other explicitly paid time.

Excluded/free time must be separately recorded and cannot be hidden inside an unpaid bucket.

## Tips and expenses

- tips: 100% additive in the kernel;
- reimbursed necessary expenses: additive and excluded from floor satisfaction;
- neither may make a low wage appear compliant.

## Production lock

Adapter:
`BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1`

Current state:
- `validationStatus = DRAFT`
- `effectiveFrom = null`
- `productionActivationAllowed = false`

The production path therefore throws:
`COURIER_PAYROLL_COUNTRY_POLICY_NOT_GREEN`

## Questions required before Belgium GREEN

1. What worker status/model will be used for the pilot?
2. Which competent joint committee / sectoral rules apply?
3. What mandatory wage scales, premiums and time rules apply?
4. How are waiting, breaks, standby, repositioning and travel classified?
5. What employer social contributions and holiday rules apply to the chosen setup?
6. What equipment/expense reimbursement policy is required?
7. What accident/work-risk insurance is required?
8. What schedule/part-time/flexible arrangements are lawful and operationally suitable?
9. What payroll cadence and payslip content will apply?
10. What mechanism will allow couriers to dispute time/pay calculations?

## Pilot rule

Do not open paid Belgian Courier activity until the country adapter is legally reviewed and switched to GREEN.
