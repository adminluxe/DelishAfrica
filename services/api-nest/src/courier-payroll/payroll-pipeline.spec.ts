import { equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { isCourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { createBelgiumEmployeeLabPolicy } from './adapters/belgium';
import { payrollInstrumentationGate } from './instrumentation-coverage';
import { estimateOperationalDensity } from './operational-density';
import { assertPolicyTransition, assertSealedPolicyIntegrity, sealCountryPayPolicy } from './policy-ledger';
import { projectWeeklyPayrollInput } from './payroll-projector';
import { buildCourierWeeklyStatement } from './weekly-statement';
import { normalizeMissionPayrollTelemetry, normalizePaidWorkSegments } from './telemetry-normalizer';

const common = {
  courierId: 'be-lab-1',
  countryCode: 'BE',
  weekKey: '2026-W44',
  policyId: 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1',
  recordedAt: '2026-10-27T12:00:00.000Z',
} as const;

function timeFact(factId: string, category: any, start: string, end: string, source: any): CourierPayrollFact {
  return { ...common, factId, kind: 'TIME', category, source, startedAt: start, endedAt: end };
}

function moneyFact(factId: string, category: any, amountMinor: number, source: any): CourierPayrollFact {
  return { ...common, factId, kind: 'MONEY', category, source, amountMinor, currency: 'EUR' };
}

function belgiumFacts(): CourierPayrollFact[] {
  return [
    timeFact('t1', 'ACTIVE_MISSION', '2026-10-27T08:00:00.000Z', '2026-10-27T10:00:00.000Z', 'API_ORDER'),
    timeFact('t2', 'PLATFORM_CONTROLLED_WAITING', '2026-10-27T10:00:00.000Z', '2026-10-27T11:00:00.000Z', 'COURIER_APP'),
    timeFact('t3', 'ACTIVE_MISSION', '2026-10-27T11:00:00.000Z', '2026-10-27T12:00:00.000Z', 'API_ORDER'),
    timeFact('t4', 'REQUIRED_REPOSITION', '2026-10-27T12:00:00.000Z', '2026-10-27T12:30:00.000Z', 'OPS'),
    timeFact('t5', 'OTHER_PAID', '2026-10-27T12:30:00.000Z', '2026-10-27T13:00:00.000Z', 'OPS'),
    moneyFact('m1', 'ELIGIBLE_INCOME', 9000, 'PAYMENTS'),
    moneyFact('m2', 'TIP', 1200, 'PAYMENTS'),
    moneyFact('m3', 'EXPENSE_REIMBURSEMENT', 800, 'OPS'),
  ];
}

test('shared facts validate and project to five paid hours', () => {
  const facts = belgiumFacts();
  facts.forEach((fact) => equal(isCourierPayrollFact(fact), true));
  const p = projectWeeklyPayrollInput(facts, createBelgiumEmployeeLabPolicy());
  equal(p.input.workTime.activeMissionSeconds, 10800);
  equal(p.input.workTime.platformControlledWaitingSeconds, 3600);
  equal(p.input.workTime.requiredRepositionSeconds, 1800);
  equal(p.input.workTime.otherPaidSeconds, 1800);
  equal(p.input.eligibleIncomeCents, 9000);
  equal(p.input.tipsCents, 1200);
  equal(p.input.expenseReimbursementsCents, 800);
});

test('overlapping time facts are rejected instead of double-counted', () => {
  const facts = belgiumFacts();
  facts.push(timeFact('overlap', 'OTHER_PAID', '2026-10-27T09:30:00.000Z', '2026-10-27T10:30:00.000Z', 'OPS'));
  throws(() => projectWeeklyPayrollInput(facts, createBelgiumEmployeeLabPolicy()), /TIME_FACT_OVERLAP/);
});

test('weekly statement is deterministic and keeps tips/expenses additive', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const sealed = sealCountryPayPolicy(policy, '2026-10-27T11:00:00.000Z', 'pog-fair-pay-lab');
  const facts = belgiumFacts();
  const a = buildCourierWeeklyStatement(facts, sealed);
  const b = buildCourierWeeklyStatement([...facts].reverse(), sealed);
  equal(a.statementId, b.statementId);
  equal(a.explanation.paidSeconds, 18000);
  equal(a.explanation.governingFloorCents, 9500);
  equal(a.explanation.differentialDueCents, 500);
  equal(a.explanation.totalCashDueCents, 11500);
  equal(a.contestable, true);
});
test('sealed policy detects mutation and same-version rewrite', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const sealed = sealCountryPayPolicy(policy, '2026-10-27T11:00:00.000Z', 'pog-fair-pay-lab');
  const mutated = JSON.parse(JSON.stringify(sealed));
  mutated.policy.pogFairnessFloorCentsPerPaidHour = 1800;
  throws(() => assertSealedPolicyIntegrity(mutated), /HASH_MISMATCH/);

  const rewritten = sealCountryPayPolicy(
    { ...policy, pogFairnessFloorCentsPerPaidHour: 1800 },
    '2026-10-27T12:00:00.000Z',
    'pog-fair-pay-lab',
  );
  throws(() => assertPolicyTransition(sealed, rewritten), /IMMUTABLE_VERSION_MUTATED/);
});

