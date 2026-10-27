import {
  CountryPayPolicy,
  FairPayComputation,
  PayrollExecutionMode,
  WeeklyCourierPayInput,
  WorkTimeBreakdown,
} from './courier-payroll.types';

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`COURIER_PAYROLL_INVALID_${field.toUpperCase()}`);
  }
}

function assertRequiredText(value: string, field: string): void {
  if (!String(value || '').trim()) {
    throw new Error(`COURIER_PAYROLL_INVALID_${field.toUpperCase()}`);
  }
}

function centsForSeconds(seconds: number, centsPerHour: number | null): number {
  if (centsPerHour == null) return 0;
  assertNonNegativeSafeInteger(seconds, 'seconds');
  assertNonNegativeSafeInteger(centsPerHour, 'centsPerHour');
  if (seconds === 0 || centsPerHour === 0) return 0;
  return Math.ceil((seconds * centsPerHour) / 3600);
}

export function mobilizedSeconds(workTime: WorkTimeBreakdown): number {
  const values = [
    workTime.activeMissionSeconds,
    workTime.platformControlledWaitingSeconds,
    workTime.requiredRepositionSeconds,
    workTime.otherPaidSeconds,
    workTime.excludedSeconds,
  ];
  values.forEach((value, index) =>
    assertNonNegativeSafeInteger(value, `workTime[${index}]`),
  );
  return (
    workTime.activeMissionSeconds +
    workTime.platformControlledWaitingSeconds +
    workTime.requiredRepositionSeconds +
    workTime.otherPaidSeconds
  );
}

export function paidSeconds(
  workTime: WorkTimeBreakdown,
  policy: CountryPayPolicy,
): number {
  mobilizedSeconds(workTime);
  let total = 0;
  if (policy.paidTimeRules.activeMission) total += workTime.activeMissionSeconds;
  if (policy.paidTimeRules.platformControlledWaiting) {
    total += workTime.platformControlledWaitingSeconds;
  }
  if (policy.paidTimeRules.requiredReposition) {
    total += workTime.requiredRepositionSeconds;
  }
  if (policy.paidTimeRules.otherPaid) total += workTime.otherPaidSeconds;
  return total;
}

export function assertProductionPolicy(policy: CountryPayPolicy): void {
  if (
    policy.validationStatus !== 'GREEN' ||
    !policy.productionActivationAllowed ||
    !policy.effectiveFrom
  ) {
    throw new Error('COURIER_PAYROLL_COUNTRY_POLICY_NOT_GREEN');
  }
}

export function computeFairPay(
  input: WeeklyCourierPayInput,
  policy: CountryPayPolicy,
  mode: PayrollExecutionMode = 'LAB',
): FairPayComputation {
  assertRequiredText(input.courierId, 'courierId');
  assertRequiredText(input.weekKey, 'weekKey');
  assertRequiredText(policy.policyId, 'policyId');

  [
    ['eligibleIncomeCents', input.eligibleIncomeCents],
    ['tipsCents', input.tipsCents],
    ['expenseReimbursementsCents', input.expenseReimbursementsCents],
  ].forEach(([field, value]) =>
    assertNonNegativeSafeInteger(value as number, field as string),
  );

  if (mode === 'PRODUCTION') assertProductionPolicy(policy);

  const paid = paidSeconds(input.workTime, policy);
  const mobilized = mobilizedSeconds(input.workTime);
  const active = input.workTime.activeMissionSeconds;
  const utilizationRatio = mobilized === 0 ? 0 : active / mobilized;

  const legalFloorCents = centsForSeconds(
    paid,
    policy.legalFloorCentsPerPaidHour,
  );
  const pogFairnessFloorCents = centsForSeconds(
    paid,
    policy.pogFairnessFloorCentsPerPaidHour,
  );
  let activityGuaranteeSeconds: number | null = null;
  let activityGuaranteeFloorCents = 0;
  if (policy.weeklyActivityGuarantee) {
    if (input.activityGuaranteeSeconds == null) {
      throw new Error('COURIER_PAYROLL_ACTIVITY_GUARANTEE_DURATION_REQUIRED');
    }
    assertNonNegativeSafeInteger(
      input.activityGuaranteeSeconds,
      'activityGuaranteeSeconds',
    );
    activityGuaranteeSeconds = input.activityGuaranteeSeconds;
    activityGuaranteeFloorCents = centsForSeconds(
      activityGuaranteeSeconds,
      policy.weeklyActivityGuarantee.rateCentsPerHour,
    );
  }

  const governingFloorCents = Math.max(
    legalFloorCents,
    pogFairnessFloorCents,
    activityGuaranteeFloorCents,
  );
  const differentialDueCents = Math.max(
    0,
    governingFloorCents - input.eligibleIncomeCents,
  );
  const grossPayDueCents = input.eligibleIncomeCents + differentialDueCents;
  const totalCashDueCents =
    grossPayDueCents + input.tipsCents + input.expenseReimbursementsCents;

  const warnings: string[] = [];
  if (policy.validationStatus !== 'GREEN') {
    warnings.push('COUNTRY_POLICY_NOT_LEGALLY_GREEN');
  }
  if (policy.legalFloorCentsPerPaidHour == null) {
    warnings.push('LEGAL_FLOOR_NOT_CONFIGURED');
  }
  if (mobilized > 0 && utilizationRatio < 0.7) {
    warnings.push('LOW_UTILIZATION_IS_POG_ZONE_RISK_NOT_COURIER_DEBT');
  }

  return {
    courierId: input.courierId,
    weekKey: input.weekKey,
    policyId: policy.policyId,
    workerStatus: policy.workerStatus,
    paidSeconds: paid,
    mobilizedSeconds: mobilized,
    activeMissionSeconds: active,
    activityGuaranteeSeconds,
    utilizationRatio,
    legalFloorCents,
    pogFairnessFloorCents,
    activityGuaranteeFloorCents,
    governingFloorCents,
    eligibleIncomeCents: input.eligibleIncomeCents,
    differentialDueCents,
    grossPayDueCents,
    tipsPassThroughCents: input.tipsCents,
    expenseReimbursementsCents: input.expenseReimbursementsCents,
    totalCashDueCents,
    differentialPaymentDelayDays:
      policy.weeklyActivityGuarantee?.differentialPaymentDelayDays ?? null,
    productionEligible:
      policy.validationStatus === 'GREEN' &&
      policy.productionActivationAllowed &&
      Boolean(policy.effectiveFrom),
    warnings,
  };
}
