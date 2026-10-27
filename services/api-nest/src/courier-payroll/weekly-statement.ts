import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { CountryPayPolicy, FairPayComputation, PayrollExecutionMode } from './courier-payroll.types';
import { computeFairPay } from './fair-pay-kernel';
import {
  assertSealedPolicyIntegrity,
  SealedCountryPayPolicy,
  stableJsonHash,
} from './policy-ledger';
import { projectWeeklyPayrollInput } from './payroll-projector';

export const COURIER_WEEKLY_STATEMENT_VERSION = 'COURIER_WEEKLY_STATEMENT_V0.1';

export interface CourierWeeklyStatement {
  statementId: string;
  statementVersion: string;
  courierId: string;
  weekKey: string;
  countryCode: string;
  currency: string;
  policyId: string;
  policyHash: string;
  factsHash: string;
  factIds: string[];
  factCount: number;
  computation: FairPayComputation;
  explanation: {
    paidSeconds: number;
    activeMissionSeconds: number;
    activityGuaranteeSeconds: number | null;
    waitingSeconds: number;
    repositionSeconds: number;
    otherPaidSeconds: number;
    excludedSeconds: number;
    eligibleIncomeCents: number;
    governingFloorCents: number;
    differentialDueCents: number;
    tipsCents: number;
    expenseReimbursementsCents: number;
    totalCashDueCents: number;
  };
  contestable: true;
  warnings: string[];
}

function sortedFacts(facts: CourierPayrollFact[]): CourierPayrollFact[] {
  return [...facts].sort((a, b) => a.factId.localeCompare(b.factId));
}

export function buildCourierWeeklyStatement(
  facts: CourierPayrollFact[],
  sealedPolicy: SealedCountryPayPolicy,
  mode: PayrollExecutionMode = 'LAB',
): CourierWeeklyStatement {
  assertSealedPolicyIntegrity(sealedPolicy);
  const policy: CountryPayPolicy = sealedPolicy.policy;
  const orderedFacts = sortedFacts(facts);
  const projection = projectWeeklyPayrollInput(orderedFacts, policy);
  const computation = computeFairPay(projection.input, policy, mode);
  const factsHash = stableJsonHash(orderedFacts);

  const statementWithoutId = {
    statementVersion: COURIER_WEEKLY_STATEMENT_VERSION,
    courierId: projection.input.courierId,
    weekKey: projection.input.weekKey,
    countryCode: policy.countryCode,
    currency: policy.currency,
    policyId: policy.policyId,
    policyHash: sealedPolicy.policyHash,
    factsHash,
    factIds: projection.factIds,
    factCount: projection.factCount,
    computation,
    explanation: {
      paidSeconds: computation.paidSeconds,
      activeMissionSeconds: projection.input.workTime.activeMissionSeconds,
      activityGuaranteeSeconds: computation.activityGuaranteeSeconds,
      waitingSeconds: projection.input.workTime.platformControlledWaitingSeconds,
      repositionSeconds: projection.input.workTime.requiredRepositionSeconds,
      otherPaidSeconds: projection.input.workTime.otherPaidSeconds,
      excludedSeconds: projection.input.workTime.excludedSeconds,
      eligibleIncomeCents: computation.eligibleIncomeCents,
      governingFloorCents: computation.governingFloorCents,
      differentialDueCents: computation.differentialDueCents,
      tipsCents: computation.tipsPassThroughCents,
      expenseReimbursementsCents: computation.expenseReimbursementsCents,
      totalCashDueCents: computation.totalCashDueCents,
    },
    contestable: true as const,
    warnings: computation.warnings,
  };

  return {
    statementId: stableJsonHash(statementWithoutId),
    ...statementWithoutId,
  };
}
