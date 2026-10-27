export interface OperationalDensityInput {
  baseTravelAndHandlingMinutesPerDelivery: number;
  merchantWaitMinutesPerDelivery: number;
  batchEfficiencyMultiplier?: number;
}

export interface OperationalDensityResult {
  cycleMinutesPerDelivery: number;
  batchEfficiencyMultiplier: number;
  deliveriesPerPaidHour: number;
}

function positive(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`COURIER_DENSITY_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function nonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`COURIER_DENSITY_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function estimateOperationalDensity(
  input: OperationalDensityInput,
): OperationalDensityResult {
  const baseMinutes = positive(
    input.baseTravelAndHandlingMinutesPerDelivery,
    'baseTravelAndHandlingMinutesPerDelivery',
  );
  const waitMinutes = nonNegative(
    input.merchantWaitMinutesPerDelivery,
    'merchantWaitMinutesPerDelivery',
  );
  const batchEfficiencyMultiplier = positive(
    input.batchEfficiencyMultiplier ?? 1,
    'batchEfficiencyMultiplier',
  );

  const cycleMinutesPerDelivery = baseMinutes + waitMinutes;
  const deliveriesPerPaidHour =
    (60 / cycleMinutesPerDelivery) * batchEfficiencyMultiplier;

  return {
    cycleMinutesPerDelivery,
    batchEfficiencyMultiplier,
    deliveriesPerPaidHour,
  };
}
