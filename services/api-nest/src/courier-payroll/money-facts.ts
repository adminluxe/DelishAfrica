import type {
  CourierPayrollFactSource,
  CourierPayrollMoneyCategory,
  CourierPayrollMoneyFact,
} from '../../../../packages/contracts/src/courier-payroll';

export interface CourierPayrollMoneyCreditInput {
  factId: string;
  courierId: string;
  countryCode: string;
  weekKey: string;
  policyId: string;
  recordedAt: string;
  amountMinor: number;
  currency: string;
  orderId?: string;
  missionId?: string;
  merchantId?: string;
  evidenceRefs: string[];
}

function buildMoneyFact(
  input: CourierPayrollMoneyCreditInput,
  category: CourierPayrollMoneyCategory,
  source: CourierPayrollFactSource,
): CourierPayrollMoneyFact {
  if (!String(input.factId || '').trim()) {
    throw new Error('COURIER_PAYROLL_MONEY_FACT_ID_REQUIRED');
  }
  if (!String(input.courierId || '').trim()) {
    throw new Error('COURIER_PAYROLL_MONEY_COURIER_REQUIRED');
  }
  if (!String(input.countryCode || '').trim()) {
    throw new Error('COURIER_PAYROLL_MONEY_COUNTRY_REQUIRED');
  }
  if (!String(input.weekKey || '').trim()) {
    throw new Error('COURIER_PAYROLL_MONEY_WEEK_REQUIRED');
  }
  if (!String(input.policyId || '').trim()) {
    throw new Error('COURIER_PAYROLL_MONEY_POLICY_REQUIRED');
  }
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
    throw new Error('COURIER_PAYROLL_MONEY_AMOUNT_INVALID');
  }
  const currency = String(input.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('COURIER_PAYROLL_MONEY_CURRENCY_INVALID');
  }
  if (!Number.isFinite(Date.parse(input.recordedAt))) {
    throw new Error('COURIER_PAYROLL_MONEY_RECORDED_AT_INVALID');
  }
  const evidenceRefs = Array.from(
    new Set((input.evidenceRefs || []).map((x) => String(x).trim()).filter(Boolean)),
  ).sort();
  if (evidenceRefs.length === 0) {
    throw new Error('COURIER_PAYROLL_MONEY_EVIDENCE_REQUIRED');
  }

  return {
    factId: input.factId,
    kind: 'MONEY',
    category,
    source,
    courierId: input.courierId,
    countryCode: input.countryCode.toUpperCase(),
    weekKey: input.weekKey,
    policyId: input.policyId,
    recordedAt: input.recordedAt,
    amountMinor: input.amountMinor,
    currency,
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.missionId ? { missionId: input.missionId } : {}),
    ...(input.merchantId ? { merchantId: input.merchantId } : {}),
    evidenceRefs,
  };
}

export function buildEligibleIncomeCredit(
  input: CourierPayrollMoneyCreditInput,
): CourierPayrollMoneyFact {
  return buildMoneyFact(input, 'ELIGIBLE_INCOME', 'PAYMENTS');
}

export function buildTipCredit(
  input: CourierPayrollMoneyCreditInput,
): CourierPayrollMoneyFact {
  return buildMoneyFact(input, 'TIP', 'PAYMENTS');
}

export function buildExpenseReimbursementCredit(
  input: CourierPayrollMoneyCreditInput,
): CourierPayrollMoneyFact {
  return buildMoneyFact(input, 'EXPENSE_REIMBURSEMENT', 'OPS');
}