test('draft policy still cannot build a production statement', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const sealed = sealCountryPayPolicy(policy, '2026-10-27T11:00:00.000Z', 'pog-fair-pay-lab');
  throws(() => buildCourierWeeklyStatement(belgiumFacts(), sealed, 'PRODUCTION'), /COUNTRY_POLICY_NOT_GREEN/);
});

test('instrumentation gate exposes missing payroll signals', () => {
  const gate = payrollInstrumentationGate();
  equal(gate.green, false);
  ok(gate.available.includes('missionAcceptedAt'));
  ok(gate.available.includes('pickedUpAt'));
  ok(gate.partial.includes('courierArrivedPickupAt'));
  ok(gate.partial.includes('eligibleIncomeCredit'));
  ok(gate.partial.includes('tipCredit'));
  ok(gate.partial.includes('expenseReimbursementCredit'));
  ok(gate.missing.includes('requiredRepositionStartedAt/EndedAt'));
});

test('merchant wait and batching materially change density', () => {
  const noWait = estimateOperationalDensity({
    baseTravelAndHandlingMinutesPerDelivery: 15,
    merchantWaitMinutesPerDelivery: 0,
  });
  const tenMinuteWait = estimateOperationalDensity({
    baseTravelAndHandlingMinutesPerDelivery: 15,
    merchantWaitMinutesPerDelivery: 10,
  });
  const batched = estimateOperationalDensity({
    baseTravelAndHandlingMinutesPerDelivery: 15,
    merchantWaitMinutesPerDelivery: 5,
    batchEfficiencyMultiplier: 1.2,
  });
  equal(noWait.deliveriesPerPaidHour, 4);
  equal(Number(tenMinuteWait.deliveriesPerPaidHour.toFixed(2)), 2.4);
  equal(Number(batched.deliveriesPerPaidHour.toFixed(2)), 3.6);
});

