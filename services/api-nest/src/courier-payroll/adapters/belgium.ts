import { CountryPayPolicy } from '../courier-payroll.types';

export interface BelgiumEmployeeLabPolicyOptions {
  legalFloorCentsPerPaidHour?: number | null;
  pogFairnessFloorCentsPerPaidHour?: number;
}

export function createBelgiumEmployeeLabPolicy(
  options: BelgiumEmployeeLabPolicyOptions = {},
): CountryPayPolicy {
  return {
    policyId: 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1',
    countryCode: 'BE',
    currency: 'EUR',
    workerStatus: 'EMPLOYEE',
    validationStatus: 'DRAFT',
    effectiveFrom: null,
    legalFloorCentsPerPaidHour:
      options.legalFloorCentsPerPaidHour ?? null,
    pogFairnessFloorCentsPerPaidHour:
      options.pogFairnessFloorCentsPerPaidHour ?? 1900,
    paidTimeRules: {
      activeMission: true,
      platformControlledWaiting: true,
      requiredReposition: true,
      otherPaid: true,
    },
    weeklyActivityGuarantee: null,
    tipsPassThrough: true,
    tipsExcludedFromFloors: true,
    expenseReimbursementsExcludedFromFloors: true,
    productionActivationAllowed: false,
    notes: [
      'LAB ONLY: 19 EUR/hour is a POG fairness hypothesis, not a Belgian legal rate.',
      'Legal floor remains unset until the competent Belgian joint committee/CBA and worker classification are validated.',
      'POG lab principle: platform-controlled waiting and required repositioning are not pushed onto the courier as unpaid zone risk.',
      'Production must remain blocked until Belgian legal review is GREEN.',
    ],
  };
}
