export type ProviderBridgeProvider = 'google_places' | 'sms' | 'email';
export type VerificationProvider = 'sinch' | 'twilio';
export type EmailVerificationProvider = 'postmark';
export type VerificationRoute = 'auto' | 'primary' | 'alternate';
export type VerificationRole = 'client' | 'merchant' | 'courier';

export type ProviderBridgeState =
  | 'ready'
  | 'external_verification_required'
  | 'credentials_partial'
  | 'credentials_missing';

export interface ProviderCapabilityReadiness {
  provider: ProviderBridgeProvider;
  capability: string;
  state: ProviderBridgeState;
  credentialPresent: boolean;
  externalVerificationRequired: boolean;
  missing: string[];
  notes: string[];
}

export interface SmsProviderReadiness {
  provider: VerificationProvider;
  configured: boolean;
  role: 'primary' | 'secondary';
}

export interface ProviderBridgeReadinessSnapshot {
  ok: true;
  service: 'provider-bridge';
  version: 'v1d';
  mode: 'identity_router_live' | 'configured_external_calls_disabled';
  externalCallsEnabled: boolean;
  generatedAt: string;
  providers: {
    googlePlaces: ProviderCapabilityReadiness;
    sms: ProviderCapabilityReadiness & {
      primary: VerificationProvider;
      secondary: VerificationProvider;
      routes: SmsProviderReadiness[];
    };
    email: ProviderCapabilityReadiness & {
      route: EmailVerificationProvider;
      configured: boolean;
    };
  };
}

export interface SmsVerificationStartInput {
  destination: string;
  role: VerificationRole;
  route?: VerificationRoute;
  customerReference?: string;
  automaticFallback?: boolean;
}

export interface SmsVerificationStartResult {
  provider: VerificationProvider;
  providerReference: string;
  providerStatus: string;
  alternateAvailable: boolean;
  verificationExpirySeconds?: number;
  expiresAt?: string;
  customerReference?: string;
  providerInterceptionTimeoutSeconds?: number;
}

export interface SmsVerificationCheckInput {
  provider: VerificationProvider;
  providerReference: string;
  destination: string;
  code: string;
}

export interface SmsVerificationCheckResult {
  provider: VerificationProvider;
  approved: boolean;
  providerStatus: string;
  providerReason?: string;
  reasonCode?: string;
  expired?: boolean;
}

export interface EmailVerificationStartInput {
  destination: string;
  role: VerificationRole;
  code: string;
}

export interface EmailVerificationStartResult {
  provider: EmailVerificationProvider;
  providerReference: string;
  providerStatus: string;
  validForSeconds: number;
  expiresAt?: string;
}
