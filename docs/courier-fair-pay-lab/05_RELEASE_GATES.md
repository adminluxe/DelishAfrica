# Fair Pay Release Gates

No paid Courier market activation until all material gates are GREEN.

## G0 — Policy identity
- country/status selected;
- policy version immutable and identifiable.

## G1 — Legal
- status reviewed;
- competent labor/CBA framework identified;
- wage/floor/premium rules reviewed;
- paid-time classifications reviewed;
- insurance/social-security obligations reviewed.

## G2 — Data
Every payroll-critical time/income component has a source:
- mission acceptance;
- pickup;
- delivery;
- waiting;
- reposition;
- other paid time;
- eligible income;
- tips;
- expenses;
- adjustments.

## G3 — Calculation
- deterministic tests PASS;
- rounding rule documented;
- weekly/daily aggregation documented;
- historical recomputation possible.

## G4 — Statement
Courier-facing statement shows the calculation clearly.

## G5 — Dispute
- human support channel;
- correction workflow;
- audit trail;
- SLA.

## G6 — Viability
Pilot zone has explicit break-even and target-density thresholds.

## G7 — Safety
Insurance/incident/emergency process validated.

## G8 — Product
Client + Merchant + Courier signals needed for waiting/density are instrumented.

## G9 — Production switch
Only a GREEN country adapter with `productionActivationAllowed=true` may cross the production boundary.

## Belgium current state — 27 October 2026

- Kernel: GREEN in LAB
- Test suite: 13/13 PASS
- Belgian legal adapter: DRAFT
- Legal floor: OPEN
- Joint committee/CBA: OPEN
- Production activation: BLOCKED
- Pilot economics: LAB assumptions only
