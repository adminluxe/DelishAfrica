import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import { assertCourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import { isCourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import type { CourierWeeklyStatement } from './weekly-statement';
import type { SealedCountryPayPolicy } from './policy-ledger';
import { assertSealedPolicyIntegrity, stableJsonHash } from './policy-ledger';

export interface AppendResult {
  inserted: boolean;
  idempotentReplay: boolean;
}

interface StoredValue<T> {
  value: T;
  hash: string;
}

export class InMemoryCourierPayrollLedger {
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
