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


test('explicit reposition and other-paid segments normalize append-only in LAB', () => {
  const root = mkdtempSync(join(tmpdir(), 'da-runtime-explicit-segments-'));
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
        const repositionStart = bridge.recordExplicitPaidSegmentBoundary({
          family: 'REPOSITION',
          boundary: 'STARTED',
          courierId: 'courier-segment-1',
          segmentId: 'repo-1',
          occurredAt: '2026-10-27T10:00:00.000Z',
          evidenceRefs: ['ops-case:repo-1'],
        });
        equal(repositionStart.persistence.inserted, true);
        equal(repositionStart.normalization.complete, false);

        const repositionEnd = bridge.recordExplicitPaidSegmentBoundary({
          family: 'REPOSITION',
          boundary: 'ENDED',
          courierId: 'courier-segment-1',
          segmentId: 'repo-1',
          occurredAt: '2026-10-27T10:15:00.000Z',
          evidenceRefs: ['ops-case:repo-1'],
        });
        equal(repositionEnd.persistence.inserted, true);
        equal(repositionEnd.normalization.complete, true);

        const otherStart = bridge.recordExplicitPaidSegmentBoundary({
          family: 'OTHER_PAID',
          boundary: 'STARTED',
          courierId: 'courier-segment-1',
          segmentId: 'other-1',
          occurredAt: '2026-10-27T10:20:00.000Z',
          evidenceRefs: ['ops-case:other-1'],
        });
        equal(otherStart.normalization.complete, false);
        const otherEnd = bridge.recordExplicitPaidSegmentBoundary({
          family: 'OTHER_PAID',
          boundary: 'ENDED',
          courierId: 'courier-segment-1',
          segmentId: 'other-1',
          occurredAt: '2026-10-27T10:35:00.000Z',
          evidenceRefs: ['ops-case:other-1'],
        });
        equal(otherEnd.normalization.complete, true);

        const replay = bridge.recordExplicitPaidSegmentBoundary({
          family: 'OTHER_PAID',
          boundary: 'ENDED',
          courierId: 'courier-segment-1',
          segmentId: 'other-1',
          occurredAt: '2026-10-27T10:35:00.000Z',
          evidenceRefs: ['ops-case:other-1'],
        });
        equal(replay.persistence.inserted, false);
        equal(replay.persistence.idempotentReplay, true);

        const status = bridge.status();
        equal(status.counts?.clockEvents, 4);
        equal(status.counts?.facts, 2);
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('explicit paid segments require evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'da-runtime-segment-evidence-'));
  try {
    withEnv(
      {
        DA_COURIER_FAIR_PAY_LAB_ENABLED: 'true',
        DA_COURIER_FAIR_PAY_COUNTRY_CODE: 'BE',
        DA_COURIER_FAIR_PAY_POLICY_ID: POLICY_ID,
        DA_COURIER_FAIR_PAY_LAB_LEDGER_DIR: root,
      },
      () => {
        let error = '';
        try {
          new CourierPayrollRuntimeBridge().recordExplicitPaidSegmentBoundary({
            family: 'REPOSITION',
            boundary: 'STARTED',
            courierId: 'courier-segment-2',
            segmentId: 'repo-no-evidence',
            occurredAt: '2026-10-27T10:00:00.000Z',
            evidenceRefs: [],
          });
        } catch (candidate) {
          error = candidate instanceof Error ? candidate.message : String(candidate);
        }
        ok(error.includes('EVIDENCE_REQUIRED'));
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
