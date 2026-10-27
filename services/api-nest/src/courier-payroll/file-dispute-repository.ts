import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
  fsyncSync,
} from 'node:fs';
import { resolve } from 'node:path';
import type {
  CourierPayrollDispute,
  CourierPayrollDisputeEvent,
  CourierPayrollDisputeEventType,
  CourierPayrollDisputeStatus,
} from './dispute.types';

interface StoredLine {
  id: string;
  hash: string;
  value: CourierPayrollDisputeEvent;
}

const FINAL = new Set<CourierPayrollDisputeStatus>([
  'RESOLVED_NO_CHANGE',
  'RESOLVED_CORRECTION_REQUIRED',
]);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.entries(value as Record<string, unknown>)
        .filter(([, candidate]) => candidate !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, candidate]) => JSON.stringify(key) + ':' + canonical(candidate))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

function sha(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function text(value: unknown, field: string): string {
  const clean = String(value || '').trim();
  if (!clean) throw new Error('COURIER_PAYROLL_DISPUTE_' + field.toUpperCase() + '_REQUIRED');
  return clean;
}

function occurredAt(value: unknown): string {
  const clean = text(value, 'occurredAt');
  if (!Number.isFinite(Date.parse(clean)) || !/(Z|[+-]\d{2}:\d{2})$/i.test(clean)) {
    throw new Error('COURIER_PAYROLL_DISPUTE_OCCURRED_AT_INVALID');
  }
  return clean;
}

function normalizeRefs(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map((value) => String(value || '').trim()).filter(Boolean)),
  ).sort();
}

function statusFor(type: CourierPayrollDisputeEventType): CourierPayrollDisputeStatus {
  if (type === 'OPENED') return 'OPEN';
  if (type === 'REVIEW_STARTED') return 'UNDER_REVIEW';
  if (type === 'RESOLVED_NO_CHANGE') return 'RESOLVED_NO_CHANGE';
  return 'RESOLVED_CORRECTION_REQUIRED';
}

export function disputeIdFor(statementId: string, courierId: string): string {
  return sha({
    purpose: 'COURIER_PAYROLL_DISPUTE_V0.1',
    statementId: text(statementId, 'statementId'),
    courierId: text(courierId, 'courierId'),
  });
}

