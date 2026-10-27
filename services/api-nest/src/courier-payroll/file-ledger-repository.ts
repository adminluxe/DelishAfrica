import * as fs from 'node:fs';
import * as path from 'node:path';
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

interface PersistedLine<T> {
  id: string;
  hash: string;
  value: T;
}

type StoreName = 'policies' | 'clock-events' | 'facts' | 'statements';

export interface FileCourierPayrollLedgerOptions {
  rootDir: string;
}

export class FileCourierPayrollLedger
  implements CourierPayrollLedgerRepository
{
  private readonly rootDir: string;
  private readonly clockEvents = new Map<string, StoredValue<CourierPayrollClockEvent>>();
  private readonly facts = new Map<string, StoredValue<CourierPayrollFact>>();
  private readonly policies = new Map<string, StoredValue<SealedCountryPayPolicy>>();
  private readonly statements = new Map<string, StoredValue<CourierWeeklyStatement>>();

  constructor(options: FileCourierPayrollLedgerOptions) {
    this.rootDir = path.resolve(options.rootDir);
    fs.mkdirSync(this.rootDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.rootDir, 0o700);

    this.loadStore(
      'policies',
      this.policies,
      (value) => {
        assertSealedPolicyIntegrity(value as SealedCountryPayPolicy);
        return (value as SealedCountryPayPolicy).policy.policyId;
      },
    );
    this.loadStore(
      'clock-events',
      this.clockEvents,
      (value) => {
        if (!isCourierPayrollClockEvent(value)) {
          throw new Error('COURIER_PAYROLL_FILE_LEDGER_INVALID_CLOCK_EVENT');
        }
        const event = value as CourierPayrollClockEvent;
        this.assertPolicyScope(event.policyId, event.countryCode);
        return event.eventId;
      },
    );
    this.loadStore(
      'facts',
      this.facts,
      (value) => {
        assertCourierPayrollFact(value);
        const fact = value as CourierPayrollFact;
        this.assertPolicyScope(fact.policyId, fact.countryCode);
        return fact.factId;
      },
    );
    this.loadStore(
      'statements',
      this.statements,
      (value) => {
        const statement = value as CourierWeeklyStatement;
        if (!statement?.statementId) {
          throw new Error('COURIER_PAYROLL_FILE_LEDGER_INVALID_STATEMENT');
        }
        this.assertStatementPolicy(statement);
        return statement.statementId;
      },
    );
  }

  appendPolicy(policy: SealedCountryPayPolicy): AppendResult {
    assertSealedPolicyIntegrity(policy);
    return this.appendImmutable(
      'policies',
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
      'clock-events',
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
      'facts',
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
    if (!statement?.statementId) {
      throw new Error('COURIER_PAYROLL_INVALID_STATEMENT');
    }
    this.assertStatementPolicy(statement);
    return this.appendImmutable(
      'statements',
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

  private assertStatementPolicy(
    statement: CourierWeeklyStatement,
  ): SealedCountryPayPolicy {
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
    return policy;
  }

  private filePath(storeName: StoreName): string {
    return path.join(this.rootDir, `${storeName}.ndjson`);
  }

  private loadStore<T>(
    storeName: StoreName,
    store: Map<string, StoredValue<T>>,
    idOf: (value: unknown) => string,
  ): void {
    const file = this.filePath(storeName);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '', { encoding: 'utf8', mode: 0o600 });
      return;
    }
    fs.chmodSync(file, 0o600);
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return;

    const lines = raw.split('\n').filter(Boolean);
    lines.forEach((line, index) => {
      let parsed: PersistedLine<T>;
      try {
        parsed = JSON.parse(line) as PersistedLine<T>;
      } catch {
        throw new Error(
          `COURIER_PAYROLL_FILE_LEDGER_CORRUPT_JSON:${storeName}:${index + 1}`,
        );
      }

      const id = idOf(parsed.value);
      const expectedHash = stableJsonHash(parsed.value);
      if (
        parsed.id !== id ||
        parsed.hash !== expectedHash ||
        !parsed.id ||
        !parsed.hash
      ) {
        throw new Error(
          `COURIER_PAYROLL_FILE_LEDGER_INTEGRITY:${storeName}:${index + 1}`,
        );
      }

      const existing = store.get(id);
      if (existing) {
        const code =
          existing.hash === parsed.hash
            ? 'COURIER_PAYROLL_FILE_LEDGER_DUPLICATE_RECORD'
            : 'COURIER_PAYROLL_FILE_LEDGER_DUPLICATE_CONFLICT';
        throw new Error(`${code}:${storeName}:${id}`);
      }

      store.set(id, {
        value: this.clone(parsed.value),
        hash: parsed.hash,
      });
    });
  }

  private appendImmutable<T>(
    storeName: StoreName,
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

    const persisted: PersistedLine<T> = {
      id,
      hash,
      value: this.clone(value),
    };
    const file = this.filePath(storeName);
    const descriptor = fs.openSync(file, 'a', 0o600);
    try {
      fs.writeSync(descriptor, JSON.stringify(persisted) + '\n', null, 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.chmodSync(file, 0o600);

    store.set(id, {
      value: this.clone(value),
      hash,
    });
    return { inserted: true, idempotentReplay: false };
  }

  private clone<T>(value: T): T {
    if (value === null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
