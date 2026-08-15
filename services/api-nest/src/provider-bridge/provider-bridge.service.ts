import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import type {
  ProviderBridgeReadinessSnapshot,
  ProviderCapabilityReadiness,
  VerificationProvider,
} from './provider-bridge.types';

type ProviderFile = {
  sinch?: { application_key?: string; application_secret?: string };
  twilio?: { account_sid?: string; auth_token?: string; verify_service_sid?: string };
};

type PostmarkFile = {
  provider?: string;
  server_token?: string;
  from_email?: string;
  message_stream?: string;
  verified_at?: string;
};

type ProviderRuntime = {
  externalCallsEnabled: boolean;
  primary: VerificationProvider;
  secondary: VerificationProvider;
  signingSecret: string;
  sinch: { applicationKey: string; applicationSecret: string; configured: boolean };
  twilio: { accountSid: string; authToken: string; serviceSid: string; configured: boolean };
  postmark: { serverToken: string; fromEmail: string; messageStream: string; configured: boolean };
};

const clean = (value: unknown, max = 500): string =>
  String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const truthy = (value: unknown): boolean => /^(1|true|yes|on)$/i.test(clean(value, 12));
const hasEnv = (name: string): boolean => clean(process.env[name], 1000).length > 0;
const hasAnyEnv = (...names: string[]): boolean => names.some(hasEnv);

function readSecretFile(pathValue: unknown): string {
  const path = clean(pathValue, 600);
  if (!path) return '';
  try { return clean(readFileSync(path, 'utf8'), 2000); } catch { return ''; }
}

