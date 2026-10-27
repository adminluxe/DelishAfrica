import { estimateOperationalDensity } from './operational-density';

export interface BelgiumEconomicsSensitivityRow {
  employerCostPerPaidHourCents: number;
  contributionBeforeCourierCentsPerDelivery: number;
  targetResidualContributionCentsPerDelivery: number;
  breakEvenDeliveriesPerPaidHour: number | null;
  targetDeliveriesPerPaidHour: number | null;
}

export interface BelgiumOperationsSensitivityRow {
  baseTravelAndHandlingMinutesPerDelivery: number;
  merchantWaitMinutesPerDelivery: number;
  batchEfficiencyMultiplier: number;
  deliveriesPerPaidHour: number;
  employerCostPerPaidHourCents: number;
  contributionBeforeCourierCentsPerDelivery: number;
  residualContributionPerPaidHourCents: number;
}

export function runBelgiumEconomicsSensitivity(): BelgiumEconomicsSensitivityRow[] {
  const employerCosts = [2600, 2800, 3000, 3200, 3400];
  const contributions = [900, 1000, 1100, 1200, 1300, 1400];
  const targetResidualContributionCentsPerDelivery = 200;
  const rows: BelgiumEconomicsSensitivityRow[] = [];

  for (const employerCostPerPaidHourCents of employerCosts) {
    for (const contributionBeforeCourierCentsPerDelivery of contributions) {
      const breakEvenDeliveriesPerPaidHour =
        contributionBeforeCourierCentsPerDelivery === 0
          ? null
          : employerCostPerPaidHourCents /
            contributionBeforeCourierCentsPerDelivery;
      const residualCapacity =
        contributionBeforeCourierCentsPerDelivery -
        targetResidualContributionCentsPerDelivery;
      const targetDeliveriesPerPaidHour =
        residualCapacity <= 0
          ? null
          : employerCostPerPaidHourCents / residualCapacity;

      rows.push({
        employerCostPerPaidHourCents,
        contributionBeforeCourierCentsPerDelivery,
        targetResidualContributionCentsPerDelivery,
        breakEvenDeliveriesPerPaidHour,
        targetDeliveriesPerPaidHour,
      });
    }
  }

  return rows;
}

export function runBelgiumOperationsSensitivity(): BelgiumOperationsSensitivityRow[] {
  const baseMinutes = [15, 17, 20];
  const waitMinutes = [0, 3, 6, 9, 12];
  const batchMultipliers = [1, 1.1, 1.2];
  const employerCostPerPaidHourCents = 3000;
  const contributionBeforeCourierCentsPerDelivery = 1200;
  const rows: BelgiumOperationsSensitivityRow[] = [];

  for (const baseTravelAndHandlingMinutesPerDelivery of baseMinutes) {
    for (const merchantWaitMinutesPerDelivery of waitMinutes) {
      for (const batchEfficiencyMultiplier of batchMultipliers) {
        const density = estimateOperationalDensity({
          baseTravelAndHandlingMinutesPerDelivery,
          merchantWaitMinutesPerDelivery,
          batchEfficiencyMultiplier,
        }).deliveriesPerPaidHour;

        rows.push({
          baseTravelAndHandlingMinutesPerDelivery,
          merchantWaitMinutesPerDelivery,
          batchEfficiencyMultiplier,
          deliveriesPerPaidHour: density,
          employerCostPerPaidHourCents,
          contributionBeforeCourierCentsPerDelivery,
          residualContributionPerPaidHourCents:
            density * contributionBeforeCourierCentsPerDelivery -
            employerCostPerPaidHourCents,
        });
      }
    }
  }

  return rows;
}

if (require.main === module) {
  process.stdout.write(
    JSON.stringify(
      {
        economics: runBelgiumEconomicsSensitivity(),
        operations: runBelgiumOperationsSensitivity(),
      },
      null,
      2,
    ) + '\n',
  );
}
