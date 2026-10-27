export interface EmployerCostInput {
  grossHourlyCents: number;
  employerSocialContributionRateBps: number;
  paidHolidayLoadRateBps?: number;
  sectorFundRateBps?: number;
  insuranceCentsPerPaidHour?: number;
  equipmentCentsPerPaidHour?: number;
  preventionCentsPerPaidHour?: number;
  payrollAdminCentsPerPaidHour?: number;
  benefitsCentsPerPaidHour?: number;
  otherCentsPerPaidHour?: number;
  reductionsCentsPerPaidHour?: number;
}

export interface EmployerCostBreakdown {
  grossHourlyCents: number;
  employerSocialContributionCents: number;
  paidHolidayLoadCents: number;
  sectorFundCents: number;
  insuranceCents: number;
  equipmentCents: number;
  preventionCents: number;
  payrollAdminCents: number;
  benefitsCents: number;
  otherCents: number;
  reductionsCents: number;
  fullyLoadedEmployerCostCentsPerPaidHour: number;
}

function nonNegativeInteger(value: number | undefined, field: string): number {
  const normalized = value ?? 0;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`EMPLOYER_COST_INVALID_${field.toUpperCase()}`);
  }
  return normalized;
}

function rateCost(baseCents: number, bps: number): number {
  return Math.ceil((baseCents * bps) / 10_000);
}

export function computeEmployerCost(
  input: EmployerCostInput,
): EmployerCostBreakdown {
  const grossHourlyCents = nonNegativeInteger(
    input.grossHourlyCents,
    'grossHourlyCents',
  );
  const employerSocialContributionRateBps = nonNegativeInteger(
    input.employerSocialContributionRateBps,
    'employerSocialContributionRateBps',
  );
  const paidHolidayLoadRateBps = nonNegativeInteger(
    input.paidHolidayLoadRateBps,
    'paidHolidayLoadRateBps',
  );
  const sectorFundRateBps = nonNegativeInteger(
    input.sectorFundRateBps,
    'sectorFundRateBps',
  );

  const employerSocialContributionCents = rateCost(
    grossHourlyCents,
    employerSocialContributionRateBps,
  );
  const paidHolidayLoadCents = rateCost(
    grossHourlyCents,
    paidHolidayLoadRateBps,
  );
  const sectorFundCents = rateCost(grossHourlyCents, sectorFundRateBps);

  const insuranceCents = nonNegativeInteger(
    input.insuranceCentsPerPaidHour,
    'insuranceCentsPerPaidHour',
  );
  const equipmentCents = nonNegativeInteger(
    input.equipmentCentsPerPaidHour,
    'equipmentCentsPerPaidHour',
  );
  const preventionCents = nonNegativeInteger(
    input.preventionCentsPerPaidHour,
    'preventionCentsPerPaidHour',
  );
  const payrollAdminCents = nonNegativeInteger(
    input.payrollAdminCentsPerPaidHour,
    'payrollAdminCentsPerPaidHour',
  );
  const benefitsCents = nonNegativeInteger(
    input.benefitsCentsPerPaidHour,
    'benefitsCentsPerPaidHour',
  );
  const otherCents = nonNegativeInteger(
    input.otherCentsPerPaidHour,
    'otherCentsPerPaidHour',
  );
  const reductionsCents = nonNegativeInteger(
    input.reductionsCentsPerPaidHour,
    'reductionsCentsPerPaidHour',
  );

  const beforeReductions =
    grossHourlyCents +
    employerSocialContributionCents +
    paidHolidayLoadCents +
    sectorFundCents +
    insuranceCents +
    equipmentCents +
    preventionCents +
    payrollAdminCents +
    benefitsCents +
    otherCents;

  return {
    grossHourlyCents,
    employerSocialContributionCents,
    paidHolidayLoadCents,
    sectorFundCents,
    insuranceCents,
    equipmentCents,
    preventionCents,
    payrollAdminCents,
    benefitsCents,
    otherCents,
    reductionsCents,
    fullyLoadedEmployerCostCentsPerPaidHour: Math.max(
      0,
      beforeReductions - reductionsCents,
    ),
  };
}
