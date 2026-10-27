import { equal, throws } from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildEligibleIncomeCredit,
  buildExpenseReimbursementCredit,
  buildTipCredit,
} from './money-facts';

const base = {
  factId: 'money-1',
  courierId: 'courier-1',
  countryCode: 'be',
  weekKey: '2026-W44',
  policyId: 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1',
  recordedAt: '2026-10-27T12:00:00.000Z',
  amountMinor: 1234,
  currency: 'eur',
  evidenceRefs: ['payment-1', 'order-1', 'payment-1'],
};

test('eligible income credit is normalized and evidence is deduplicated', () => {
  const fact = buildEligibleIncomeCredit(base);
  equal(fact.category, 'ELIGIBLE_INCOME');
  equal(fact.source, 'PAYMENTS');
  equal(fact.countryCode, 'BE');
  equal(fact.currency, 'EUR');
  equal(fact.evidenceRefs?.join(','), 'order-1,payment-1');
});

test('tip and expense builders keep categories separate', () => {
  equal(buildTipCredit(base).category, 'TIP');
  equal(buildTipCredit(base).source, 'PAYMENTS');
  equal(buildExpenseReimbursementCredit(base).category, 'EXPENSE_REIMBURSEMENT');
  equal(buildExpenseReimbursementCredit(base).source, 'OPS');
});

test('money credits cannot be negative or unsupported by evidence', () => {
  throws(
    () => buildEligibleIncomeCredit({ ...base, amountMinor: -1 }),
    /MONEY_AMOUNT_INVALID/,
  );
  throws(
    () => buildEligibleIncomeCredit({ ...base, evidenceRefs: [] }),
    /MONEY_EVIDENCE_REQUIRED/,
  );
});
