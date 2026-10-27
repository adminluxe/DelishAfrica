# Courier Fair Pay Lab — Master TODO

Updated: 27 October 2026

## A. Kernel / mathematics

- [x] Separate Fair Pay from Zone Viability.
- [x] Legal floor / POG floor / country guarantee arbitration.
- [x] Tips excluded from floor satisfaction.
- [x] Expenses excluded from floor satisfaction.
- [x] Low utilization treated as POG risk.
- [x] Belgium employee LAB adapter.
- [x] France ARPE reference adapter.
- [x] Separate France estimated activity duration from actual clock time.
- [x] Break-even and target-density engine.
- [x] Merchant wait / batching density model.
- [x] Belgium economics sensitivity sweep.

## B. Audit / ledger

- [x] Immutable policy hash.
- [x] Same-version mutation detection.
- [x] Canonical source fact contract.
- [x] Duplicate fact protection.
- [x] Time-overlap protection.
- [x] Duplicate mission activity-estimate protection.
- [x] Deterministic weekly statement.
- [x] Fact hash + policy hash + statement hash.
- [x] Statement marked contestable.

## C. Telemetry

- [x] Shared raw clock-event contract.
- [x] Mission event normalizer.
- [x] OPS reposition/other-paid segment normalizer.
- [x] Existing acceptance/ready/pickup/delivery fields inventoried.
- [ ] Instrument `PICKUP_ARRIVED` in Courier.
- [ ] Audit runtime population of `readyAt`.
- [ ] Emit accepted/picked-up/delivered payroll clock events from API.
- [ ] Emit merchant-ready payroll clock event.
- [ ] Emit reposition start/end from OPS/Courier.
- [ ] Establish canonical tip credit.
- [ ] Establish canonical expense reimbursement credit.
- [ ] Establish legally validated eligible-income credit.

## D. Persistence / execution

- [ ] Append-only payroll fact store.
- [ ] Persistent policy ledger.
- [ ] Weekly statement persistence.
- [ ] Idempotent weekly calculation job.
- [ ] Settlement/payment status model.
- [ ] Correction/reversal model without silent negative adjustments.
- [ ] Statement API.
- [ ] Courier statement UI.
- [ ] Human dispute/correction workflow.

## E. Belgium legal/payroll gates

- [ ] Final worker-status architecture.
- [ ] Competent joint committee/CBA.
- [ ] Legal/conventional wage floor.
- [ ] Premiums/working-time rules.
- [ ] Waiting/reposition/break classification.
- [ ] Employer contributions/holiday cost model.
- [ ] Accident/work-risk insurance.
- [ ] Equipment/expense policy.
- [ ] Scheduling/part-time/flex model.
- [ ] Payroll cadence/payslip requirements.
- [ ] Dispute/representation process.
- [ ] Qualified Belgian legal review.
- [ ] Policy transition DRAFT → LEGAL_REVIEW → GREEN.

## F. Pilot economics

- [x] LOW / BASE / HIGH illustrative scenarios.
- [x] 30 economic sensitivity combinations.
- [x] 45 operational sensitivity combinations.
- [ ] Replace lab cost/hour with real employer cost.
- [ ] Replace lab contribution/order with actual unit economics.
- [ ] Instrument waiting by merchant.
- [ ] Instrument empty/reposition km/time.
- [ ] Instrument batching.
- [ ] Define first Brussels micro-zone.
- [ ] Define staffing windows.
- [ ] Run four-week controlled pilot.
- [ ] Establish scale/no-scale decision thresholds.

## G. Release safety

- [x] DRAFT policy blocked from production execution.
- [x] Current branch isolated from production.
- [x] Local Git commits used as checkpoints.
- [ ] Remote branch content backup completed.
- [ ] Full build/typecheck in restored workspace toolchain.
- [ ] Production feature flag.
- [ ] No default/fallback country adapter.
- [ ] Final end-to-end pre-release certification.

## Current QA

**25 / 25 tests PASS.**

Next priority:
1. persistence schema in LAB;
2. API/Courier/Merchant event producers behind disabled feature flag;
3. weekly job + statement API in LAB;
4. Belgium legal-data pack;
5. recalibrate economics with real POG figures.
