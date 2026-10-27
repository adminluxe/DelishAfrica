export const FRANCE_COURIER_MIN_ACTIVITY_RATE_CENTS_PER_HOUR = 1900;
export const FRANCE_COURIER_DIFFERENTIAL_PAYMENT_DELAY_DAYS = 7;
export const FRANCE_COURIER_GUARANTEE_VERSION = 'FR-ARPE-2026-09-01-v1';

export interface FranceCourierActivityRecord {
  courierId: string;
  missionId: string;
  weekKey: string;
  estimatedActivitySeconds: number;
  activityIncomeCents: number;
  tipsCents?: number;
}

export interface FranceCourierWeeklyGuaranteeResult {
  courierId: string;
  weekKey: string;
  coveredMissionCount: number;
  coveredActivitySeconds: number;
  coveredIncomeCents: number;
  tipsExcludedCents: number;
  minimumGuaranteedIncomeCents: number;
  differentialDueCents: number;
  guaranteeSatisfied: boolean;
  calculationVersion: string;
  differentialPaymentDelayDays: number;
}

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`FRANCE_COURIER_GUARANTEE_INVALID_${field.toUpperCase()}`);
  }
}

function assertRequiredText(value: string, field: string): void {
  if (!String(value || '').trim()) {
    throw new Error(`FRANCE_COURIER_GUARANTEE_INVALID_${field.toUpperCase()}`);
  }
}

export function minimumGuaranteedIncomeCents(
  coveredActivitySeconds: number,
): number {
  assertNonNegativeSafeInteger(coveredActivitySeconds, 'coveredActivitySeconds');

  if (coveredActivitySeconds === 0) return 0;

  return Math.ceil(
    (coveredActivitySeconds * FRANCE_COURIER_MIN_ACTIVITY_RATE_CENTS_PER_HOUR) /
      3600,
  );
}

export function computeFranceCourierWeeklyGuarantee(
  records: FranceCourierActivityRecord[],
): FranceCourierWeeklyGuaranteeResult {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('FRANCE_COURIER_GUARANTEE_EMPTY_WEEK');
  }

  const courierId = String(records[0].courierId || '').trim();
  const weekKey = String(records[0].weekKey || '').trim();
  assertRequiredText(courierId, 'courierId');
  assertRequiredText(weekKey, 'weekKey');

  let coveredActivitySeconds = 0;
  let coveredIncomeCents = 0;
  let tipsExcludedCents = 0;

  for (const record of records) {
    assertRequiredText(record.courierId, 'courierId');
    assertRequiredText(record.missionId, 'missionId');
    assertRequiredText(record.weekKey, 'weekKey');

    if (String(record.courierId).trim() !== courierId) {
      throw new Error('FRANCE_COURIER_GUARANTEE_MIXED_COURIERS');
    }
    if (String(record.weekKey).trim() !== weekKey) {
      throw new Error('FRANCE_COURIER_GUARANTEE_MIXED_WEEKS');
    }

    assertNonNegativeSafeInteger(
      record.estimatedActivitySeconds,
      'estimatedActivitySeconds',
    );
    assertNonNegativeSafeInteger(record.activityIncomeCents, 'activityIncomeCents');

    const tipsCents = record.tipsCents ?? 0;
    assertNonNegativeSafeInteger(tipsCents, 'tipsCents');

    coveredActivitySeconds += record.estimatedActivitySeconds;
    coveredIncomeCents += record.activityIncomeCents;
    tipsExcludedCents += tipsCents;

    if (
      !Number.isSafeInteger(coveredActivitySeconds) ||
      !Number.isSafeInteger(coveredIncomeCents) ||
      !Number.isSafeInteger(tipsExcludedCents)
    ) {
      throw new Error('FRANCE_COURIER_GUARANTEE_TOTAL_OVERFLOW');
    }
  }

  const minimumGuaranteedIncome =
    minimumGuaranteedIncomeCents(coveredActivitySeconds);
  const differentialDueCents = Math.max(
    0,
    minimumGuaranteedIncome - coveredIncomeCents,
  );

  return {
    courierId,
    weekKey,
    coveredMissionCount: records.length,
    coveredActivitySeconds,
    coveredIncomeCents,
    tipsExcludedCents,
    minimumGuaranteedIncomeCents: minimumGuaranteedIncome,
    differentialDueCents,
    guaranteeSatisfied: differentialDueCents === 0,
    calculationVersion: FRANCE_COURIER_GUARANTEE_VERSION,
    differentialPaymentDelayDays:
      FRANCE_COURIER_DIFFERENTIAL_PAYMENT_DELAY_DAYS,
  };
}

export function computeFranceCourierWeeklyGuarantees(
  records: FranceCourierActivityRecord[],
): FranceCourierWeeklyGuaranteeResult[] {
  const grouped = new Map<string, FranceCourierActivityRecord[]>();

  for (const record of records) {
    assertRequiredText(record.courierId, 'courierId');
    assertRequiredText(record.weekKey, 'weekKey');
    const key = `${String(record.courierId).trim()}::${String(record.weekKey).trim()}`;
    const bucket = grouped.get(key) || [];
    bucket.push(record);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.values())
    .map((bucket) => computeFranceCourierWeeklyGuarantee(bucket))
    .sort((a, b) =>
      a.weekKey === b.weekKey
        ? a.courierId.localeCompare(b.courierId)
        : a.weekKey.localeCompare(b.weekKey),
    );
}
