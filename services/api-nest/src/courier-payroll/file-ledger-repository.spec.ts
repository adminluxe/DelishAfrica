import { equal, ok, throws } from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { FileCourierPayrollLedger } from './file-ledger-repository';
import { runCourierFairPayLabPipeline } from './lab-pipeline';
import { sealCountryPayPolicy } from './policy-ledger';
import {
  buildCanonicalOrderClockEvents,
  buildCourierPickupArrivalEvent,
} from './runtime-producer-adapters';

function withTempLedger<T>(fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), 'da-fair-pay-ledger-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function fixture() {
  const policy = sealCountryPayPolicy(
    createBelgiumEmployeeLabPolicy(),
    '2026-10-27T12:30:00.000Z',
    'pog-lab',
  );
  const context = {
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId: policy.policy.policyId,
    courierId: 'courier-file-1',
    missionId: 'mission-file-1',
  };
  const order = {
    identity: { id: 'order-file-1', publicId: 'p-file-1', correlationId: 'c-file-1' },
    restaurant: { id: 'merchant-file-1', name: 'Merchant File Lab' },
    assignment: { courierId: context.courierId },
    timestamps: {
      createdAt: '2026-10-27T07:45:00.000Z',
      updatedAt: '2026-10-27T09:00:00.000Z',
      acceptedAt: '2026-10-27T08:00:00.000Z',
      readyAt: '2026-10-27T08:10:00.000Z',
      pickedUpAt: '2026-10-27T08:30:00.000Z',
      deliveredAt: '2026-10-27T09:00:00.000Z',
    },
  } as any;
  const clockEvents = buildCanonicalOrderClockEvents(order, context);
  clockEvents.push(buildCourierPickupArrivalEvent({
    ...context,
    orderId: order.identity.id,
    merchantId: order.restaurant.id,
    courierId: context.courierId,
    missionId: context.missionId,
    occurredAt: '2026-10-27T08:20:00.000Z',
  }));
  const moneyBase = {
    courierId: context.courierId,
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId: policy.policy.policyId,
    recordedAt: '2026-10-27T12:00:00.000Z',
  } as const;
  const monetaryFacts: CourierPayrollFact[] = [
    { ...moneyBase, factId:'income-file-1', kind:'MONEY', category:'ELIGIBLE_INCOME', source:'PAYMENTS', amountMinor:1700, currency:'EUR' },
    { ...moneyBase, factId:'tip-file-1', kind:'MONEY', category:'TIP', source:'PAYMENTS', amountMinor:500, currency:'EUR' },
    { ...moneyBase, factId:'expense-file-1', kind:'MONEY', category:'EXPENSE_REIMBURSEMENT', source:'OPS', amountMinor:300, currency:'EUR' },
  ];
  return { policy, context, clockEvents, monetaryFacts };
}

test('file ledger survives restart and preserves deterministic statement', () => {
  withTempLedger((root) => {
    const x = fixture();
    const firstLedger = new FileCourierPayrollLedger({ rootDir: root });
    const first = runCourierFairPayLabPipeline(firstLedger, {
      sealedPolicy: x.policy,
      courierId: x.context.courierId,
      weekKey: x.context.weekKey,
      clockEvents: x.clockEvents,
      monetaryFacts: x.monetaryFacts,
      env: { DA_COURIER_FAIR_PAY_LAB_ENABLED: 'true' },
    });
    equal(first.finalizable, true);
    if (!first.finalizable) throw new Error('expected finalizable');

    const secondLedger = new FileCourierPayrollLedger({ rootDir: root });
    equal(secondLedger.counts().policies, 1);
    equal(secondLedger.counts().clockEvents, 5);
    equal(secondLedger.counts().facts, 6);
    equal(secondLedger.counts().statements, 1);

    const replay = runCourierFairPayLabPipeline(secondLedger, {
      sealedPolicy: x.policy,
      courierId: x.context.courierId,
      weekKey: x.context.weekKey,
      clockEvents: x.clockEvents,
      monetaryFacts: x.monetaryFacts,
      env: { DA_COURIER_FAIR_PAY_LAB_ENABLED: 'true' },
    });
    equal(replay.finalizable, true);
    if (!replay.finalizable) throw new Error('expected finalizable');
    equal(replay.statement.statementId, first.statement.statementId);
    equal(replay.statementPersistence.idempotentReplay, true);
  });
});

test('file ledger rejects same ID with changed payload after restart', () => {
  withTempLedger((root) => {
    const x = fixture();
    const ledger = new FileCourierPayrollLedger({ rootDir: root });
    ledger.appendClockEvent(x.clockEvents[0]);

    const reopened = new FileCourierPayrollLedger({ rootDir: root });
    throws(
      () => reopened.appendClockEvent({
        ...x.clockEvents[0],
        occurredAt: '2026-10-27T08:01:00.000Z',
      }),
      /CLOCK_EVENT_ID_CONFLICT/,
    );
  });
});

test('file ledger creates private directory and files', () => {
  withTempLedger((root) => {
    const nested = join(root, 'private-ledger');
    const x = fixture();
    const ledger = new FileCourierPayrollLedger({ rootDir: nested });
    ledger.appendPolicy(x.policy);
    equal(statSync(nested).mode & 0o777, 0o700);
    equal(statSync(join(nested, 'policies.ndjson')).mode & 0o777, 0o600);
  });
});

test('file ledger detects persisted hash tampering', () => {
  withTempLedger((root) => {
    const x = fixture();
    const ledger = new FileCourierPayrollLedger({ rootDir: root });
    ledger.appendPolicy(x.policy);
    const file = join(root, 'policies.ndjson');
    const line = JSON.parse(readFileSync(file, 'utf8').trim());
    line.hash = '0'.repeat(64);
    writeFileSync(file, JSON.stringify(line) + '\n', 'utf8');
    throws(
      () => new FileCourierPayrollLedger({ rootDir: root }),
      /FILE_LEDGER_INTEGRITY/,
    );
  });
});
