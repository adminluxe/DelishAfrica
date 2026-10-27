# Policy Ledger & Weekly Statement V0.1

## Immutable policy principle

Every country/status policy is sealed with SHA-256 over canonical JSON.

Snapshot 27 October 2026:

- Belgium `BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1`
  - hash: `5f0ca2b5349dee3921aede627b0519355d32857df5624866ce7e26b53cdb229c`
  - validation: DRAFT
  - production: blocked

- France `FR-INDEPENDENT-ARPE-2026-09-01-v1`
  - hash: `ae0794c9fb2d0408c545ff0fb58293bfe2a4fdc7147741f19429872cdbf44d4a`
  - validation: LEGAL_REVIEW
  - production: blocked

A policy cannot be modified under the same `policyId` without triggering an integrity error.

A changed rule requires a new version.

## Weekly statement

Statement identity is deterministic from:
- policy hash;
- sorted source facts;
- calculation result;
- statement version.

Example Belgium statement:
- statement ID: `9c6c574d92fdbde7ba3a53033a48a035aba209463c8bff3c960e875c9a44cb63`
- facts hash: `5c7bd1b727c32c999520e2ee19b885f898072a80fa89e9560c7ee56924695cac`
- paid time: 5,400 seconds = 90 min;
- active mission: 3,000 seconds = 50 min;
- pickup waiting/dwell: 600 seconds = 10 min;
- required reposition: 900 seconds = 15 min;
- other paid work: 900 seconds = 15 min;
- eligible income: 26.00 EUR;
- POG LAB floor: 28.50 EUR;
- true-up: 2.50 EUR;
- tips: 5.00 EUR;
- expenses: 3.00 EUR;
- total cash due: 36.50 EUR.

Warnings are preserved in the statement:
- country policy not legally GREEN;
- legal floor not configured;
- low utilization belongs to POG zone risk.

## Contestability

The statement contract is explicitly `contestable: true`.

Future production implementation must add:
- visible explanation;
- support/dispute entry point;
- human correction workflow;
- immutable correction trail;
- settlement state/payment reference.