function readJsonFile<T extends object>(pathValue: unknown): T | null {
  const path = clean(pathValue, 600);
  if (!path) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as T;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readProviderFile(): ProviderFile {
  return readJsonFile<ProviderFile>(process.env.DA_IDENTITY_PROVIDERS_FILE) || {};
}

function readPostmarkFile(): PostmarkFile {
  return readJsonFile<PostmarkFile>(process.env.DA_POSTMARK_CONFIG_FILE) || {};
}

function provider(value: unknown, fallback: VerificationProvider): VerificationProvider {
  return clean(value, 20) === 'twilio' ? 'twilio' : clean(value, 20) === 'sinch' ? 'sinch' : fallback;
}

@Injectable()
export class ProviderBridgeService {
  runtime(): ProviderRuntime {
    const file = readProviderFile();
    const postmarkFile = readPostmarkFile();
    const sinchApplicationKey = clean(process.env.SINCH_APPLICATION_KEY || file.sinch?.application_key, 180);
    const sinchApplicationSecret = clean(process.env.SINCH_APPLICATION_SECRET || file.sinch?.application_secret, 260);
    const twilioAccountSid = clean(process.env.TWILIO_ACCOUNT_SID || file.twilio?.account_sid, 180);
    const twilioAuthToken = clean(process.env.TWILIO_AUTH_TOKEN || file.twilio?.auth_token, 260);
    const twilioServiceSid = clean(process.env.TWILIO_VERIFY_SERVICE_SID || file.twilio?.verify_service_sid, 180);
    const postmarkServerToken = clean(process.env.POSTMARK_SERVER_TOKEN || postmarkFile.server_token, 260);
    const postmarkFromEmail = clean(process.env.POSTMARK_FROM_EMAIL || process.env.EMAIL_FROM || postmarkFile.from_email, 254).toLowerCase();
    const postmarkMessageStream = clean(process.env.POSTMARK_MESSAGE_STREAM || postmarkFile.message_stream || 'outbound', 80) || 'outbound';
    const signingSecret = clean(
      process.env.DA_IDENTITY_PROOF_SIGNING_SECRET ||
        readSecretFile(process.env.DA_IDENTITY_PROOF_SIGNING_SECRET_FILE),
      2000,
    );
    const primary = provider(process.env.DA_SMS_PRIMARY_PROVIDER, 'sinch');
    const secondaryCandidate = provider(process.env.DA_SMS_SECONDARY_PROVIDER, 'twilio');
    const secondary = secondaryCandidate === primary ? (primary === 'sinch' ? 'twilio' : 'sinch') : secondaryCandidate;
    return {
      externalCallsEnabled: truthy(process.env.DA_PROVIDER_BRIDGE_EXTERNAL_CALLS),
      primary,
      secondary,
      signingSecret,
      sinch: {
        applicationKey: sinchApplicationKey,
        applicationSecret: sinchApplicationSecret,
        configured: Boolean(sinchApplicationKey && sinchApplicationSecret),
      },
      twilio: {
        accountSid: twilioAccountSid,
        authToken: twilioAuthToken,
        serviceSid: twilioServiceSid,
        configured: Boolean(twilioAccountSid && twilioAuthToken && twilioServiceSid),
      },
      postmark: {
        serverToken: postmarkServerToken,
        fromEmail: postmarkFromEmail,
        messageStream: postmarkMessageStream,
        configured: Boolean(postmarkServerToken && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(postmarkFromEmail)),
      },
    };
  }

  private googlePlacesReadiness(): ProviderCapabilityReadiness {
    const credentialPresent = hasAnyEnv(
      'GOOGLE_PLACES_API_KEY',
      'GOOGLE_MAPS_SERVER_API_KEY',
      'GOOGLE_MAPS_API_KEY',
      'GOOGLE_API_KEY',
    );
    return {
      provider: 'google_places',
      capability: 'address_selection_and_validation',
      state: credentialPresent ? 'external_verification_required' : 'credentials_missing',
      credentialPresent,
      externalVerificationRequired: true,
      missing: credentialPresent
        ? ['places_api_enablement', 'billing_quota_proof', 'key_restriction_proof']
        : ['server_api_key', 'places_api_enablement', 'billing_quota_proof'],
      notes: [
        'Location Trust remains the active Google Places boundary.',
        'Provider Bridge does not expose Google credentials to Expo.',
      ],
    };
  }

  private smsReadiness() {
    const runtime = this.runtime();
    const routes = [
      { provider: 'sinch' as const, configured: runtime.sinch.configured, role: runtime.primary === 'sinch' ? 'primary' as const : 'secondary' as const },
      { provider: 'twilio' as const, configured: runtime.twilio.configured, role: runtime.primary === 'twilio' ? 'primary' as const : 'secondary' as const },
    ];
    const credentialPresent = routes.some((item) => item.configured);
    const primaryConfigured = runtime.primary === 'sinch' ? runtime.sinch.configured : runtime.twilio.configured;
    const state = runtime.externalCallsEnabled && primaryConfigured && runtime.signingSecret
      ? 'ready' as const
      : credentialPresent
        ? 'credentials_partial' as const
        : 'credentials_missing' as const;
    const missing: string[] = [];
    if (!primaryConfigured) missing.push('primary_provider_credentials');
    if (!runtime.signingSecret) missing.push('proof_signing_secret');
    if (!runtime.externalCallsEnabled) missing.push('external_calls_enablement');
    return {
      provider: 'sms' as const,
      capability: 'provider_neutral_phone_verification',
      state,
      credentialPresent,
      externalVerificationRequired: false,
      missing,
      notes: [
        'Sinch is the primary route after three approved Lycamobile verifications.',
        'Twilio remains available as the alternate route.',
        'Provider acceptance is never treated as handset delivery or proof approval.',
      ],
      primary: runtime.primary,
      secondary: runtime.secondary,
      routes,
    };
  }

  private emailReadiness() {
    const runtime = this.runtime();
    const state = runtime.externalCallsEnabled && runtime.postmark.configured && runtime.signingSecret
      ? 'ready' as const
      : runtime.postmark.serverToken || runtime.postmark.fromEmail
        ? 'credentials_partial' as const
        : 'credentials_missing' as const;
    const missing: string[] = [];
    if (!runtime.postmark.serverToken) missing.push('postmark_server_token');
    if (!runtime.postmark.fromEmail) missing.push('verified_from_identity');
    if (!runtime.signingSecret) missing.push('proof_signing_secret');
    if (!runtime.externalCallsEnabled) missing.push('external_calls_enablement');
    return {
      provider: 'email' as const,
      capability: 'provider_neutral_email_verification',
      state,
      credentialPresent: Boolean(runtime.postmark.serverToken || runtime.postmark.fromEmail),
      externalVerificationRequired: false,
      missing,
      notes: [
        'Postmark internal delivery, DKIM, Return-Path and DMARC were confirmed before activation.',
        'Provider acceptance is never treated as email ownership proof.',
        'Email OTP values are never logged or persisted.',
      ],
      route: 'postmark' as const,
      configured: runtime.postmark.configured,
    };
  }

  health() {
    const runtime = this.runtime();
    return {
      ok: true as const,
      service: 'provider-bridge' as const,
      version: 'v1d' as const,
      mode: runtime.externalCallsEnabled ? 'identity_router_live' as const : 'configured_external_calls_disabled' as const,
      externalCallsEnabled: runtime.externalCallsEnabled,
      smsPrimary: runtime.primary,
      smsSecondary: runtime.secondary,
      emailProvider: 'postmark' as const,
      emailReady: runtime.postmark.configured && runtime.externalCallsEnabled,
      proofSigning: Boolean(runtime.signingSecret),
    };
  }

  readiness(): ProviderBridgeReadinessSnapshot {
    return {
      ...this.health(),
      generatedAt: new Date().toISOString(),
      providers: {
        googlePlaces: this.googlePlacesReadiness(),
        sms: this.smsReadiness(),
        email: this.emailReadiness(),
      },
    };
  }

  capabilities() {
    const snapshot = this.readiness();
    return {
      ok: true as const,
      service: snapshot.service,
      version: snapshot.version,
      externalCallsEnabled: snapshot.externalCallsEnabled,
      capabilities: [snapshot.providers.googlePlaces, snapshot.providers.sms, snapshot.providers.email],
    };
  }
}
