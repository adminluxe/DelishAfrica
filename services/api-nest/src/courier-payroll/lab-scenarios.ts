import { simulateZoneViability } from './zone-viability';

export interface BelgiumLabScenario {
  name: 'LOW' | 'BASE' | 'HIGH';
  paidHours: number;
  activeMissionHours: number;
  deliveries: number;
}

export const BELGIUM_LAB_ASSUMPTIONS = {
  employerCostPerPaidHourCents: 3000,
  contributionBeforeCourierCentsPerDelivery: 1200,
  targetResidualContributionCentsPerDelivery: 200,
} as const;

export const BELGIUM_LAB_SCENARIOS: BelgiumLabScenario[] = [
  { name: 'LOW', paidHours: 10, activeMissionHours: 5, deliveries: 15 },
  { name: 'BASE', paidHours: 10, activeMissionHours: 7.5, deliveries: 25 },
  { name: 'HIGH', paidHours: 10, activeMissionHours: 8.5, deliveries: 30 },
];

export function runBelgiumLabScenarios() {
  return BELGIUM_LAB_SCENARIOS.map((scenario) => ({
    scenario: scenario.name,
    ...simulateZoneViability({
      zoneId: `BRU-LAB-${scenario.name}`,
      paidHours: scenario.paidHours,
      activeMissionHours: scenario.activeMissionHours,
      deliveries: scenario.deliveries,
      ...BELGIUM_LAB_ASSUMPTIONS,
    }),
  }));
}

if (require.main === module) {
  process.stdout.write(JSON.stringify({
    assumptions: BELGIUM_LAB_ASSUMPTIONS,
    results: runBelgiumLabScenarios(),
  }, null, 2) + '\n');
}
