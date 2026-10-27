import { equal, throws } from 'node:assert/strict';
import { test } from 'node:test';
import { computeEmployerCost } from './employer-cost';

test('Belgium employer-cost engine keeps 24.92% base contribution explicit', () => {
  const result = computeEmployerCost({
    grossHourlyCents: 1900,
    employerSocialContributionRateBps: 2492,
  });
  equal(result.grossHourlyCents, 1900);
  equal(result.employerSocialContributionCents, 474);
  equal(result.fullyLoadedEmployerCostCentsPerPaidHour, 2374);
});

test('employer-cost engine layers known costs and reductions without hiding them', () => {
  const result = computeEmployerCost({
    grossHourlyCents: 1900,
    employerSocialContributionRateBps: 2492,
    paidHolidayLoadRateBps: 1000,
    sectorFundRateBps: 200,
    insuranceCentsPerPaidHour: 40,
    equipmentCentsPerPaidHour: 70,
    preventionCentsPerPaidHour: 20,
    payrollAdminCentsPerPaidHour: 25,
    benefitsCentsPerPaidHour: 120,
    otherCentsPerPaidHour: 30,
    reductionsCentsPerPaidHour: 50,
  });
  equal(result.employerSocialContributionCents, 474);
  equal(result.paidHolidayLoadCents, 190);
  equal(result.sectorFundCents, 38);
  equal(result.fullyLoadedEmployerCostCentsPerPaidHour, 2857);
});

test('employer-cost engine rejects negative hidden adjustments', () => {
  throws(
    () =>
      computeEmployerCost({
        grossHourlyCents: 1900,
        employerSocialContributionRateBps: 2492,
        otherCentsPerPaidHour: -1,
      }),
    /INVALID_OTHERCENTSPERPAIDHOUR/,
  );
});
