# DelishAfrica® Courier Fair Pay Lab — Passation Checkpoint

Date: 27 October 2026
Status: LAB GREEN / COUNTRY & FINANCIAL PRODUCTION GATES OPEN

## Source control

Delish branch:
`lab/courier-fair-pay-kernel-code-20261027`

Key commits:
- `61c5722` — Fair Pay statement → ORCHIDPAY SHADOW + Courier build;
- `bac0cea` — statement UI, Employer Cost Engine, Belgium data pack;
- `e3a5a4f` — human dispute workflow;
- `902f383` — Belgium co-design pack + ORCHIDPAY ledger-plan docs.

ORCHIDPAY GitHub:
- branch `lab/courier-fair-pay-orchestrator-contract-20261027`;
- commit `5b9d4e2`.

ORCHIDPAY isolated VPS lab:
- latest commit `8586291`.

## QA truth

Delish Fair Pay:
**72/72 PASS**

Backend:
- TypeScript noEmit: PASS;
- TypeScript emit: PASS, 315 emitted files;
- Nest CLI wrapper: intermittent native SIGSEGV; prior checkpoint build PASS. No TypeScript diagnostic failure.

Courier:
- TypeScript: PASS;
- iOS Expo/Hermes bundle: PASS;
- 1114 modules;
- HBC 3.34 MB;
- device E2E: OPEN.

ORCHIDPAY:
**13/13 PASS**
- shadow consumer;
- internal auth;
- idempotence;
- tamper detection;
- restart persistence;
- real TypeScript Delish fixture;
- pure non-executable balanced ledger plan.

## What is now GREEN in LAB

- Fair Pay kernel;
- Zone Viability;
- Belgium employee DRAFT adapter;
- France ARPE reference adapter;
- immutable policy ledger;
- append-only facts;
- corrections by supersession;
- explicit waiting/pickup timing;
- OPS-only reposition/other-paid segments;
- persistent private ledger;
- weekly statements;
- own-statement Courier UI;
- human dispute workflow;
- Employer Cost Engine;
- Belgium legal/payroll research pack;
- CSC/Maison des Livreurs co-design question pack;
- Delish → ORCHIDPAY settlement intent;
- ORCHIDPAY SHADOW;
- pure ORCHIDPAY gross/tips/expense ledger plan.

## Hard production gates still OPEN

Belgium:
- worker status final;
- CP/CCT;
- wage scale/premiums;
- working-time rules;
- fully loaded employer costs;
- accident/work-risk insurance;
- equipment/expense policy;
- scheduling;
- payroll/payslip;
- representation/SLA;
- qualified legal/payroll review;
- Platform Work Directive transposition refresh.

Delish product:
- device E2E;
- real eligible-income/tips/expense mapping;
- production source for reposition/other-paid;
- real Brussels micro-zone data.

ORCHIDPAY:
- production DB authority;
- official migration lineage;
- Courier Party/payee mapping;
- approved system accounts/accounting treatment;
- production ledger posting;
- transactional outbox;
- reconciliation/reversal;
- payout rail authorization.

## Safety statement

No production deployment was performed.

No production Fair Pay calculation has been allowed to pay a Courier.

No ORCHIDPAY production database migration, ledger post, outbox publish, payout or payment-rail execution occurred.

All activation flags remain OFF by default.

## Next recommended order

1. Device E2E Fair Pay / pickup-arrived / dispute.
2. CSC/Maison des Livreurs co-design with question pack.
3. Payroll/legal validation of Belgium status + CP/CCT + employer-cost inputs.
4. Real unit economics for first Brussels micro-zone.
5. ORCHIDPAY DB-authority reconciliation.
6. Party/payee + ledger + outbox integration only after financial authority is clean.
7. Four-week controlled pilot.
