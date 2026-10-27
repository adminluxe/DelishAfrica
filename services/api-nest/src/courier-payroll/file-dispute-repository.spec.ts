import { equal, ok, throws } from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  disputeIdFor,
  FileCourierPayrollDisputeStore,
} from './file-dispute-repository';

function withStore<T>(fn: (root: string, store: FileCourierPayrollDisputeStore) => T): T {
  const root = mkdtempSync(join(tmpdir(), 'da-payroll-disputes-'));
  try {
    return fn(root, new FileCourierPayrollDisputeStore(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const openInput = {
  statementId: 'a'.repeat(64),
  courierId: 'courier-dispute-1',
  weekKey: '2026-W44',
  policyId: 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1',
  actorSubject: 'courier-dispute-1',
  reasonCode: 'TIME_REVIEW_REQUESTED',
  note: 'Je souhaite vérifier le temps d’attente enregistré.',
  evidenceRefs: ['statement:' + 'a'.repeat(64)],
  occurredAt: '2026-10-27T13:00:00.000Z',
};

test('dispute opens idempotently and persists privately across restart', () => {
  withStore((root, store) => {
    const first = store.open(openInput);
    const replay = store.open(openInput);
    equal(first.idempotentReplay, false);
    equal(replay.idempotentReplay, true);
    equal(first.dispute.disputeId, disputeIdFor(openInput.statementId, openInput.courierId));
    equal(first.dispute.status, 'OPEN');

    equal(statSync(root).mode & 0o777, 0o700);
    equal(statSync(join(root, 'disputes.ndjson')).mode & 0o777, 0o600);

    const reopened = new FileCourierPayrollDisputeStore(root);
    const persisted = reopened.get(first.dispute.disputeId);
    equal(persisted?.status, 'OPEN');
    equal(persisted?.history.length, 1);
  });
});

test('OPS review is append-only and resolution cannot be rewritten', () => {
  withStore((_root, store) => {
    const opened = store.open(openInput).dispute;
    const reviewing = store.review({
      disputeId: opened.disputeId,
      eventType: 'REVIEW_STARTED',
      actorSubject: 'ops-reviewer-1',
      reasonCode: 'REVIEW_ACCEPTED',
      note: 'Dossier pris en charge.',
      evidenceRefs: ['ops-case:1'],
      occurredAt: '2026-10-27T13:10:00.000Z',
    });
    equal(reviewing.status, 'UNDER_REVIEW');
    equal(reviewing.history.length, 2);

    const resolved = store.review({
      disputeId: opened.disputeId,
      eventType: 'RESOLVED_CORRECTION_REQUIRED',
      actorSubject: 'ops-reviewer-1',
      reasonCode: 'WAITING_TIME_CORRECTION_REQUIRED',
      note: 'Une correction append-only doit être créée.',
      evidenceRefs: ['ops-case:1', 'evidence:merchant-ready-time'],
      occurredAt: '2026-10-27T13:20:00.000Z',
    });
    equal(resolved.status, 'RESOLVED_CORRECTION_REQUIRED');
    equal(resolved.history.length, 3);

    throws(
      () =>
        store.review({
          disputeId: opened.disputeId,
          eventType: 'RESOLVED_NO_CHANGE',
          actorSubject: 'ops-reviewer-2',
          reasonCode: 'SECOND_DECISION',
          note: 'Doit être refusé.',
          evidenceRefs: ['ops-case:2'],
          occurredAt: '2026-10-27T13:30:00.000Z',
        }),
      /ALREADY_RESOLVED/,
    );
  });
});

test('disputes stay courier-scoped in list views', () => {
  withStore((_root, store) => {
    store.open(openInput);
    store.open({
      ...openInput,
      statementId: 'b'.repeat(64),
      courierId: 'courier-dispute-2',
      actorSubject: 'courier-dispute-2',
      evidenceRefs: ['statement:' + 'b'.repeat(64)],
    });
    equal(store.listForCourier('courier-dispute-1').length, 1);
    equal(store.listForCourier('courier-dispute-2').length, 1);
    equal(store.listForCourier('courier-other').length, 0);
    equal(store.listAll().length, 2);
  });
});

test('dispute file tampering is detected', () => {
  withStore((root, store) => {
    store.open(openInput);
    const file = join(root, 'disputes.ndjson');
    const line = JSON.parse(readFileSync(file, 'utf8').trim());
    line.value.note = 'tampered';
    writeFileSync(file, JSON.stringify(line) + '\n', 'utf8');
    throws(
      () => new FileCourierPayrollDisputeStore(root),
      /FILE_INTEGRITY/,
    );
  });
});

test('dispute requires evidence and monotonic human-review timeline', () => {
  withStore((_root, store) => {
    throws(
      () =>
        store.open({
          ...openInput,
          evidenceRefs: [],
        }),
      /EVIDENCE_REQUIRED/,
    );

    const opened = store.open(openInput).dispute;
    throws(
      () =>
        store.review({
          disputeId: opened.disputeId,
          eventType: 'REVIEW_STARTED',
          actorSubject: 'ops-reviewer-1',
          reasonCode: 'REVIEW_ACCEPTED',
          note: 'Backdated review must fail.',
          evidenceRefs: ['ops-case:1'],
          occurredAt: '2026-10-27T12:59:00.000Z',
        }),
      /TIME_REGRESSION/,
    );
  });
});
