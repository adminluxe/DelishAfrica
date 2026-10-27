import { CountryPayPolicy } from '../courier-payroll.types';

export function createFranceIndependentReferencePolicy(): CountryPayPolicy {
  return {
    policyId: 'FR-INDEPENDENT-ARPE-2026-09-01-v1',
    countryCode: 'FR',
    currency: 'EUR',
    payrollTimeZone: 'Europe/Paris',
    workerStatus: 'INDEPENDENT',
    validationStatus: 'LEGAL_REVIEW',
    effectiveFrom: '2026-09-01',
    legalFloorCentsPerPaidHour: null,
    pogFairnessFloorCentsPerPaidHour: null,
    paidTimeRules: {
      activeMission: true,
      platformControlledWaiting: false,
      requiredReposition: false,
      otherPaid: false,
    },
    weeklyActivityGuarantee: {
      rateCentsPerHour: 1900,
      differentialPaymentDelayDays: 7,
      calculationVersion: 'FR-ARPE-2026-09-01-v1',
    },
    tipsPassThrough: true,
    tipsExcludedFromFloors: true,
    expenseReimbursementsExcludedFromFloors: true,
    productionActivationAllowed: false,
    notes: [
      'Reference adapter for the ARPE weekly activity-income guarantee.',
      'The ARPE guarantee uses an explicit estimated activity duration (activityGuaranteeSeconds), kept separate from actual mission clock time.',
      'Production remains blocked until final legal/data mapping review is GREEN.',
    ],
  };
}
