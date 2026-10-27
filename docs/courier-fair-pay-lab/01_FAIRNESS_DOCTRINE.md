# Fair Pay Doctrine — DelishAfrica® Courier

Status: INTERNAL LAB DOCTRINE

## Principle

DelishAfrica® must not seek profitability in the gap between what a courier should fairly receive and what the platform can get away with paying.

Profitability must come from better logistics:
- density;
- lower restaurant waiting;
- better batching;
- lower empty repositioning;
- better forecasting;
- lower incident/turnover cost;
- better Client/Merchant/Courier coordination.

## Invariants

### F1 — Legal floor dominates
For any country/status:

`governingFloor >= legalFloor`

If POG voluntarily sets a higher fairness floor:

`governingFloor = max(legalFloor, POGFairnessFloor, applicableActivityGuarantee)`

### F2 — Tips are additive
Tips never reduce a guaranteed floor or differential.

### F3 — Necessary work costs are separate
Expense reimbursement does not count as remuneration for satisfying the floor.

### F4 — Platform-controlled time is an explicit policy input
No country adapter may silently discard waiting/repositioning time. The adapter must explicitly classify each time bucket.

### F5 — No hidden refusal tax
A courier's refusal of a mission must not silently become a payroll penalty or dispatch handicap without a separately lawful and disclosed rule. Current POG design direction: refusal alone does not lower assignment ranking.

### F6 — Viability cannot rewrite earned pay
A zone that loses money is a POG/operations problem. Payroll computation does not read zone profitability as an input to reduce worker entitlement.

### F7 — Reproducible calculations
Every rule has a `policyId` / calculation version. Historical statements must be reproducible.

### F8 — Human-legible statement
The future courier statement should separately expose:
- paid/mobilized time;
- active mission time;
- eligible income;
- floor;
- differential;
- tips;
- expense reimbursement;
- bonuses/adjustments by category;
- payment date;
- contestation path.

## Desired strategic effect

Better protection should produce lower turnover and better operational quality. Better quality should improve density and retention. Density should reduce courier cost per delivery. That efficiency can then fund both POG resilience and worker protection.

This is the intended flywheel. It must be proven with data, not assumed.
