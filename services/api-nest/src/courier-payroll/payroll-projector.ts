import {
  assertCourierPayrollFact,
  CourierPayrollDurationFact,
  CourierPayrollFact,
  CourierPayrollMoneyFact,
  CourierPayrollTimeFact,
} from '../../../../packages/contracts/src/courier-payroll';
import {
  CountryPayPolicy,
  WeeklyCourierPayInput,
  WorkTimeBreakdown,
} from './courier-payroll.types';

export interface ProjectedWeeklyPayrollInput {
  input: WeeklyCourierPayInput;
  factIds: string[];
  effectiveFactIds: string[];
  supersededFactIds: string[];
  factCount: number;
  effectiveFactCount: number;
}

function secondsBetween(startedAt: string, endedAt: string): number {
  const millis = Date.parse(endedAt) - Date.parse(startedAt);
  if (millis <= 0 || millis % 1000 !== 0) {
    throw new Error('COURIER_PAYROLL_TIME_INTERVAL_INVALID');
  }
  return millis / 1000;
}

function assertSameScope(
  fact: CourierPayrollFact,
  courierId: string,
  weekKey: string,
  policy: CountryPayPolicy,
): void {
  if (fact.courierId !== courierId) {
    throw new Error('COURIER_PAYROLL_FACT_MIXED_COURIER');
  }
  if (fact.weekKey !== weekKey) {
    throw new Error('COURIER_PAYROLL_FACT_MIXED_WEEK');
  }
  if (fact.policyId !== policy.policyId) {
    throw new Error('COURIER_PAYROLL_FACT_POLICY_MISMATCH');
  }
  if (fact.countryCode.toUpperCase() !== policy.countryCode.toUpperCase()) {
    throw new Error('COURIER_PAYROLL_FACT_COUNTRY_MISMATCH');
  }
}

function assertNoDuplicateFacts(facts: CourierPayrollFact[]): void {
  const ids = new Set<string>();
  for (const fact of facts) {
    if (ids.has(fact.factId)) throw new Error('COURIER_PAYROLL_DUPLICATE_FACT');
    ids.add(fact.factId);
  }
}

function assertCorrectionCompatibility(
  replacement: CourierPayrollFact,
  target: CourierPayrollFact,
): void {
  if (
    replacement.courierId !== target.courierId ||
    replacement.weekKey !== target.weekKey ||
    replacement.policyId !== target.policyId ||
    replacement.countryCode.toUpperCase() !== target.countryCode.toUpperCase()
  ) {
    throw new Error('COURIER_PAYROLL_CORRECTION_SCOPE_MISMATCH');
  }
  if (
    replacement.kind !== target.kind ||
    replacement.category !== target.category
  ) {
    throw new Error('COURIER_PAYROLL_CORRECTION_TYPE_MISMATCH');
  }
  if (
    replacement.kind === 'MONEY' &&
    target.kind === 'MONEY' &&
    replacement.currency.toUpperCase() !== target.currency.toUpperCase()
  ) {
    throw new Error('COURIER_PAYROLL_CORRECTION_CURRENCY_MISMATCH');
  }
  const approvedAt = Date.parse(replacement.correction!.approvedAt);
  if (
    approvedAt < Date.parse(target.recordedAt) ||
    approvedAt > Date.parse(replacement.recordedAt)
  ) {
    throw new Error('COURIER_PAYROLL_CORRECTION_TIME_INVALID');
  }
}

export function resolveEffectivePayrollFacts(
  facts: CourierPayrollFact[],
): {
  effectiveFacts: CourierPayrollFact[];
  supersededFactIds: string[];
} {
  const byId = new Map(facts.map((fact) => [fact.factId, fact] as const));
  const supersededBy = new Map<string, string>();

  for (const fact of facts) {
    if (!fact.supersedesFactId) continue;
    const target = byId.get(fact.supersedesFactId);
    if (!target) {
      throw new Error('COURIER_PAYROLL_CORRECTION_TARGET_MISSING');
    }
    assertCorrectionCompatibility(fact, target);
    if (supersededBy.has(target.factId)) {
      throw new Error('COURIER_PAYROLL_CORRECTION_TARGET_ALREADY_SUPERSEDED');
    }
    supersededBy.set(target.factId, fact.factId);
  }

  for (const fact of facts) {
    const visited = new Set<string>();
    let current: CourierPayrollFact | undefined = fact;
    while (current?.supersedesFactId) {
      if (visited.has(current.factId)) {
        throw new Error('COURIER_PAYROLL_CORRECTION_CYCLE');
      }
      visited.add(current.factId);
      current = byId.get(current.supersedesFactId);
    }
  }

  return {
    effectiveFacts: facts.filter((fact) => !supersededBy.has(fact.factId)),
    supersededFactIds: Array.from(supersededBy.keys()).sort(),
  };
}

