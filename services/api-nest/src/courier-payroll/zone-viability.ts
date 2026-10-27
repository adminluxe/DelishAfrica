import {
  ZoneViabilityInput,
  ZoneViabilityResult,
} from './courier-payroll.types';

function finiteNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`COURIER_VIABILITY_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

export function simulateZoneViability(
  input: ZoneViabilityInput,
): ZoneViabilityResult {
  const paidHours = finiteNonNegative(input.paidHours, 'paidHours');
  const activeMissionHours = finiteNonNegative(
    input.activeMissionHours,
    'activeMissionHours',
  );
  const deliveries = finiteNonNegative(input.deliveries, 'deliveries');
  const employerCostPerPaidHourCents = finiteNonNegative(
    input.employerCostPerPaidHourCents,
    'employerCostPerPaidHourCents',
  );
  const contributionBeforeCourierCentsPerDelivery = finiteNonNegative(
    input.contributionBeforeCourierCentsPerDelivery,
    'contributionBeforeCourierCentsPerDelivery',
  );
  const fixedZoneCostCents = finiteNonNegative(
    input.fixedZoneCostCents ?? 0,
    'fixedZoneCostCents',
  );
  const targetResidual = finiteNonNegative(
    input.targetResidualContributionCentsPerDelivery ?? 0,
    'targetResidualContributionCentsPerDelivery',
  );

  if (activeMissionHours > paidHours) {
    throw new Error('COURIER_VIABILITY_ACTIVE_HOURS_EXCEED_PAID_HOURS');
  }

  const deliveriesPerPaidHour = paidHours === 0 ? 0 : deliveries / paidHours;
  const utilizationRatio = paidHours === 0 ? 0 : activeMissionHours / paidHours;
  const totalEmployerCourierCostCents =
    employerCostPerPaidHourCents * paidHours;
  const courierCostPerDeliveryCents =
    deliveries === 0 ? 0 : totalEmployerCourierCostCents / deliveries;
  const grossContributionBeforeCourierCents =
    contributionBeforeCourierCentsPerDelivery * deliveries;
  const residualContributionCents =
    grossContributionBeforeCourierCents -
    totalEmployerCourierCostCents -
    fixedZoneCostCents;
  const residualContributionPerDeliveryCents =
    deliveries === 0 ? 0 : residualContributionCents / deliveries;

  const breakEvenDeliveriesPerPaidHour =
    contributionBeforeCourierCentsPerDelivery === 0
      ? null
      : employerCostPerPaidHourCents /
        contributionBeforeCourierCentsPerDelivery;

  const residualCapacity =
    contributionBeforeCourierCentsPerDelivery - targetResidual;
  const targetDeliveriesPerPaidHour =
    residualCapacity <= 0
      ? null
      : employerCostPerPaidHourCents / residualCapacity;

  const warnings: string[] = [];
  if (utilizationRatio < 0.7 && paidHours > 0) {
    warnings.push('LOW_UTILIZATION_REQUIRES_ZONE_OR_STAFFING_ACTION');
  }
  if (residualContributionCents < 0) {
    warnings.push('ZONE_ECONOMICS_NEGATIVE_POG_ABSORBS_SHORTFALL');
  }
  if (
    breakEvenDeliveriesPerPaidHour != null &&
    deliveriesPerPaidHour < breakEvenDeliveriesPerPaidHour
  ) {
    warnings.push('DENSITY_BELOW_BREAK_EVEN');
  }

  return {
    zoneId: input.zoneId,
    paidHours,
    deliveries,
    deliveriesPerPaidHour,
    utilizationRatio,
    totalEmployerCourierCostCents,
    courierCostPerDeliveryCents,
    grossContributionBeforeCourierCents,
    fixedZoneCostCents,
    residualContributionCents,
    residualContributionPerDeliveryCents,
    breakEvenDeliveriesPerPaidHour,
    targetDeliveriesPerPaidHour,
    viableAtCurrentDensity: residualContributionCents >= 0,
    workerPayProtected: true,
    warnings,
  };
}
