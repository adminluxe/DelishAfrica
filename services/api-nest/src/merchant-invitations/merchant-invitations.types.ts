export const MERCHANT_INVITATION_PREPARE_PATH =
  '/api/v1/ops/merchant-invitations/prepare' as const;
export const MERCHANT_INVITATION_DISPATCH_PATH =
  '/api/v1/ops/merchant-invitations/dispatch-one' as const;
export const MERCHANT_INVITATION_PREVIEW_PATH =
  '/api/v1/merchant-invitations/accept/preview' as const;
export const MERCHANT_INVITATION_ACCEPT_PATH =
  '/api/v1/merchant-invitations/accept' as const;

export const MERCHANT_INVITATION_ROLES = [
  'owner',
  'admin',
  'manager',
  'staff',
  'viewer',
] as const;

export type MerchantInvitationRole =
  (typeof MERCHANT_INVITATION_ROLES)[number];

export type MerchantInvitationPrepareBody = {
  partnerId?: unknown;
  recipientEmail?: unknown;
  membershipRole?: unknown;
  idempotencyKey?: unknown;
  expiresInHours?: unknown;
};

export type MerchantInvitationTokenBody = {
  token?: unknown;
};

export type MerchantInvitationCommand = {
  partnerId: string;
  recipientEmail: string;
  membershipRole: MerchantInvitationRole;
  idempotencyKey: string;
  expiresInHours: number;
};

export type MerchantInvitationAuthority = {
  principalHash: string;
  authorityAuditId: string;
};

export type MerchantInvitationEncryptedValue = {
  ciphertext: Buffer;
  keyId: string;
};

export type MerchantInvitationCreateInput = {
  invitationId: string;
  partnerId: string;
  recipientEmailHash: string;
  recipientEmailCiphertext: Buffer;
  recipientEmailKeyId: string;
  tokenHash: string;
  idempotencyKeyHash: string;
  issuedBySubjectHash: string;
  membershipRole: MerchantInvitationRole;
  expiresAt: Date;
  templateAlias: string;
  payloadCiphertext: Buffer;
  payloadKeyId: string;
  payloadSha256: string;
  outboxIdempotencyKeyHash: string;
  requestIdHash: string;
  authorityAuditIdHash: string;
};

export type MerchantInvitationCreateResult = {
  invitationId: string;
  invitationStatus: string;
  outboxStatus: string;
  idempotentReplay: boolean;
};

export type MerchantInvitationPreviewRecord = {
  invitationId: string;
  partnerId: string;
  partnerSlug: string;
  partnerName: string;
  membershipRole: MerchantInvitationRole;
  invitationStatus: string;
  contractStatus: string;
  kybStatus: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export type MerchantInvitationAcceptInput = {
  tokenHash: string;
  issuer: string;
  subject: string;
  principalEmailHash: string;
  actorSubjectHash: string;
  requestIdHash: string;
};

export type MerchantInvitationAcceptResult = {
  invitationId: string;
  partnerId: string;
  partnerSlug: string;
  partnerName: string;
  membershipId: string;
  membershipRole: string;
  membershipStatus: string;
  contractStatus: string;
  kybStatus: string;
  invitationStatus: string;
  invitationContractStatus: string;
  idempotentReplay: boolean;
};
