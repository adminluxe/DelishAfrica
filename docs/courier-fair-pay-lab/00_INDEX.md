# DelishAfrica® Courier Fair Pay Lab

Date: 27 October 2026  
Branch: `lab/courier-fair-pay-kernel-20261027`  
Status: LAB — NOT PRODUCTION

## Mission

Build one country-agnostic Courier payroll/fairness kernel, then attach legally reviewed country adapters before any paid market activation.

Belgium is the first laboratory. France is the first regulatory reference adapter.

## Non-negotiable architecture

1. **Pay and viability are separate calculations.**
   - Fair Pay answers: what is owed/protected for the courier?
   - Zone Viability answers: can POG/DelishAfrica sustain the zone?
   - A negative zone result must never reduce an already earned courier entitlement.

2. **Country policy is data, not hard-coded business folklore.**
   - legal floor;
   - POG fairness floor;
   - paid-time rules;
   - activity guarantee;
   - tips;
   - expenses;
   - legal status;
   - activation state.

3. **Production activation requires GREEN.**
   DRAFT and LEGAL_REVIEW policies may be simulated in LAB but cannot execute production payroll.

4. **Tips and reimbursed work expenses do not satisfy pay floors.**

5. **Low utilization is POG operational risk, not courier debt.**

## Code

- `services/api-nest/src/courier-payroll/courier-payroll.types.ts`
- `services/api-nest/src/courier-payroll/fair-pay-kernel.ts`
- `services/api-nest/src/courier-payroll/zone-viability.ts`
- `services/api-nest/src/courier-payroll/adapters/belgium.ts`
- `services/api-nest/src/courier-payroll/adapters/france.ts`
- `services/api-nest/src/courier-payroll/fair-pay-kernel.spec.ts`
- France legacy/reference core: `services/api-nest/src/courier-compensation/france-weekly-guarantee.ts`

## QA lock

27 October 2026: **13/13 tests PASS** with `pnpm dlx tsx --test`.

The test suite currently proves:
- paid waiting/repositioning can be protected in Belgian employee LAB policy;
- higher legal floor overrides lower POG floor;
- tips/expenses are always additive;
- French 19 €/activity-hour weekly reference remains distinct;
- DRAFT policy cannot execute production payroll;
- zone loss remains with POG;
- density can be tested independently of worker entitlement.

## Documents

- `01_FAIRNESS_DOCTRINE.md`
- `02_BELGIUM_LAB_POLICY.md`
- `03_VIABILITY_MATH.md`
- `04_COUNTRY_ADAPTER_CONTRACT.md`
- `05_RELEASE_GATES.md`
- `06_BELGIUM_SCENARIOS_20261027.json`
- `07_LAB_STATUS_20261027.md`
