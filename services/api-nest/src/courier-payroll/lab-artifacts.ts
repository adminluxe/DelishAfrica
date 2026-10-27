import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { createFranceIndependentReferencePolicy } from './adapters/france';
import { payrollInstrumentationGate } from './instrumentation-coverage';
import { sealCountryPayPolicy } from './policy-ledger';
import { normalizeMissionPayrollTelemetry, normalizePaidWorkSegments } from './telemetry-normalizer';
import { buildCourierWeeklyStatement } from './weekly-statement';

const sealedAt = '2026-10-27T12:30:00.000Z';
const sealedBy = 'pog-courier-fair-pay-lab';

const belgium = sealCountryPayPolicy(
  createBelgiumEmployeeLabPolicy(),
  sealedAt,
  sealedBy,
);
const france = sealCountryPayPolicy(
  createFranceIndependentReferencePolicy(),
  sealedAt,
  sealedBy,
);

function event(
  eventId: string,
  eventType: CourierPayrollClockEvent['eventType'],
  occurredAt: string,
  source: CourierPayrollClockEvent['source'],
  extra: Partial<CourierPayrollClockEvent> = {},
): CourierPayrollClockEvent {
  return {
    eventId,
    eventType,
    courierId: 'be-lab-example-1',
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId: belgium.policy.policyId,
    source,
    occurredAt,
    ...extra,
  };
}

const missionEvents: CourierPayrollClockEvent[] = [
  event('m1-accepted', 'MISSION_ACCEPTED', '2026-10-27T08:00:00.000Z', 'API_ORDER', {
    orderId: 'order-lab-1', missionId: 'mission-lab-1', merchantId: 'merchant-lab-1',
  }),
  event('m1-ready', 'MERCHANT_READY', '2026-10-27T08:10:00.000Z', 'MERCHANT_APP', {
    orderId: 'order-lab-1', missionId: 'mission-lab-1', merchantId: 'merchant-lab-1',
  }),
  event('m1-arrived', 'PICKUP_ARRIVED', '2026-10-27T08:20:00.000Z', 'COURIER_APP', {
    orderId: 'order-lab-1', missionId: 'mission-lab-1', merchantId: 'merchant-lab-1',
  }),
  event('m1-picked', 'PICKED_UP', '2026-10-27T08:30:00.000Z', 'API_ORDER', {
    orderId: 'order-lab-1', missionId: 'mission-lab-1', merchantId: 'merchant-lab-1',
  }),
  event('m1-delivered', 'DELIVERED', '2026-10-27T09:00:00.000Z', 'API_ORDER', {
    orderId: 'order-lab-1', missionId: 'mission-lab-1', merchantId: 'merchant-lab-1',
  }),
];

const segmentEvents: CourierPayrollClockEvent[] = [
  event('r1-start', 'REPOSITION_STARTED', '2026-10-27T09:00:00.000Z', 'OPS', { segmentId: 'reposition-lab-1' }),
  event('r1-end', 'REPOSITION_ENDED', '2026-10-27T09:15:00.000Z', 'COURIER_APP', { segmentId: 'reposition-lab-1' }),
  event('w1-start', 'OTHER_PAID_STARTED', '2026-10-27T09:15:00.000Z', 'OPS', { segmentId: 'other-paid-lab-1' }),
  event('w1-end', 'OTHER_PAID_ENDED', '2026-10-27T09:30:00.000Z', 'OPS', { segmentId: 'other-paid-lab-1' }),
];

const mission = normalizeMissionPayrollTelemetry(missionEvents);
const segments = normalizePaidWorkSegments(segmentEvents);

const monetaryFacts: CourierPayrollFact[] = [
  {
    factId: 'income-lab-1',
    kind: 'MONEY',
    category: 'ELIGIBLE_INCOME',
    courierId: 'be-lab-example-1',
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId: belgium.policy.policyId,
    source: 'PAYMENTS',
    recordedAt: '2026-10-27T12:00:00.000Z',
    amountMinor: 2600,
    currency: 'EUR',
  },
  {
    factId: 'tip-lab-1',
    kind: 'MONEY',
    category: 'TIP',
    courierId: 'be-lab-example-1',
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId: belgium.policy.policyId,
    source: 'PAYMENTS',
    recordedAt: '2026-10-27T12:00:00.000Z',
    amountMinor: 500,
    currency: 'EUR',
  },
  {
    factId: 'expense-lab-1',
    kind: 'MONEY',
    category: 'EXPENSE_REIMBURSEMENT',
    courierId: 'be-lab-example-1',
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId: belgium.policy.policyId,
    source: 'OPS',
    recordedAt: '2026-10-27T12:00:00.000Z',
    amountMinor: 300,
    currency: 'EUR',
  },
];

const facts = [...mission.facts, ...segments.facts, ...monetaryFacts];
const statement = buildCourierWeeklyStatement(facts, belgium);

process.stdout.write(
  JSON.stringify(
    {
      policyLedger: [belgium, france],
      instrumentationGate: payrollInstrumentationGate(),
      belgiumExample: {
        missionDiagnostics: mission.diagnostics,
        facts,
        statement,
      },
    },
    null,
    2,
  ) + '\n',
);
