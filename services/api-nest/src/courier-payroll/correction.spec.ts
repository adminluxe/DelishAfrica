import { equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { isCourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { computeFairPay } from './fair-pay-kernel';
import { projectWeeklyPayrollInput } from './payroll-projector';
import { sealCountryPayPolicy } from './policy-ledger';
import { buildCourierWeeklyStatement } from './weekly-statement';

const common = {
  courierId: 'courier-correction-1',
  countryCode: 'BE',
  weekKey: '2026-W44',
  policyId: 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1',
} as const;

function baseFacts(): CourierPayrollFact[] {
  return [
    {
      ...common,
      factId: 'time-1',
      kind: 'TIME',
      category: 'ACTIVE_MISSION',
      source: 'PAYROLL_NORMALIZER',
      recordedAt: '2026-10-27T10:00:00.000Z',
      startedAt: '2026-10-27T08:00:00.000Z',
      endedAt: '2026-10-27T09:00:00.000Z',
      evidenceRefs: ['mission-event-1', 'mission-event-2'],
    },
    {
      ...common,
      factId: 'income-original',
      kind: 'MONEY',
      category: 'ELIGIBLE_INCOME',
      source: 'PAYMENTS',
      recordedAt: '2026-10-27T10:00:00.000Z',
      amountMinor: 1700,
      currency: 'EUR',
      evidenceRefs: ['payment-original'],
    },
  ];
}

function correctedIncome(amountMinor = 1850): CourierPayrollFact {
  return {
    ...common,
    factId: 'income-correction-1',
    kind: 'MONEY',
    category: 'ELIGIBLE_INCOME',
    source: 'PAYMENTS',
    recordedAt: '2026-10-27T12:00:00.000Z',
    amountMinor,
    currency: 'EUR',
    supersedesFactId: 'income-original',
    correction: {
      reasonCode: 'PAYMENT_RECONCILIATION',
      reason: 'Montant éligible corrigé après rapprochement.',
      approvedAt: '2026-10-27T11:30:00.000Z',
      approvedBy: 'payroll-reviewer-lab',
    },
    evidenceRefs: ['payment-original', 'reconciliation-1'],
  };
}

test('append-only correction replaces amount without double counting', () => {
  const facts = [...baseFacts(), correctedIncome()];
  const projected = projectWeeklyPayrollInput(
    facts,
    createBelgiumEmployeeLabPolicy(),
  );
  equal(projected.input.eligibleIncomeCents, 1850);
  equal(projected.factCount, 3);
  equal(projected.effectiveFactCount, 2);
  equal(projected.supersededFactIds.join(','), 'income-original');
  ok(projected.effectiveFactIds.includes('income-correction-1'));
  ok(!projected.effectiveFactIds.includes('income-original'));

  const pay = computeFairPay(
    projected.input,
    createBelgiumEmployeeLabPolicy(),
  );
  equal(pay.governingFloorCents, 1900);
  equal(pay.differentialDueCents, 50);
});

test('statement preserves original and corrected fact audit trail', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const sealed = sealCountryPayPolicy(
    policy,
    '2026-10-27T12:30:00.000Z',
    'pog-correction-lab',
  );
  const statement = buildCourierWeeklyStatement(
    [...baseFacts(), correctedIncome()],
    sealed,
  );
  equal(statement.statementVersion, 'COURIER_WEEKLY_STATEMENT_V0.2');
  equal(statement.factCount, 3);
  equal(statement.effectiveFactCount, 2);
  equal(statement.supersededFactIds[0], 'income-original');
  equal(statement.explanation.eligibleIncomeCents, 1850);
});

test('correction requires approval metadata and evidence', () => {
  const invalid = correctedIncome() as any;
  delete invalid.correction;
  equal(isCourierPayrollFact(invalid), false);

  const noEvidence = correctedIncome() as any;
  noEvidence.evidenceRefs = [];
  equal(isCourierPayrollFact(noEvidence), false);
});

test('two competing corrections of the same fact are rejected', () => {
  const second = {
    ...(correctedIncome(1800) as any),
    factId: 'income-correction-2',
    recordedAt: '2026-10-27T13:00:00.000Z',
    correction: {
      reasonCode: 'SECOND_REVIEW',
      reason: 'Deuxième correction concurrente.',
      approvedAt: '2026-10-27T12:30:00.000Z',
      approvedBy: 'reviewer-2',
    },
  };
  throws(
    () =>
      projectWeeklyPayrollInput(
        [...baseFacts(), correctedIncome(), second],
        createBelgiumEmployeeLabPolicy(),
      ),
    /TARGET_ALREADY_SUPERSEDED/,
  );
});

test('correction cannot target a missing or incompatible fact', () => {
  const missing = {
    ...(correctedIncome() as any),
    supersedesFactId: 'does-not-exist',
  };
  throws(
    () =>
      projectWeeklyPayrollInput(
        [...baseFacts(), missing],
        createBelgiumEmployeeLabPolicy(),
      ),
    /TARGET_MISSING/,
  );

  const wrongCategory = {
    ...(correctedIncome() as any),
    factId: 'tip-correction',
    category: 'TIP',
  };
  throws(
    () =>
      projectWeeklyPayrollInput(
        [...baseFacts(), wrongCategory],
        createBelgiumEmployeeLabPolicy(),
      ),
    /TYPE_MISMATCH/,
  );
});
