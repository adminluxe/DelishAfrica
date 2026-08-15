export type OpsAuthorityHeaderMap = Record<
  string,
  string | string[] | undefined
>;

export type OpsAuthorityVerification = {
  ok: true;
  service: 'ops-authority-foundation';
  version: '2.0.0';
  authorityVerified: true;
  principalHash: string;
  keyId: string;
  timestampAccepted: true;
  nonceFormatAccepted: true;
  noncePersistenceEnabled: true;
  replayProtectionEnabled: true;
  auditPersistenceEnabled: true;
  authorityAuditRecorded: true;
  invitationWritesEnabled: false;
  membershipActivationWritesEnabled: false;
  ownershipAutoEnabled: false;
  draftEnabled: false;
  publishEnabled: false;
};

export type OpsAuthorityRequestContext = {
  authorityVerified: true;
  principalHash: string;
  keyId: string;
  auditId: string;
};

export type OpsAuthorityPersistenceInput = {
  nonceHash: string;
  principalHash: string;
  keyId: string;
  authMethod: 'basic';
  requestMethod: string;
  requestPath: string;
  bodySha256: string;
  requestTimestamp: number;
  expiresAt: Date;
};

export type OpsAuthorityPersistenceDecision = {
  accepted: boolean;
  outcome: 'accepted' | 'replay_rejected';
  auditId: string;
};