export class FileCourierPayrollDisputeStore {
  private readonly rootDir: string;
  private readonly filePath: string;
  private readonly events = new Map<string, CourierPayrollDisputeEvent>();
  private readonly histories = new Map<string, CourierPayrollDisputeEvent[]>();

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
    mkdirSync(this.rootDir, { recursive: true, mode: 0o700 });
    chmodSync(this.rootDir, 0o700);
    this.filePath = resolve(this.rootDir, 'disputes.ndjson');
    if (!existsSync(this.filePath)) {
      const descriptor = openSync(this.filePath, 'a', 0o600);
      closeSync(descriptor);
    }
    chmodSync(this.filePath, 0o600);
    this.load();
  }

  open(input: {
    statementId: string;
    courierId: string;
    weekKey: string;
    policyId: string;
    actorSubject: string;
    reasonCode: string;
    note: string;
    evidenceRefs: string[];
    occurredAt: string;
  }): { dispute: CourierPayrollDispute; idempotentReplay: boolean } {
    const disputeId = disputeIdFor(input.statementId, input.courierId);
    const existing = this.get(disputeId);
    if (existing) return { dispute: existing, idempotentReplay: true };
    const event = this.buildEvent({
      disputeId,
      statementId: input.statementId,
      courierId: input.courierId,
      weekKey: input.weekKey,
      policyId: input.policyId,
      eventType: 'OPENED',
      actorRole: 'COURIER',
      actorSubject: input.actorSubject,
      reasonCode: input.reasonCode,
      note: input.note,
      evidenceRefs: input.evidenceRefs,
      occurredAt: input.occurredAt,
    });
    this.append(event);
    return { dispute: this.require(disputeId), idempotentReplay: false };
  }

  review(input: {
    disputeId: string;
    eventType:
      | 'REVIEW_STARTED'
      | 'RESOLVED_NO_CHANGE'
      | 'RESOLVED_CORRECTION_REQUIRED';
    actorSubject: string;
    reasonCode: string;
    note: string;
    evidenceRefs: string[];
    occurredAt: string;
  }): CourierPayrollDispute {
    const current = this.require(input.disputeId);
    if (FINAL.has(current.status)) {
      throw new Error('COURIER_PAYROLL_DISPUTE_ALREADY_RESOLVED');
    }
    if (
      input.eventType === 'REVIEW_STARTED' &&
      current.status !== 'OPEN'
    ) {
      throw new Error('COURIER_PAYROLL_DISPUTE_REVIEW_STATE_INVALID');
    }
    const event = this.buildEvent({
      disputeId: current.disputeId,
      statementId: current.statementId,
      courierId: current.courierId,
      weekKey: current.weekKey,
      policyId: current.policyId,
      eventType: input.eventType,
      actorRole: 'OPS',
      actorSubject: input.actorSubject,
      reasonCode: input.reasonCode,
      note: input.note,
      evidenceRefs: input.evidenceRefs,
      occurredAt: input.occurredAt,
    });
    this.append(event);
    return this.require(current.disputeId);
  }

  get(disputeId: string): CourierPayrollDispute | null {
    const history = this.histories.get(String(disputeId || '').trim());
    if (!history?.length) return null;
    const first = history[0];
    const last = history[history.length - 1];
    return {
      disputeId: first.disputeId,
      statementId: first.statementId,
      courierId: first.courierId,
      weekKey: first.weekKey,
      policyId: first.policyId,
      status: last.status,
      openedAt: first.occurredAt,
      updatedAt: last.occurredAt,
      reasonCode: first.reasonCode,
      note: first.note,
      evidenceRefs: Array.from(
        new Set(history.flatMap((event) => event.evidenceRefs)),
      ).sort(),
      history: history.map((event) => structuredClone(event)),
    };
  }

  listForCourier(courierId: string): CourierPayrollDispute[] {
    return Array.from(this.histories.keys())
      .map((id) => this.require(id))
      .filter((dispute) => dispute.courierId === courierId)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          a.disputeId.localeCompare(b.disputeId),
      );
  }

  listAll(): CourierPayrollDispute[] {
    return Array.from(this.histories.keys())
      .map((id) => this.require(id))
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          a.disputeId.localeCompare(b.disputeId),
      );
  }

  private require(disputeId: string): CourierPayrollDispute {
    const dispute = this.get(disputeId);
    if (!dispute) throw new Error('COURIER_PAYROLL_DISPUTE_NOT_FOUND');
    return dispute;
  }

  private buildEvent(input: Omit<CourierPayrollDisputeEvent, 'eventId' | 'status'>): CourierPayrollDisputeEvent {
    const eventType = input.eventType;
    const normalized = {
      ...input,
      disputeId: text(input.disputeId, 'disputeId'),
      statementId: text(input.statementId, 'statementId'),
      courierId: text(input.courierId, 'courierId'),
      weekKey: text(input.weekKey, 'weekKey'),
      policyId: text(input.policyId, 'policyId'),
      actorSubject: text(input.actorSubject, 'actorSubject'),
      reasonCode: text(input.reasonCode, 'reasonCode'),
      note: text(input.note, 'note'),
      evidenceRefs: normalizeRefs(input.evidenceRefs),
      occurredAt: occurredAt(input.occurredAt),
    };
    if (normalized.evidenceRefs.length === 0) {
      throw new Error('COURIER_PAYROLL_DISPUTE_EVIDENCE_REQUIRED');
    }
    const eventId = sha({
      disputeId: normalized.disputeId,
      eventType,
      occurredAt: normalized.occurredAt,
      actorSubject: normalized.actorSubject,
      reasonCode: normalized.reasonCode,
      note: normalized.note,
      evidenceRefs: normalized.evidenceRefs,
    });
    return {
      ...normalized,
      eventId,
      status: statusFor(eventType),
    };
  }

  private append(event: CourierPayrollDisputeEvent): void {
    const existing = this.events.get(event.eventId);
    if (existing) {
      if (sha(existing) !== sha(event)) {
        throw new Error('COURIER_PAYROLL_DISPUTE_EVENT_ID_CONFLICT');
      }
      return;
    }
    const history = this.histories.get(event.disputeId) || [];
    if (history.length === 0 && event.eventType !== 'OPENED') {
      throw new Error('COURIER_PAYROLL_DISPUTE_OPEN_REQUIRED');
    }
    if (history.length > 0) {
      const first = history[0];
      if (
        first.statementId !== event.statementId ||
        first.courierId !== event.courierId ||
        first.weekKey !== event.weekKey ||
        first.policyId !== event.policyId
      ) {
        throw new Error('COURIER_PAYROLL_DISPUTE_SCOPE_MISMATCH');
      }
      if (event.occurredAt < history[history.length - 1].occurredAt) {
        throw new Error('COURIER_PAYROLL_DISPUTE_TIME_REGRESSION');
      }
    }
    const line: StoredLine = {
      id: event.eventId,
      hash: sha(event),
      value: event,
    };
    const descriptor = openSync(this.filePath, 'a', 0o600);
    try {
      writeSync(descriptor, JSON.stringify(line) + '\n', undefined, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    chmodSync(this.filePath, 0o600);
    this.ingest(line, false);
  }

  private load(): void {
    const raw = readFileSync(this.filePath, 'utf8');
    if (!raw.trim()) return;
    raw.split(/\r?\n/).filter(Boolean).forEach((line, index) => {
      let parsed: StoredLine;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error('COURIER_PAYROLL_DISPUTE_FILE_CORRUPT:' + (index + 1));
      }
      this.ingest(parsed, true);
    });
  }

  private ingest(line: StoredLine, persisted: boolean): void {
    if (
      !line ||
      typeof line !== 'object' ||
      line.id !== line.value?.eventId ||
      line.hash !== sha(line.value)
    ) {
      throw new Error('COURIER_PAYROLL_DISPUTE_FILE_INTEGRITY');
    }
    if (this.events.has(line.id)) {
      throw new Error('COURIER_PAYROLL_DISPUTE_DUPLICATE_EVENT');
    }
    const event = line.value;
    const history = this.histories.get(event.disputeId) || [];
    if (history.length === 0 && event.eventType !== 'OPENED') {
      throw new Error('COURIER_PAYROLL_DISPUTE_OPEN_REQUIRED');
    }
    if (history.length > 0) {
      const first = history[0];
      if (
        first.statementId !== event.statementId ||
        first.courierId !== event.courierId ||
        first.weekKey !== event.weekKey ||
        first.policyId !== event.policyId
      ) {
        throw new Error('COURIER_PAYROLL_DISPUTE_SCOPE_MISMATCH');
      }
      const last = history[history.length - 1];
      if (event.occurredAt < last.occurredAt) {
        throw new Error('COURIER_PAYROLL_DISPUTE_TIME_REGRESSION');
      }
      if (FINAL.has(last.status)) {
        throw new Error('COURIER_PAYROLL_DISPUTE_EVENT_AFTER_RESOLUTION');
      }
    }
    this.events.set(event.eventId, structuredClone(event));
    history.push(structuredClone(event));
    this.histories.set(event.disputeId, history);
    if (!persisted) return;
  }
}
