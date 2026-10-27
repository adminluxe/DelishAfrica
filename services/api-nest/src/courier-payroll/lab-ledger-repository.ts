import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { assertCourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import { isCourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import type { CourierWeeklyStatement } from './weekly-statement';
import type { SealedCountryPayPolicy } from './policy-ledger';
import { assertSealedPolicyIntegrity, stableJsonHash } from './policy-ledger';
import type {
  AppendResult,
  CourierPayrollLedgerRepository,
} from './courier-payroll-ledger';

interface StoredValue<T> {
  value: T;
  hash: string;
}

export class InMemoryCourierPayrollLedger
  implements CourierPayrollLedgerRepository
{
  private readonly clockEvents = new Map<string, StoredValue<CourierPayrollClockEvent>>();
  private readonly facts = new Map<string, StoredValue<CourierPayrollFact>>();
  private readonly policies = new Map<string, StoredValue<SealedCountryPayPolicy>>();
  private readonly statements = new Map<string, StoredValue<CourierWeeklyStatement>>();

  appendPolicy(policy: SealedCountryPayPolicy): AppendResult {
    assertSealedPolicyIntegrity(policy);
    return this.appendImmutable(
      this.policies,
      policy.policy.policyId,
      policy,
      'COURIER_PAYROLL_POLICY_ID_CONFLICT',
    );
  }

  appendClockEvent(event: CourierPayrollClockEvent): AppendResult {
    if (!isCourierPayrollClockEvent(event)) {
      throw new Error('COURIER_PAYROLL_INVALID_CLOCK_EVENT');
    }
    this.assertPolicyScope(event.policyId, event.countryCode);
    return this.appendImmutable(
      this.clockEvents,
      event.eventId,
      event,
      'COURIER_PAYROLL_CLOCK_EVENT_ID_CONFLICT',
    );
  }

  appendClockEvents(events: CourierPayrollClockEvent[]): AppendResult[] {
    return events.map((event) => this.appendClockEvent(event));
  }

  appendFact(fact: CourierPayrollFact): AppendResult {
    assertCourierPayrollFact(fact);
    this.assertPolicyScope(fact.policyId, fact.countryCode);
    return this.appendImmutable(
      this.facts,
      fact.factId,
      fact,
      'COURIER_PAYROLL_FACT_ID_CONFLICT',
    );
  }

  appendFacts(facts: CourierPayrollFact[]): AppendResult[] {
    return facts.map((fact) => this.appendFact(fact));
  }

  appendStatement(statement: CourierWeeklyStatement): AppendResult {
    const policy = this.assertPolicyScope(
      statement.policyId,
      statement.countryCode,
    );
    if (statement.policyHash !== policy.policyHash) {
      throw new Error('COURIER_PAYROLL_STATEMENT_POLICY_HASH_MISMATCH');
    }
    if (statement.currency.toUpperCase() !== policy.policy.currency.toUpperCase()) {
      throw new Error('COURIER_PAYROLL_STATEMENT_CURRENCY_MISMATCH');
    }
    return this.appendImmutable(
      this.statements,
      statement.statementId,
      statement,
      'COURIER_PAYROLL_STATEMENT_ID_CONFLICT',
    );
  }

  getPolicy(policyId: string): SealedCountryPayPolicy | null {
    return this.clone(this.policies.get(policyId)?.value ?? null);
  }

  getStatement(statementId: string): CourierWeeklyStatement | null {
    return this.clone(this.statements.get(statementId)?.value ?? null);
  }

  listStatements(
    courierId: string,
    weekKey?: string,
    policyId?: string,
  ): CourierWeeklyStatement[] {
    return Array.from(this.statements.values())
      .map((stored) => stored.value)
      .filter(
        (statement) =>
          statement.courierId === courierId &&
          (!weekKey || statement.weekKey === weekKey) &&
          (!policyId || statement.policyId === policyId),
      )
      .sort(
        (a, b) =>
          b.weekKey.localeCompare(a.weekKey) ||
          a.statementId.localeCompare(b.statementId),
      )
      .map((statement) => this.clone(statement));
  }

  listClockEvents(
    courierId: string,
    weekKey: string,
    policyId: string,
  ): CourierPayrollClockEvent[] {
    return Array.from(this.clockEvents.values())
      .map((stored) => stored.value)
      .filter(
        (event) =>
          event.courierId === courierId &&
          event.weekKey === weekKey &&
          event.policyId === policyId,
      )
      .sort((a, b) => a.eventId.localeCompare(b.eventId))
      .map((event) => this.clone(event));
  }

  listFacts(
    courierId: string,
    weekKey: string,
    policyId: string,
  ): CourierPayrollFact[] {
    return Array.from(this.facts.values())
      .map((stored) => stored.value)
      .filter(
        (fact) =>
          fact.courierId === courierId &&
          fact.weekKey === weekKey &&
          fact.policyId === policyId,
      )
      .sort((a, b) => a.factId.localeCompare(b.factId))
      .map((fact) => this.clone(fact));
  }

  counts() {
    return {
      clockEvents: this.clockEvents.size,
      policies: this.policies.size,
      facts: this.facts.size,
      statements: this.statements.size,
    };
  }

  private assertPolicyScope(
    policyId: string,
    countryCode: string,
  ): SealedCountryPayPolicy {
    const policy = this.policies.get(policyId)?.value;
    if (!policy) {
      throw new Error('COURIER_PAYROLL_POLICY_REQUIRED_BEFORE_CHILD_RECORD');
    }
    if (policy.policy.countryCode.toUpperCase() !== countryCode.toUpperCase()) {
      throw new Error('COURIER_PAYROLL_CHILD_POLICY_COUNTRY_MISMATCH');
    }
    return policy;
  }

  private appendImmutable<T>(
    store: Map<string, StoredValue<T>>,
    id: string,
    value: T,
    conflictCode: string,
  ): AppendResult {
    const hash = stableJsonHash(value);
    const existing = store.get(id);
    if (existing) {
      if (existing.hash !== hash) throw new Error(conflictCode);
      return { inserted: false, idempotentReplay: true };
    }
    store.set(id, { value: this.clone(value), hash });
    return { inserted: true, idempotentReplay: false };
  }

  private clone<T>(value: T): T {
    if (value === null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