function assertUniqueDurationEstimates(facts: CourierPayrollDurationFact[]): void {
  const missionKeys = new Set<string>();
  for (const fact of facts) {
    const key = String(fact.missionId || fact.orderId || '').trim();
    if (!key) {
      throw new Error('COURIER_PAYROLL_DURATION_FACT_MISSION_REQUIRED');
    }
    if (missionKeys.has(key)) {
      throw new Error('COURIER_PAYROLL_DUPLICATE_ACTIVITY_ESTIMATE');
    }
    missionKeys.add(key);
  }
}

function assertNoTimeOverlap(facts: CourierPayrollTimeFact[]): void {
  const ordered = [...facts].sort(
    (a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt),
  );
  for (let i = 1; i < ordered.length; i += 1) {
    if (Date.parse(ordered[i].startedAt) < Date.parse(ordered[i - 1].endedAt)) {
      throw new Error('COURIER_PAYROLL_TIME_FACT_OVERLAP');
    }
  }
}

export function projectWeeklyPayrollInput(
  facts: CourierPayrollFact[],
  policy: CountryPayPolicy,
): ProjectedWeeklyPayrollInput {
  if (!Array.isArray(facts) || facts.length === 0) {
    throw new Error('COURIER_PAYROLL_FACTS_REQUIRED');
  }
  facts.forEach(assertCourierPayrollFact);
  assertNoDuplicateFacts(facts);

  const courierId = facts[0].courierId;
  const weekKey = facts[0].weekKey;
  facts.forEach((fact) => assertSameScope(fact, courierId, weekKey, policy));

  const timeFacts = facts.filter(
    (fact): fact is CourierPayrollTimeFact => fact.kind === 'TIME',
  );
  const moneyFacts = facts.filter(
    (fact): fact is CourierPayrollMoneyFact => fact.kind === 'MONEY',
  );
  const durationFacts = facts.filter(
    (fact): fact is CourierPayrollDurationFact => fact.kind === 'DURATION',
  );
  assertUniqueDurationEstimates(durationFacts);
  assertNoTimeOverlap(timeFacts);

  const workTime: WorkTimeBreakdown = {
    activeMissionSeconds: 0,
    platformControlledWaitingSeconds: 0,
    requiredRepositionSeconds: 0,
    otherPaidSeconds: 0,
    excludedSeconds: 0,
  };

  for (const fact of timeFacts) {
    const seconds = secondsBetween(fact.startedAt, fact.endedAt);
    switch (fact.category) {
      case 'ACTIVE_MISSION':
        workTime.activeMissionSeconds += seconds;
        break;
      case 'PLATFORM_CONTROLLED_WAITING':
        workTime.platformControlledWaitingSeconds += seconds;
        break;
      case 'REQUIRED_REPOSITION':
        workTime.requiredRepositionSeconds += seconds;
        break;
      case 'OTHER_PAID':
        workTime.otherPaidSeconds += seconds;
        break;
      case 'EXCLUDED':
        workTime.excludedSeconds += seconds;
        break;
    }
  }

  let activityGuaranteeSeconds = 0;
  let eligibleIncomeCents = 0;
  let tipsCents = 0;
  let expenseReimbursementsCents = 0;

  for (const fact of durationFacts) {
    if (fact.category === 'ACTIVITY_GUARANTEE_ESTIMATE') {
      activityGuaranteeSeconds += fact.seconds;
      if (!Number.isSafeInteger(activityGuaranteeSeconds)) {
        throw new Error('COURIER_PAYROLL_ACTIVITY_ESTIMATE_OVERFLOW');
      }
    }
  }

  for (const fact of moneyFacts) {
    if (fact.currency.toUpperCase() !== policy.currency.toUpperCase()) {
      throw new Error('COURIER_PAYROLL_FACT_CURRENCY_MISMATCH');
    }
    if (fact.category === 'ELIGIBLE_INCOME') {
      eligibleIncomeCents += fact.amountMinor;
    } else if (fact.category === 'TIP') {
      tipsCents += fact.amountMinor;
    } else if (fact.category === 'EXPENSE_REIMBURSEMENT') {
      expenseReimbursementsCents += fact.amountMinor;
    }
  }

  return {
    input: {
      courierId,
      weekKey,
      workTime,
      ...(durationFacts.length > 0 ? { activityGuaranteeSeconds } : {}),
      eligibleIncomeCents,
      tipsCents,
      expenseReimbursementsCents,
    },
    factIds: facts.map((fact) => fact.factId).sort(),
    factCount: facts.length,
  };
}