test('mission telemetry normalizes only when the payroll clock is complete', () => {
  const events: any[] = [
    { eventId:'e1', eventType:'MISSION_ACCEPTED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'API_ORDER', occurredAt:'2026-10-27T08:00:00.000Z', orderId:'o1', missionId:'m1', merchantId:'shop1', estimatedActivitySeconds:3600 },
    { eventId:'e2', eventType:'MERCHANT_READY', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'MERCHANT_APP', occurredAt:'2026-10-27T08:10:00.000Z', orderId:'o1', missionId:'m1', merchantId:'shop1' },
    { eventId:'e3', eventType:'PICKUP_ARRIVED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'COURIER_APP', occurredAt:'2026-10-27T08:20:00.000Z', orderId:'o1', missionId:'m1', merchantId:'shop1' },
    { eventId:'e4', eventType:'PICKED_UP', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'API_ORDER', occurredAt:'2026-10-27T08:30:00.000Z', orderId:'o1', missionId:'m1', merchantId:'shop1' },
    { eventId:'e5', eventType:'DELIVERED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'API_ORDER', occurredAt:'2026-10-27T09:00:00.000Z', orderId:'o1', missionId:'m1', merchantId:'shop1' },
  ];
  const out = normalizeMissionPayrollTelemetry(events);
  equal(out.complete, true);
  equal(out.facts.length, 4);
  equal(out.diagnostics.merchantReadyBeforeArrivalSeconds, 600);
  equal(out.diagnostics.pickupDwellSeconds, 600);
  const duration = out.facts.find((fact:any) => fact.kind === 'DURATION') as any;
  equal(duration.seconds, 3600);
});

test('missing pickup arrival blocks mission time normalization', () => {
  const events: any[] = [
    { eventId:'e1', eventType:'MISSION_ACCEPTED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'API_ORDER', occurredAt:'2026-10-27T08:00:00.000Z', orderId:'o1', missionId:'m1', estimatedActivitySeconds:3600 },
    { eventId:'e2', eventType:'PICKED_UP', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'API_ORDER', occurredAt:'2026-10-27T08:30:00.000Z', orderId:'o1', missionId:'m1' },
    { eventId:'e3', eventType:'DELIVERED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'API_ORDER', occurredAt:'2026-10-27T09:00:00.000Z', orderId:'o1', missionId:'m1' },
  ];
  const out = normalizeMissionPayrollTelemetry(events);
  equal(out.complete, false);
  ok(out.missingSignals.includes('PICKUP_ARRIVED'));
  equal(out.facts.filter((fact:any) => fact.kind === 'TIME').length, 0);
  equal(out.facts.filter((fact:any) => fact.kind === 'DURATION').length, 1);
});

test('OPS paid segments normalize only with explicit start/end pairing', () => {
  const events: any[] = [
    { eventId:'r1', eventType:'REPOSITION_STARTED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'OPS', occurredAt:'2026-10-27T09:00:00.000Z', segmentId:'reposition-1' },
    { eventId:'r2', eventType:'REPOSITION_ENDED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'COURIER_APP', occurredAt:'2026-10-27T09:15:00.000Z', segmentId:'reposition-1' },
    { eventId:'w1', eventType:'OTHER_PAID_STARTED', courierId:'be-lab-1', countryCode:'BE', weekKey:'2026-W44', policyId:'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1', source:'OPS', occurredAt:'2026-10-27T09:20:00.000Z', segmentId:'other-1' },
  ];
  const out = normalizePaidWorkSegments(events);
  equal(out.complete, false);
  equal(out.facts.length, 1);
  equal(out.facts[0].category, 'REQUIRED_REPOSITION');
  ok(out.incompleteSegments.includes('other-1'));
});

test('human-approved correction supersedes a fact without deleting history', () => {
  const policy = createBelgiumEmployeeLabPolicy();
  const sealed = sealCountryPayPolicy(
    policy,
    '2026-10-27T11:00:00.000Z',
    'pog-fair-pay-lab',
  );
  const originalFacts = belgiumFacts();
  const original = buildCourierWeeklyStatement(originalFacts, sealed);

  const correctedIncome: CourierPayrollFact = {
    ...common,
    factId: 'm1-correction-1',
    kind: 'MONEY',
    category: 'ELIGIBLE_INCOME',
    source: 'PAYMENTS',
    amountMinor: 8800,
    currency: 'EUR',
    recordedAt: '2026-10-27T14:00:00.000Z',
    evidenceRefs: ['ops-case:PAY-2026-0001'],
    supersedesFactId: 'm1',
    correction: {
      reasonCode: 'PAYROLL_RECONCILIATION',
      reason: 'Eligible income reconciled against the approved source ledger.',
      approvedAt: '2026-10-27T13:55:00.000Z',
      approvedBy: 'ops-reviewer-1',
    },
  };

  const corrected = buildCourierWeeklyStatement(
    [...originalFacts, correctedIncome],
    sealed,
  );

  ok(corrected.statementId !== original.statementId);
  equal(corrected.factCount, original.factCount + 1);
  equal(corrected.effectiveFactCount, original.effectiveFactCount);
  ok(corrected.supersededFactIds.includes('m1'));
  ok(corrected.effectiveFactIds.includes('m1-correction-1'));
  equal(corrected.explanation.eligibleIncomeCents, 8800);
  equal(corrected.explanation.governingFloorCents, 9500);
  equal(corrected.explanation.differentialDueCents, 700);
  equal(corrected.explanation.totalCashDueCents, 11500);
});

test('correction requires an existing compatible target', () => {
  const facts = belgiumFacts();
  const missingTarget: CourierPayrollFact = {
    ...common,
    factId: 'missing-target-correction',
    kind: 'MONEY',
    category: 'ELIGIBLE_INCOME',
    source: 'PAYMENTS',
    amountMinor: 8800,
    currency: 'EUR',
    recordedAt: '2026-10-27T14:00:00.000Z',
    evidenceRefs: ['ops-case:PAY-2026-0002'],
    supersedesFactId: 'does-not-exist',
    correction: {
      reasonCode: 'PAYROLL_RECONCILIATION',
      reason: 'Correction test.',
      approvedAt: '2026-10-27T13:55:00.000Z',
      approvedBy: 'ops-reviewer-1',
    },
  };
  throws(
    () => projectWeeklyPayrollInput(
      [...facts, missingTarget],
      createBelgiumEmployeeLabPolicy(),
    ),
    /CORRECTION_TARGET_MISSING/,
  );
});

test('one fact cannot be silently superseded by two competing corrections', () => {
  const facts = belgiumFacts();
  const makeCorrection = (
    factId: string,
    amountMinor: number,
  ): CourierPayrollFact => ({
    ...common,
    factId,
    kind: 'MONEY',
    category: 'ELIGIBLE_INCOME',
    source: 'PAYMENTS',
    amountMinor,
    currency: 'EUR',
    recordedAt: '2026-10-27T14:00:00.000Z',
    evidenceRefs: ['ops-case:PAY-2026-0003'],
    supersedesFactId: 'm1',
    correction: {
      reasonCode: 'PAYROLL_RECONCILIATION',
      reason: 'Competing correction test.',
      approvedAt: '2026-10-27T13:55:00.000Z',
      approvedBy: 'ops-reviewer-1',
    },
  });
  throws(
    () => projectWeeklyPayrollInput(
      [...facts, makeCorrection('m1-c1', 8800), makeCorrection('m1-c2', 8700)],
      createBelgiumEmployeeLabPolicy(),
    ),
    /CORRECTION_TARGET_ALREADY_SUPERSEDED/,
  );
});
