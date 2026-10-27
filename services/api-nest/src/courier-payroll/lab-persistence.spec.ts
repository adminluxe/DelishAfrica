import { equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { InMemoryCourierPayrollLedger } from './lab-ledger-repository';
import { runCourierFairPayLabPipeline } from './lab-pipeline';
import { sealCountryPayPolicy } from './policy-ledger';
import {
  buildCanonicalOrderClockEvents,
  buildCourierPickupArrivalEvent,
  recordLabClockEvents,
} from './runtime-producer-adapters';

function orderFixture() {
  return {
    identity: { id: 'order-1', publicId: 'public-1', correlationId: 'corr-1' },
    restaurant: { id: 'merchant-1', name: 'Merchant Lab' },
    assignment: { courierId: 'courier-1' },
    timestamps: {
      createdAt: '2026-10-27T07:45:00.000Z',
      updatedAt: '2026-10-27T09:00:00.000Z',
      acceptedAt: '2026-10-27T08:00:00.000Z',
      readyAt: '2026-10-27T08:10:00.000Z',
      pickedUpAt: '2026-10-27T08:30:00.000Z',
      deliveredAt: '2026-10-27T09:00:00.000Z',
    },
  } as any;
}

const context = {
  countryCode: 'BE',
  weekKey: '2026-W44',
  policyId: 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1',
  courierId: 'courier-1',
  missionId: 'mission-1',
};

function moneyFacts(): CourierPayrollFact[] {
  const base = {
    courierId: 'courier-1',
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId: context.policyId,
    recordedAt: '2026-10-27T12:00:00.000Z',
  } as const;
  return [
    { ...base, factId:'income-1', kind:'MONEY', category:'ELIGIBLE_INCOME', source:'PAYMENTS', amountMinor:1700, currency:'EUR' },
    { ...base, factId:'tip-1', kind:'MONEY', category:'TIP', source:'PAYMENTS', amountMinor:500, currency:'EUR' },
    { ...base, factId:'expense-1', kind:'MONEY', category:'EXPENSE_REIMBURSEMENT', source:'OPS', amountMinor:300, currency:'EUR' },
  ];
}

test('canonical order producer generates stable API clock events', () => {
  const a = buildCanonicalOrderClockEvents(orderFixture(), context);
  const b = buildCanonicalOrderClockEvents(orderFixture(), context);
  equal(a.length, 4);
  equal(JSON.stringify(a), JSON.stringify(b));
  equal(a[0].eventType, 'MISSION_ACCEPTED');
  equal(a[1].eventType, 'MERCHANT_READY');
  equal(a[2].eventType, 'PICKED_UP');
  equal(a[3].eventType, 'DELIVERED');
});

test('lab clock recording is disabled unless explicitly enabled', () => {
  const ledger = new InMemoryCourierPayrollLedger();
  const events = buildCanonicalOrderClockEvents(orderFixture(), context);
  throws(
    () => recordLabClockEvents(ledger, events, {}),
    /COURIER_FAIR_PAY_LAB_DISABLED/,
  );
  const written = recordLabClockEvents(ledger, events, {
    DA_COURIER_FAIR_PAY_LAB_ENABLED: 'true',
  });
  equal(written.filter((x) => x.inserted).length, 4);
});

test('append-only ledger is idempotent and rejects same-ID mutation', () => {
  const ledger = new InMemoryCourierPayrollLedger();
  const event = buildCanonicalOrderClockEvents(orderFixture(), context)[0];
  equal(ledger.appendClockEvent(event).inserted, true);
  equal(ledger.appendClockEvent(event).idempotentReplay, true);
  throws(
    () => ledger.appendClockEvent({ ...event, occurredAt:'2026-10-27T08:01:00.000Z' }),
    /CLOCK_EVENT_ID_CONFLICT/,
  );
});

test('complete lab pipeline produces one deterministic statement', () => {
  const ledger = new InMemoryCourierPayrollLedger();
  const policy = sealCountryPayPolicy(
    createBelgiumEmployeeLabPolicy(),
    '2026-10-27T12:30:00.000Z',
    'pog-lab',
  );
  const events = buildCanonicalOrderClockEvents(orderFixture(), context);
  events.push(buildCourierPickupArrivalEvent({
    ...context,
    orderId:'order-1',
    merchantId:'merchant-1',
    missionId:'mission-1',
    courierId:'courier-1',
    occurredAt:'2026-10-27T08:20:00.000Z',
  }));

  const first = runCourierFairPayLabPipeline(ledger, {
    sealedPolicy: policy,
    courierId:'courier-1',
    weekKey:'2026-W44',
    clockEvents:events,
    monetaryFacts:moneyFacts(),
    env:{ DA_COURIER_FAIR_PAY_LAB_ENABLED:'true' },
  });
  equal(first.finalizable, true);
  if (!first.finalizable) throw new Error('expected finalizable');
  equal(first.statement.explanation.paidSeconds, 3600);
  equal(first.statement.explanation.waitingSeconds, 600);
  equal(first.statement.explanation.governingFloorCents, 1900);
  equal(first.statement.explanation.differentialDueCents, 200);
  equal(first.statement.explanation.totalCashDueCents, 2700);

  const second = runCourierFairPayLabPipeline(ledger, {
    sealedPolicy: policy,
    courierId:'courier-1',
    weekKey:'2026-W44',
    clockEvents:events,
    monetaryFacts:moneyFacts(),
    env:{ DA_COURIER_FAIR_PAY_LAB_ENABLED:'true' },
  });
  equal(second.finalizable, true);
  if (!second.finalizable) throw new Error('expected finalizable');
  equal(second.statement.statementId, first.statement.statementId);
  equal(second.statementPersistence.idempotentReplay, true);
  ok(second.normalization.idempotentFactReplays > 0);
  equal(ledger.counts().statements, 1);
});

test('incomplete mission pipeline refuses statement finalization', () => {
  const ledger = new InMemoryCourierPayrollLedger();
  const policy = sealCountryPayPolicy(
    createBelgiumEmployeeLabPolicy(),
    '2026-10-27T12:30:00.000Z',
    'pog-lab',
  );
  const result = runCourierFairPayLabPipeline(ledger, {
    sealedPolicy: policy,
    courierId:'courier-1',
    weekKey:'2026-W44',
    clockEvents:buildCanonicalOrderClockEvents(orderFixture(), context),
    monetaryFacts:moneyFacts(),
    env:{ DA_COURIER_FAIR_PAY_LAB_ENABLED:'true' },
  });
  equal(result.finalizable, false);
  if (result.finalizable) throw new Error('expected incomplete');
  equal(result.statement, null);
  ok(result.normalization.incompleteMissions[0].missingSignals.includes('PICKUP_ARRIVED'));
});
