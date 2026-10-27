import { equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { createFranceIndependentReferencePolicy } from './adapters/france';
import { computeFairPay } from './fair-pay-kernel';
import { simulateZoneViability } from './zone-viability';

test('Belgium employee lab pays controlled waiting and repositioning', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const result = computeFairPay({
    courierId: 'be-1',
    weekKey: '2026-W44',
    workTime: {
      activeMissionSeconds: 3 * 3600,
      platformControlledWaitingSeconds: 3600,
      requiredRepositionSeconds: 1800,
      otherPaidSeconds: 1800,
      excludedSeconds: 0,
    },
    eligibleIncomeCents: 9000,
    tipsCents: 1200,
    expenseReimbursementsCents: 800,
  }, policy);

  equal(result.paidSeconds, 5 * 3600);
  equal(result.pogFairnessFloorCents, 9500);
  equal(result.differentialDueCents, 500);
  equal(result.grossPayDueCents, 9500);
  equal(result.totalCashDueCents, 11500);
  equal(result.utilizationRatio, 0.6);
  ok(result.warnings.includes('LOW_UTILIZATION_IS_POG_ZONE_RISK_NOT_COURIER_DEBT'));
});

test('legal floor overrides POG floor when higher', () => {
  const policy = createBelgiumEmployeeLabPolicy({
    legalFloorCentsPerPaidHour: 2200,
    pogFairnessFloorCentsPerPaidHour: 1900,
  });
  const result = computeFairPay({
    courierId: 'be-2',
    weekKey: '2026-W44',
    workTime: {
      activeMissionSeconds: 3600,
      platformControlledWaitingSeconds: 0,
      requiredRepositionSeconds: 0,
      otherPaidSeconds: 0,
      excludedSeconds: 0,
    },
    eligibleIncomeCents: 1900,
    tipsCents: 0,
    expenseReimbursementsCents: 0,
  }, policy);

  equal(result.legalFloorCents, 2200);
  equal(result.governingFloorCents, 2200);
  equal(result.differentialDueCents, 300);
});

test('tips and expenses never satisfy a pay floor', () => {
  const result = computeFairPay({
    courierId: 'be-3',
    weekKey: '2026-W44',
    workTime: {
      activeMissionSeconds: 3600,
      platformControlledWaitingSeconds: 0,
      requiredRepositionSeconds: 0,
      otherPaidSeconds: 0,
      excludedSeconds: 0,
    },
    eligibleIncomeCents: 1500,
    tipsCents: 1000,
    expenseReimbursementsCents: 500,
  }, createBelgiumEmployeeLabPolicy());

  equal(result.differentialDueCents, 400);
  equal(result.grossPayDueCents, 1900);
  equal(result.totalCashDueCents, 3400);
});

test('France reference adapter keeps 19 EUR activity guarantee separate', () => {
  const result = computeFairPay({
    courierId: 'fr-1',
    weekKey: '2026-W44',
    workTime: {
      activeMissionSeconds: 3600,
      platformControlledWaitingSeconds: 1800,
      requiredRepositionSeconds: 0,
      otherPaidSeconds: 0,
      excludedSeconds: 0,
    },
    eligibleIncomeCents: 1800,
    tipsCents: 700,
    expenseReimbursementsCents: 0,
  }, createFranceIndependentReferencePolicy());

  equal(result.activityGuaranteeFloorCents, 1900);
  equal(result.differentialDueCents, 100);
  equal(result.differentialPaymentDelayDays, 7);
});

test('draft policy cannot execute production payroll', () => {
  throws(() => computeFairPay({
    courierId: 'be-4',
    weekKey: '2026-W44',
    workTime: {
      activeMissionSeconds: 3600,
      platformControlledWaitingSeconds: 0,
      requiredRepositionSeconds: 0,
      otherPaidSeconds: 0,
      excludedSeconds: 0,
    },
    eligibleIncomeCents: 1900,
    tipsCents: 0,
    expenseReimbursementsCents: 0,
  }, createBelgiumEmployeeLabPolicy(), 'PRODUCTION'), /NOT_GREEN/);
});

test('zone loss is borne by POG and never changes courier pay', () => {
  const zone = simulateZoneViability({
    zoneId: 'BRU-LAB-A',
    paidHours: 10,
    activeMissionHours: 6,
    deliveries: 18,
    employerCostPerPaidHourCents: 3000,
    contributionBeforeCourierCentsPerDelivery: 1200,
  });

  equal(zone.workerPayProtected, true);
  equal(zone.viableAtCurrentDensity, false);
  ok(zone.warnings.includes('ZONE_ECONOMICS_NEGATIVE_POG_ABSORBS_SHORTFALL'));
  equal(Number(zone.breakEvenDeliveriesPerPaidHour?.toFixed(2)), 2.5);
});

test('zone becomes viable above break-even density', () => {
  const zone = simulateZoneViability({
    zoneId: 'BRU-LAB-B',
    paidHours: 10,
    activeMissionHours: 8,
    deliveries: 30,
    employerCostPerPaidHourCents: 3000,
    contributionBeforeCourierCentsPerDelivery: 1200,
  });

  equal(zone.deliveriesPerPaidHour, 3);
  equal(zone.viableAtCurrentDensity, true);
  equal(zone.residualContributionCents, 6000);
});
