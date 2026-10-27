export interface PayrollInstrumentationCoverage {
  signal: string;
  currentSource: string | null;
  currentField: string | null;
  requiredFor: string[];
  status: 'AVAILABLE' | 'PARTIAL' | 'MISSING';
  note: string;
}

export const COURIER_PAYROLL_INSTRUMENTATION_COVERAGE: PayrollInstrumentationCoverage[] = [
  {
    signal: 'missionAcceptedAt',
    currentSource: 'API canonical order / assignment',
    currentField: 'timestamps.acceptedAt / assignment acceptedAt',
    requiredFor: ['mission lifecycle', 'France activity guarantee'],
    status: 'AVAILABLE',
    note: 'Existing acceptedAt signal is present in order/dispatch code.',
  },
  {
    signal: 'merchantReadyAt',
    currentSource: 'API canonical order',
    currentField: 'timestamps.readyAt / status=ready',
    requiredFor: ['merchant readiness KPI', 'waiting diagnosis'],
    status: 'AVAILABLE',
    note: 'readyAt is present in the canonical order contract, but runtime population must be audited.',
  },
  {
    signal: 'courierArrivedPickupAt',
    currentSource: 'Courier Mission Live + server dispatch LAB path',
    currentField: 'order.courierArrivedPickupAt',
    requiredFor: ['platform-controlled waiting', 'merchant SLA', 'fair paid-time classification'],
    status: 'PARTIAL',
    note: 'Explicit human confirmation, assigned-courier guard, idempotence and dual feature flags are implemented in the LAB branch. Full Courier typecheck/build and device E2E remain required.',
  },
  {
    signal: 'pickedUpAt',
    currentSource: 'API canonical order',
    currentField: 'timestamps.pickedUpAt / assignment.pickedUpAt',
    requiredFor: ['waiting end', 'mission lifecycle'],
    status: 'AVAILABLE',
    note: 'Existing canonical field.',
  },
  {
    signal: 'deliveredAt',
    currentSource: 'API canonical order',
    currentField: 'timestamps.deliveredAt / assignment.deliveredAt',
    requiredFor: ['active mission end', 'France activity guarantee'],
    status: 'AVAILABLE',
    note: 'Existing canonical field.',
  },
  {
    signal: 'requiredRepositionStartedAt/EndedAt',
    currentSource: null,
    currentField: null,
    requiredFor: ['employee paid-time', 'empty km/time KPI'],
    status: 'MISSING',
    note: 'Must only exist when POG requires a repositioning instruction.',
  },
  {
    signal: 'otherPaidWorkStartedAt/EndedAt',
    currentSource: null,
    currentField: null,
    requiredFor: ['employee paid-time'],
    status: 'MISSING',
    note: 'Future explicit OPS/employee work event.',
  },
  {
    signal: 'eligibleIncomeCredit',
    currentSource: 'Courier payroll money-fact builder',
    currentField: 'ELIGIBLE_INCOME',
    requiredFor: ['weekly payroll input', 'true-up'],
    status: 'PARTIAL',
    note: 'Evidence-backed builder is implemented. The legally validated mapping from real payroll/payment components is still OPEN.',
  },
  {
    signal: 'tipCredit',
    currentSource: 'payment/order domain + Courier payroll money-fact builder',
    currentField: 'TIP',
    requiredFor: ['courier statement', 'tips pass-through'],
    status: 'PARTIAL',
    note: 'Evidence-backed canonical TIP fact builder exists; production payment-domain mapping remains to be wired and certified.',
  },
  {
    signal: 'expenseReimbursementCredit',
    currentSource: 'Courier payroll money-fact builder',
    currentField: 'EXPENSE_REIMBURSEMENT',
    requiredFor: ['courier statement', 'work-cost separation'],
    status: 'PARTIAL',
    note: 'Evidence-backed builder exists. The Belgium expense policy and runtime reimbursement workflow remain OPEN.',
  },
];

export function payrollInstrumentationGate() {
  const missing = COURIER_PAYROLL_INSTRUMENTATION_COVERAGE.filter(
    (item) => item.status === 'MISSING',
  );
  const partial = COURIER_PAYROLL_INSTRUMENTATION_COVERAGE.filter(
    (item) => item.status === 'PARTIAL',
  );
  return {
    green: missing.length === 0 && partial.length === 0,
    available: COURIER_PAYROLL_INSTRUMENTATION_COVERAGE.filter(
      (item) => item.status === 'AVAILABLE',
    ).map((item) => item.signal),
    partial: partial.map((item) => item.signal),
    missing: missing.map((item) => item.signal),
  };
}
