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
    currentSource: null,
    currentField: null,
    requiredFor: ['platform-controlled waiting', 'merchant SLA', 'fair paid-time classification'],
    status: 'MISSING',
    note: 'Must be instrumented explicitly. Never infer it from acceptedAt or readyAt.',
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
    currentSource: null,
    currentField: null,
    requiredFor: ['weekly payroll input', 'true-up'],
    status: 'MISSING',
    note: 'Needs a legally validated mapping from payroll/ledger components.',
  },
  {
    signal: 'tipCredit',
    currentSource: 'payment/order domain',
    currentField: null,
    requiredFor: ['courier statement', 'tips pass-through'],
    status: 'PARTIAL',
    note: 'Domain/payment plumbing exists, but canonical Courier payroll fact mapping is not yet established.',
  },
  {
    signal: 'expenseReimbursementCredit',
    currentSource: null,
    currentField: null,
    requiredFor: ['courier statement', 'work-cost separation'],
    status: 'MISSING',
    note: 'Requires approved expense policy and evidence workflow.',
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
