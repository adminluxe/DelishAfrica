import { equal, ok } from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CourierPayrollRuntimeBridge } from './runtime-bridge.service';

const POLICY_ID = 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1';

function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => T,
): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function completeOrder() {
  return {
    id: 'order-runtime-1',
    partnerSlug: 'merchant-runtime-1',
    status: 'delivered',
    assignmentProposal: {
      courierId: 'courier-runtime-1',
      status: 'accepted',
      acceptedAt: '2026-10-27T08:00:00.000Z',
    },
    readyAt: '2026-10-27T08:10:00.000Z',
    courierArrivedPickupAt: '2026-10-27T08:20:00.000Z',
    pickedUpAt: '2026-10-27T08:30:00.000Z',
    deliveredAt: '2026-10-27T09:00:00.000Z',
  };
}

test('runtime bridge is a no-op when Fair Pay Lab flag is disabled', () => {
  withEnv(
    {
      DA_COURIER_FAIR_PAY_LAB_ENABLED: undefined,
      DA_COURIER_FAIR_PAY_COUNTRY_CODE: undefined,
      DA_COURIER_FAIR_PAY_POLICY_ID: undefined,
      DA_COURIER_FAIR_PAY_LAB_LEDGER_DIR: undefined,
    },
    () => {
      const bridge = new CourierPayrollRuntimeBridge();
      const result = bridge.captureOrder(completeOrder());
      equal(result.enabled, false);
      equal(result.ok, true);
      equal(result.recorded, 0);
    },
  );
});

test('runtime bridge captures stable events idempotently when lab is enabled', () => {
  const root = mkdtempSync(join(tmpdir(), 'da-runtime-bridge-'));
  try {
    withEnv(
      {
        DA_COURIER_FAIR_PAY_LAB_ENABLED: 'true',
        DA_COURIER_FAIR_PAY_COUNTRY_CODE: 'BE',
        DA_COURIER_FAIR_PAY_POLICY_ID: POLICY_ID,
        DA_COURIER_FAIR_PAY_LAB_LEDGER_DIR: root,
      },
      () => {
        const bridge = new CourierPayrollRuntimeBridge();
        const first = bridge.captureOrder(completeOrder());
        equal(first.enabled, true);
        equal(first.ok, true);
        equal(first.recorded, 5);
        ok(first.normalization?.complete);

        const replay = bridge.captureOrder(completeOrder());
        equal(replay.enabled, true);
        equal(replay.ok, true);
        equal(replay.recorded, 0);
        equal(replay.replayed, 5);
        ok(replay.normalization?.complete);

        const status = bridge.status();
        equal(status.enabled, true);
        equal(status.productionWiring, false);
        equal(status.countryCode, 'BE');
        equal(status.policyId, POLICY_ID);
        equal(status.counts?.policies, 1);
        equal(status.counts?.clockEvents, 5);
        equal(status.counts?.facts, 3);
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime bridge contains lab errors instead of breaking order flow', () => {
  const root = mkdtempSync(join(tmpdir(), 'da-runtime-bridge-error-'));
  try {
    withEnv(
      {
        DA_COURIER_FAIR_PAY_LAB_ENABLED: 'true',
        DA_COURIER_FAIR_PAY_COUNTRY_CODE: 'BE',
        DA_COURIER_FAIR_PAY_POLICY_ID: 'UNKNOWN-POLICY',
        DA_COURIER_FAIR_PAY_LAB_LEDGER_DIR: root,
      },
      () => {
        const bridge = new CourierPayrollRuntimeBridge();
        const result = bridge.captureOrder(completeOrder());
        equal(result.enabled, true);
        equal(result.ok, false);
        equal(result.recorded, 0);
        ok(String(result.error).includes('UNKNOWN_POLICY'));
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
