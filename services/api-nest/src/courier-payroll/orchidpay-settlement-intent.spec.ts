import { equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { sealCountryPayPolicy } from './policy-ledger';
import { buildCourierWeeklyStatement } from './weekly-statement';
import { buildOrchidPayCourierSettlementIntent } from './orchidpay-settlement-intent';

function facts(policyId: string): CourierPayrollFact[] {
  const base = {
    courierId: 'be-orchidpay-1',
    countryCode: 'BE',
    weekKey: '2026-W44',
    policyId,
    recordedAt: '2026-10-27T12:00:00.000Z',
  } as const;
  return [
    {
      ...base,
      factId: 'time-1',
      kind: 'TIME',
      category: 'ACTIVE_MISSION',
      source: 'API_ORDER',
      startedAt: '2026-10-27T08:00:00.000Z',
      endedAt: '2026-10-27T09:00:00.000Z',
    },
    {
      ...base,
      factId: 'income-1',
      kind: 'MONEY',
      category: 'ELIGIBLE_INCOME',
      source: 'PAYMENTS',
      amountMinor: 1800,
      currency: 'EUR',
    },
    {
      ...base,
      factId: 'tip-1',
      kind: 'MONEY',
      category: 'TIP',
      source: 'PAYMENTS',
      amountMinor: 500,
      currency: 'EUR',
    },
    {
      ...base,
      factId: 'expense-1',
      kind: 'MONEY',
      category: 'EXPENSE_REIMBURSEMENT',
      source: 'OPS',
      amountMinor: 300,
      currency: 'EUR',
    },
  ];
}

test('Delish statement maps deterministically to OrchidPay shadow intent', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const sealed = sealCountryPayPolicy(
    policy,
    '2026-10-27T11:00:00.000Z',
    'fair-pay-lab',
  );
  const statement = buildCourierWeeklyStatement(
    facts(policy.policyId),
    sealed,
  );
  const intent = buildOrchidPayCourierSettlementIntent(
    statement,
    sealed,
    '2026-10-27T12:30:00.000Z',
  );

  equal(intent.mode, 'SHADOW');
  equal(intent.source_system, 'DELISHAFRICA_COURIER_FAIR_PAY');
  equal(intent.statement_id, statement.statementId);
  equal(intent.policy_hash, sealed.policyHash);
  equal(intent.facts_hash, statement.factsHash);
  equal(intent.policy_validation_status, 'DRAFT');
  equal(intent.production_eligible, false);
  equal(intent.eligible_income_minor, 1800);
  equal(intent.governing_floor_minor, 1900);
  equal(intent.differential_due_minor, 100);
  equal(intent.gross_pay_due_minor, 1900);
  equal(intent.tips_minor, 500);
  equal(intent.expense_reimbursements_minor, 300);
  equal(intent.total_cash_due_minor, 2700);
  equal(intent.evidence_refs.length, 3);
  ok(intent.evidence_refs[0].startsWith('facts:'));
});

test('OrchidPay intent builder rejects policy mismatch and naive time', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const sealed = sealCountryPayPolicy(
    policy,
    '2026-10-27T11:00:00.000Z',
    'fair-pay-lab',
  );
  const statement = buildCourierWeeklyStatement(
    facts(policy.policyId),
    sealed,
  );
  const mutated = {
    ...sealed,
    policyHash: '0'.repeat(64),
  };
  throws(
    () => buildOrchidPayCourierSettlementIntent(
      statement,
      mutated,
      '2026-10-27T12:30:00.000Z',
    ),
    /HASH_MISMATCH/,
  );
  throws(
    () => buildOrchidPayCourierSettlementIntent(
      statement,
      sealed,
      '2026-10-27T12:30:00',
    ),
    /GENERATED_AT_INVALID/,
  );
});
