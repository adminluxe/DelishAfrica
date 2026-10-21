export type AccountDeletionApplication = 'client' | 'merchant' | 'courier';
export type AccountDeletionStatus =
  | 'requested'
  | 'pending_identity_deletion'
  | 'processing'
  | 'completed'
  | 'manual_review';

export type AccountDeletionRecord = {
  requestId: string;
  application: AccountDeletionApplication;
  identityFingerprint: string;
  idempotencyKeyHash: string;
  status: AccountDeletionStatus;
  requestedAt: string;
  completionDeadline: string;
  completedAt: string | null;
  retentionAcknowledged: true;
  authSource: 'external';
};
