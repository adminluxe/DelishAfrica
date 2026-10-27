export type CourierWorkerStatus = 'EMPLOYEE' | 'INDEPENDENT';
export type PolicyValidationStatus = 'DRAFT' | 'LEGAL_REVIEW' | 'GREEN';
export type PayrollExecutionMode = 'LAB' | 'PRODUCTION';

export interface WorkTimeBreakdown {
  activeMissionSeconds: number;
  platformControlledWaitingSeconds: number;
  requiredRepositionSeconds: number;
  otherPaidSeconds: number;
  excludedSeconds: number;
}

export interface PaidTimeRules {
  activeMission: boolean;
  platformControlledWaiting: boolean;
  requiredReposition: boolean;
  otherPaid: boolean;
}

export interface WeeklyActivityGuaranteePolicy {
  rateCentsPerHour: number;
  differentialPaymentDelayDays: number;
  calculationVersion: string;
}

export interface CountryPayPolicy {
  policyId: string;
  countryCode: string;
  currency: string;
  workerStatus: CourierWorkerStatus;
  validationStatus: PolicyValidationStatus;
  effectiveFrom: string | null;
  legalFloorCentsPerPaidHour: number | null;
  pogFairnessFloorCentsPerPaidHour: number | null;
  paidTimeRules: PaidTimeRules;
  weeklyActivityGuarantee: WeeklyActivityGuaranteePolicy | null;
  tipsPassThrough: true;
  tipsExcludedFromFloors: true;
  expenseReimbursementsExcludedFromFloors: true;
  productionActivationAllowed: boolean;
  notes: string[];
}

export interface WeeklyCourierPayInput {
  courierId: string;
  weekKey: string;
  workTime: WorkTimeBreakdown;
  eligibleIncomeCents: number;
  tipsCents: number;
  expenseReimbursementsCents: number;
}

export interface FairPayComputation {
  courierId: string;
  weekKey: string;
  policyId: string;
  workerStatus: CourierWorkerStatus;
  paidSeconds: number;
  mobilizedSeconds: number;
  activeMissionSeconds: number;
  utilizationRatio: number;
  legalFloorCents: number;
  pogFairnessFloorCents: number;
  activityGuaranteeFloorCents: number;
  governingFloorCents: number;
  eligibleIncomeCents: number;
  differentialDueCents: number;
  grossPayDueCents: number;
  tipsPassThroughCents: number;
  expenseReimbursementsCents: number;
  totalCashDueCents: number;
  differentialPaymentDelayDays: number | null;
  productionEligible: boolean;
  warnings: string[];
}

export interface ZoneViabilityInput {
  zoneId: string;
  paidHours: number;
  activeMissionHours: number;
  deliveries: number;
  employerCostPerPaidHourCents: number;
  contributionBeforeCourierCentsPerDelivery: number;
  fixedZoneCostCents?: number;
  targetResidualContributionCentsPerDelivery?: number;
}

export interface ZoneViabilityResult {
  zoneId: string;
  paidHours: number;
  deliveries: number;
  deliveriesPerPaidHour: number;
  utilizationRatio: number;
  totalEmployerCourierCostCents: number;
  courierCostPerDeliveryCents: number;
  grossContributionBeforeCourierCents: number;
  fixedZoneCostCents: number;
  residualContributionCents: number;
  residualContributionPerDeliveryCents: number;
  breakEvenDeliveriesPerPaidHour: number | null;
  targetDeliveriesPerPaidHour: number | null;
  viableAtCurrentDensity: boolean;
  workerPayProtected: true;
  warnings: string[];
}
