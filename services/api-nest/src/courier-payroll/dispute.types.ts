export type CourierPayrollDisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'RESOLVED_NO_CHANGE'
  | 'RESOLVED_CORRECTION_REQUIRED';

export type CourierPayrollDisputeEventType =
  | 'OPENED'
  | 'REVIEW_STARTED'
  | 'RESOLVED_NO_CHANGE'
  | 'RESOLVED_CORRECTION_REQUIRED';

export interface CourierPayrollDisputeEvent {
  eventId: string;
  disputeId: string;
  statementId: string;
  courierId: string;
  weekKey: string;
  policyId: string;
  eventType: CourierPayrollDisputeEventType;
  status: CourierPayrollDisputeStatus;
  actorRole: 'COURIER' | 'OPS';
  actorSubject: string;
  reasonCode: string;
  note: string;
  evidenceRefs: string[];
  occurredAt: string;
}

export interface CourierPayrollDispute {
  disputeId: string;
  statementId: string;
  courierId: string;
  weekKey: string;
  policyId: string;
  status: CourierPayrollDisputeStatus;
  openedAt: string;
  updatedAt: string;
  reasonCode: string;
  note: string;
  evidenceRefs: string[];
  history: CourierPayrollDisputeEvent[];
}
